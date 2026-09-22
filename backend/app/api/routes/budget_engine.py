from datetime import date
from typing import NamedTuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.budget import BudgetSplit, EmergencyFundConfig
from app.models.income import IncomeEntry
from app.models.user import User
from app.schemas.budget_engine import BudgetEngineStatus, EFBalanceUpdate
from app.core.income import sync_current_month_base_income

router = APIRouter(prefix="/budget-engine", tags=["budget-engine"])


def _current_split(db: Session) -> BudgetSplit | None:
    return (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date <= date.today())
        .order_by(BudgetSplit.effective_date.desc())
        .first()
    )


def _monthly_income_cents(
    db: Session,
    year: int,
    month: int,
) -> int:
    changed = sync_current_month_base_income(
        db=db,
        year=year,
        month=month,
    )

    if changed:
        db.commit()

    entries = (
        db.query(IncomeEntry)
        .filter(
            extract("year", IncomeEntry.date) == year
        )
        .filter(
            extract("month", IncomeEntry.date) == month
        )
        .all()
    )

    return sum(entry.amount_cents for entry in entries)


class BudgetRecommendation(NamedTuple):
    ef_gap_cents: int
    ef_is_met: bool
    projected_months_to_target: float | None
    recommended_ef_cents: int
    recommended_investments_cents: int


def calculate_budget_recommendation(
    freedom_funds_cents: int,
    ef_target_cents: int,
    ef_current_balance_cents: int,
) -> BudgetRecommendation:
    ef_gap = max(
        ef_target_cents - ef_current_balance_cents,
        0,
    )
    ef_is_met = ef_current_balance_cents >= ef_target_cents

    projected_months = None
    if not ef_is_met and freedom_funds_cents > 0:
        projected_months = round(
            ef_gap / freedom_funds_cents,
            1,
        )

    return BudgetRecommendation(
        ef_gap_cents=ef_gap,
        ef_is_met=ef_is_met,
        projected_months_to_target=projected_months,
        recommended_ef_cents=(
            0 if ef_is_met else freedom_funds_cents
        ),
        recommended_investments_cents=(
            freedom_funds_cents if ef_is_met else 0
        ),
    )


@router.get("/status", response_model=BudgetEngineStatus)
def get_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    split = _current_split(db)
    ef_config = db.query(EmergencyFundConfig).first()

    if not split or not ef_config:
        raise HTTPException(
            status_code=400,
            detail="Complete onboarding first",
        )

    income_cents = _monthly_income_cents(
        db,
        today.year,
        today.month,
    )

    freedom_funds_cents = (
        income_cents * split.freedom_funds_pct // 100
    )
    essentials_cents = (
        income_cents * split.essentials_pct // 100
    )
    lifestyle_cents = (
        income_cents * split.lifestyle_pct // 100
    )

    recommendation = calculate_budget_recommendation(
        freedom_funds_cents=freedom_funds_cents,
        ef_target_cents=ef_config.target_cents,
        ef_current_balance_cents=ef_config.current_balance_cents,
    )

    return BudgetEngineStatus(
        year=today.year,
        month=today.month,
        monthly_income_cents=income_cents,
        freedom_funds_cents=freedom_funds_cents,
        essentials_cents=essentials_cents,
        lifestyle_cents=lifestyle_cents,
        ef_target_cents=ef_config.target_cents,
        ef_current_balance_cents=ef_config.current_balance_cents,
        ef_gap_cents=recommendation.ef_gap_cents,
        ef_is_met=recommendation.ef_is_met,
        projected_months_to_target=(
            recommendation.projected_months_to_target
        ),
        recommended_ef_cents=(
            recommendation.recommended_ef_cents
        ),
        recommended_investments_cents=(
            recommendation.recommended_investments_cents
        ),
    )


@router.patch(
    "/ef-balance",
    response_model=BudgetEngineStatus,
)
def update_ef_balance(
    payload: EFBalanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ef_config = db.query(EmergencyFundConfig).first()

    if not ef_config:
        raise HTTPException(
            status_code=400,
            detail="Complete onboarding first",
        )

    ef_config.current_balance_cents = payload.current_balance_cents
    db.commit()

    return get_status(
        db=db,
        current_user=current_user,
    )