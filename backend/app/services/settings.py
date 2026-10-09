from datetime import date

from sqlalchemy.orm import Session

from app.models.allocation import AllocationPlan
from app.models.profile import FinancialProfile
from app.schemas.allocation import AllocationPlanCreate, AllocationPlanOut
from app.schemas.profile import FinancialProfileOut, FinancialProfileUpdate


class SettingsError(Exception):
    """Base error for invalid financial-setting operations."""


class SettingsNotFoundError(SettingsError):
    """Raised when required profile or allocation settings do not exist."""


class SettingsConflictError(SettingsError):
    """Raised when a setting conflicts with existing financial history."""


def _get_profile(db: Session, user_id: int) -> FinancialProfile:
    """Loads the user's financial profile created during onboarding."""
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        raise SettingsNotFoundError("Financial profile was not found")

    return profile


def get_profile(db: Session, user_id: int) -> FinancialProfileOut:
    """Returns the user's currency and expected monthly income."""
    return FinancialProfileOut.model_validate(_get_profile(db, user_id))


def update_profile(
    db: Session,
    user_id: int,
    data: FinancialProfileUpdate,
) -> FinancialProfileOut:
    """Updates expected income while preventing existing money from being reinterpreted as another currency."""
    profile = _get_profile(db, user_id)
    changes = data.model_dump(exclude_unset=True)

    if "currency" in changes and changes["currency"] != profile.currency:
        raise SettingsConflictError(
            "Currency cannot be changed after onboarding because existing amounts would require conversion"
        )

    for field, value in changes.items():
        setattr(profile, field, value)

    db.flush()

    return FinancialProfileOut.model_validate(profile)


def create_allocation_plan(
    db: Session,
    user_id: int,
    data: AllocationPlanCreate,
) -> AllocationPlanOut:
    """Creates a new dated allocation plan without changing historical plans or existing money events."""
    duplicate = (
        db.query(AllocationPlan.id)
        .filter(
            AllocationPlan.user_id == user_id,
            AllocationPlan.effective_from == data.effective_from,
        )
        .first()
    )

    if duplicate is not None:
        raise SettingsConflictError(
            "An allocation plan already exists for this effective date"
        )

    plan = AllocationPlan(
        user_id=user_id,
        essentials_pct=data.essentials_pct,
        lifestyle_pct=data.lifestyle_pct,
        investments_pct=data.investments_pct,
        effective_from=data.effective_from,
    )

    db.add(plan)
    db.flush()

    return AllocationPlanOut.model_validate(plan)


def get_current_allocation_plan(
    db: Session,
    user_id: int,
    on_date: date,
) -> AllocationPlanOut:
    """Returns the newest allocation plan effective on the requested date."""
    plan = (
        db.query(AllocationPlan)
        .filter(
            AllocationPlan.user_id == user_id,
            AllocationPlan.effective_from <= on_date,
        )
        .order_by(
            AllocationPlan.effective_from.desc(),
            AllocationPlan.id.desc(),
        )
        .first()
    )

    if plan is None:
        raise SettingsNotFoundError(
            "No allocation plan exists for this date"
        )

    return AllocationPlanOut.model_validate(plan)


def list_allocation_plans(
    db: Session,
    user_id: int,
) -> list[AllocationPlanOut]:
    """Returns the complete allocation history, newest plan first."""
    plans = (
        db.query(AllocationPlan)
        .filter(AllocationPlan.user_id == user_id)
        .order_by(
            AllocationPlan.effective_from.desc(),
            AllocationPlan.id.desc(),
        )
        .all()
    )

    return [AllocationPlanOut.model_validate(plan) for plan in plans]