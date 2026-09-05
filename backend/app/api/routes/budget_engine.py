from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.budget import BudgetSplit, EmergencyFundConfig, FreedomFundsAllocation
from app.models.income import IncomeEntry
from app.models.user import User
from app.schemas.budget_engine import (
    BudgetEngineStatus,
    EFBalanceUpdate,
    FreedomFundsAllocationCreate,
    FreedomFundsAllocationOut,
)

router = APIRouter(prefix="/budget-engine", tags=["budget-engine"])


def _current_split(db: Session) -> BudgetSplit | None:
    return (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date <= date.today())
        .order_by(BudgetSplit.effective_date.desc())
        .first()
    )


def _monthly_income_cents(db: Session, year: int, month: int) -> int:
    entries = (
        db.query(IncomeEntry)
        .filter(extract("year", IncomeEntry.date) == year)
        .filter(extract("month", IncomeEntry.date) == month)
        .all()
    )
    return sum(e.amount_cents for e in entries)


@router.get("/status", response_model=BudgetEngineStatus)
def get_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    split = _current_split(db)
    ef_config = db.query(EmergencyFundConfig).first()
    allocation = db.query(FreedomFundsAllocation).first()

    if not split or not ef_config:
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    # this month's REAL numbers — dynamic, correctly recomputed each call
    income_cents = _monthly_income_cents(db, today.year, today.month)
    freedom_funds_cents = income_cents * split.freedom_funds_pct // 100
    essentials_cents = income_cents * split.essentials_pct // 100
    lifestyle_cents = income_cents * split.lifestyle_pct // 100

    # EF target is FROZEN — set once at onboarding, read as-is, never recalculated here
    ef_target_cents = ef_config.target_cents
    ef_current = ef_config.current_balance_cents
    ef_gap = max(ef_target_cents - ef_current, 0)
    ef_is_met = ef_current >= ef_target_cents

    projected_months = None
    if not ef_is_met and freedom_funds_cents > 0:
        projected_months = round(ef_gap / freedom_funds_cents, 1)

    if ef_is_met and allocation:
        recommended_ef = 0
        recommended_investments = freedom_funds_cents * allocation.investments_pct // 100
        recommended_debt = freedom_funds_cents * allocation.debt_pct // 100
    else:
        recommended_ef = freedom_funds_cents
        recommended_investments = 0
        recommended_debt = 0

    return BudgetEngineStatus(
        year=today.year,
        month=today.month,
        monthly_income_cents=income_cents,
        freedom_funds_cents=freedom_funds_cents,
        essentials_cents=essentials_cents,
        lifestyle_cents=lifestyle_cents,
        ef_target_cents=ef_target_cents,
        ef_current_balance_cents=ef_current,
        ef_gap_cents=ef_gap,
        ef_is_met=ef_is_met,
        projected_months_to_target=projected_months,
        recommended_ef_cents=recommended_ef,
        recommended_investments_cents=recommended_investments,
        recommended_debt_cents=recommended_debt,
    )


@router.patch("/ef-balance", response_model=BudgetEngineStatus)
def update_ef_balance(
    payload: EFBalanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ef_config = db.query(EmergencyFundConfig).first()
    if not ef_config:
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    ef_config.current_balance_cents = payload.current_balance_cents
    db.commit()
    return get_status(db=db, current_user=current_user)


@router.post("/freedom-funds-allocation", response_model=FreedomFundsAllocationOut)
def set_allocation(
    payload: FreedomFundsAllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allocation = db.query(FreedomFundsAllocation).first()
    if allocation:
        allocation.investments_pct = payload.investments_pct
        allocation.debt_pct = payload.debt_pct
    else:
        allocation = FreedomFundsAllocation(**payload.model_dump())
        db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return allocation


@router.get("/freedom-funds-allocation", response_model=FreedomFundsAllocationOut)
def get_allocation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allocation = db.query(FreedomFundsAllocation).first()
    if not allocation:
        raise HTTPException(status_code=404, detail="No allocation set yet")
    return allocation
