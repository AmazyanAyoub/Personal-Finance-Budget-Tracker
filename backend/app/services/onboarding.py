from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.allocation import AllocationPlan
from app.models.goal import Goal
from app.models.profile import FinancialProfile
from app.schemas.allocation import AllocationPlanOut
from app.schemas.goal import GoalOut
from app.schemas.money_event import MoneyEventCreate
from app.schemas.onboarding import OnboardingRequest, OnboardingResultOut, OnboardingStatusOut
from app.schemas.profile import FinancialProfileOut
from app.services.ledger import create_event, split_income


class OnboardingError(Exception):
    """Base error for invalid onboarding operations."""


class OnboardingConflictError(OnboardingError):
    """Raised when onboarding has already been completed or existing setup data conflicts with it."""


def get_onboarding_status(db: Session, user_id: int) -> OnboardingStatusOut:
    """Checks whether the user has completed onboarding without changing any data."""
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == user_id).first()

    if profile is None:
        return OnboardingStatusOut(completed=False, completed_at=None)

    return OnboardingStatusOut(
        completed=profile.onboarding_completed_at is not None,
        completed_at=profile.onboarding_completed_at,
    )


def _calculate_emergency_fund_target(data: OnboardingRequest) -> int:
    """Calculates the emergency-fund target from monthly Essentials money multiplied by the selected number of months."""
    if data.essentials_pct <= 0:
        raise OnboardingError("Essentials percentage must be greater than zero")

    monthly_essentials = data.expected_monthly_income_cents * data.essentials_pct // 100
    return monthly_essentials * data.emergency_fund_months


def _create_opening_balance(
    db: Session,
    user_id: int,
    data: OnboardingRequest,
    allocation: AllocationPlan,
    emergency_goal: Goal,
    onboarding_date: date,
) -> None:
    """Creates the first ledger event by separating declared emergency-fund money and allocating the remaining money across the three tracks."""
    if data.current_total_money_cents == 0:
        return

    money_outside_emergency_fund = data.current_total_money_cents - data.current_emergency_fund_cents
    track_changes = split_income(money_outside_emergency_fund, allocation)

    opening_event = MoneyEventCreate(
        event_type="opening_balance",
        cash_delta_cents=data.current_total_money_cents,
        goal_id=emergency_goal.id if data.current_emergency_fund_cents > 0 else None,
        goal_delta_cents=data.current_emergency_fund_cents,
        occurred_on=onboarding_date,
        note="Opening balance from onboarding",
        idempotency_key=f"onboarding-opening-balance:{user_id}",
        **track_changes,
    )

    create_event(db, user_id, opening_event)


def _build_emergency_goal_output(goal: Goal, current_balance_cents: int) -> GoalOut:
    """Adds the calculated balance, remaining amount and progress required by the emergency-fund response."""
    remaining = max(goal.target_cents - current_balance_cents, 0) if goal.target_cents is not None else None
    progress = round(current_balance_cents * 100 / goal.target_cents, 2) if goal.target_cents is not None else None

    return GoalOut(
        id=goal.id,
        user_id=goal.user_id,
        name=goal.name,
        type_name=goal.type_name,
        linked_track_kind=goal.linked_track_kind,
        system_role=goal.system_role,
        target_cents=goal.target_cents,
        target_date=goal.target_date,
        status=goal.status,
        current_balance_cents=current_balance_cents,
        remaining_cents=remaining,
        progress_pct=progress,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


def complete_onboarding(
    db: Session,
    user_id: int,
    data: OnboardingRequest,
    onboarding_date: date,
) -> OnboardingResultOut:
    """Creates the financial profile, first allocation plan, emergency-fund goal and opening balance together without committing partial data."""
    existing_profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == user_id).first()

    if existing_profile is not None:
        raise OnboardingConflictError("Onboarding has already been started or completed")

    emergency_target = _calculate_emergency_fund_target(data)
    completed_at = datetime.now(timezone.utc)

    profile = FinancialProfile(
        user_id=user_id,
        currency=data.currency,
        expected_monthly_income_cents=data.expected_monthly_income_cents,
        onboarding_completed_at=completed_at,
    )

    allocation = AllocationPlan(
        user_id=user_id,
        essentials_pct=data.essentials_pct,
        lifestyle_pct=data.lifestyle_pct,
        investments_pct=data.investments_pct,
        effective_from=onboarding_date,
    )

    emergency_goal = Goal(
        user_id=user_id,
        name="Emergency Fund",
        type_name="Emergency Fund",
        linked_track_kind="essentials",
        system_role="emergency_fund",
        target_cents=emergency_target,
        status="completed" if data.current_emergency_fund_cents >= emergency_target else "active",
    )

    db.add_all([profile, allocation, emergency_goal])
    db.flush()

    _create_opening_balance(
        db=db,
        user_id=user_id,
        data=data,
        allocation=allocation,
        emergency_goal=emergency_goal,
        onboarding_date=onboarding_date,
    )

    db.flush()

    return OnboardingResultOut(
        profile=FinancialProfileOut.model_validate(profile),
        allocation_plan=AllocationPlanOut.model_validate(allocation),
        emergency_fund_goal=_build_emergency_goal_output(emergency_goal, data.current_emergency_fund_cents),
        current_total_money_cents=data.current_total_money_cents,
    )