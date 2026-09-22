from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.income import sync_current_month_base_income
from app.db.session import get_db
from app.models.budget import BudgetSplit, EmergencyFundConfig
from app.models.income import IncomeConfig
from app.models.user import User
from app.schemas.budget import BudgetSplitOut
from app.schemas.onboarding import (
    OnboardingRequest,
    OnboardingStatus,
)

router = APIRouter(
    prefix="/onboarding",
    tags=["onboarding"],
)


@router.post("", response_model=OnboardingStatus)
def submit_onboarding(
    payload: OnboardingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    income_config = db.query(IncomeConfig).first()

    if income_config:
        income_config.monthly_income_cents = (
            payload.monthly_income_cents
        )
        income_config.available_savings_cents = (
            payload.available_savings_cents
        )
    else:
        income_config = IncomeConfig(
            monthly_income_cents=(
                payload.monthly_income_cents
            ),
            available_savings_cents=(
                payload.available_savings_cents
            ),
        )
        db.add(income_config)

    essentials_monthly_cents = (
        payload.monthly_income_cents
        * payload.essentials_pct
        // 100
    )

    target_cents = (
        essentials_monthly_cents
        * payload.ef_multiplier
    )

    ef_config = db.query(EmergencyFundConfig).first()

    if ef_config:
        ef_config.multiplier = payload.ef_multiplier
        ef_config.target_cents = target_cents
        ef_config.current_balance_cents = (
            payload.current_ef_balance_cents
        )
    else:
        ef_config = EmergencyFundConfig(
            multiplier=payload.ef_multiplier,
            target_cents=target_cents,
            current_balance_cents=(
                payload.current_ef_balance_cents
            ),
        )
        db.add(ef_config)

    split = (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date == today)
        .first()
    )

    if split:
        split.freedom_funds_pct = (
            payload.freedom_funds_pct
        )
        split.essentials_pct = payload.essentials_pct
        split.lifestyle_pct = payload.lifestyle_pct
    else:
        split = BudgetSplit(
            freedom_funds_pct=(
                payload.freedom_funds_pct
            ),
            essentials_pct=payload.essentials_pct,
            lifestyle_pct=payload.lifestyle_pct,
            effective_date=today,
        )
        db.add(split)

    db.flush()

    sync_current_month_base_income(
        db=db,
        year=today.year,
        month=today.month,
    )

    db.commit()
    db.refresh(income_config)
    db.refresh(ef_config)
    db.refresh(split)

    return OnboardingStatus(
        is_onboarded=True,
        monthly_income_cents=(
            income_config.monthly_income_cents
        ),
        available_savings_cents=(
            income_config.available_savings_cents
        ),
        ef_multiplier=ef_config.multiplier,
        ef_target_cents=ef_config.target_cents,
        current_ef_balance_cents=(
            ef_config.current_balance_cents
        ),
        current_budget_split=(
            BudgetSplitOut.model_validate(split)
        ),
    )


@router.get("/status",response_model=OnboardingStatus)
def onboarding_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    income_config = db.query(IncomeConfig).first()
    ef_config = db.query(EmergencyFundConfig).first()

    current_split = (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date <= date.today())
        .order_by(BudgetSplit.effective_date.desc())
        .first()
    )

    is_onboarded = (
        income_config is not None
        and ef_config is not None
        and current_split is not None
    )

    return OnboardingStatus(
        is_onboarded=is_onboarded,
        monthly_income_cents=(
            income_config.monthly_income_cents
            if income_config
            else None
        ),
        available_savings_cents=(
            income_config.available_savings_cents
            if income_config
            else None
        ),
        ef_multiplier=(
            ef_config.multiplier
            if ef_config
            else None
        ),
        ef_target_cents=(
            ef_config.target_cents
            if ef_config
            else None
        ),
        current_ef_balance_cents=(
            ef_config.current_balance_cents
            if ef_config
            else None
        ),
        current_budget_split=(
            BudgetSplitOut.model_validate(current_split)
            if current_split
            else None
        ),
    )