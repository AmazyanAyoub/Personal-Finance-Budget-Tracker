from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.budget import BudgetSplit, EmergencyFundConfig
from app.models.income import IncomeModeConfig
from app.models.user import User
from app.schemas.budget import BudgetSplitOut
from app.schemas.onboarding import OnboardingRequest, OnboardingStatus

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("", response_model=OnboardingStatus)
def submit_onboarding(
    payload: OnboardingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mode_config = db.query(IncomeModeConfig).first()
    if mode_config:
        mode_config.mode = payload.income_mode
    else:
        mode_config = IncomeModeConfig(mode=payload.income_mode)
        db.add(mode_config)

    # EF target computed ONCE here, from the one-time estimate — never recomputed automatically elsewhere
    essentials_once = payload.estimated_monthly_income_cents * payload.essentials_pct // 100
    target_cents = essentials_once * payload.ef_multiplier

    ef_config = db.query(EmergencyFundConfig).first()
    if ef_config:
        ef_config.multiplier = payload.ef_multiplier
        ef_config.estimated_monthly_income_cents = payload.estimated_monthly_income_cents
        ef_config.target_cents = target_cents
        # current_balance_cents intentionally left untouched on resubmit
    else:
        ef_config = EmergencyFundConfig(
            multiplier=payload.ef_multiplier,
            estimated_monthly_income_cents=payload.estimated_monthly_income_cents,
            target_cents=target_cents,
            current_balance_cents=0,
        )
        db.add(ef_config)

    split = BudgetSplit(
        freedom_funds_pct=payload.freedom_funds_pct,
        essentials_pct=payload.essentials_pct,
        lifestyle_pct=payload.lifestyle_pct,
        effective_date=date.today(),
    )
    db.add(split)

    db.commit()
    db.refresh(split)
    db.refresh(ef_config)

    return OnboardingStatus(
        is_onboarded=True,
        income_mode=mode_config.mode,
        ef_multiplier=ef_config.multiplier,
        ef_target_cents=ef_config.target_cents,
        current_budget_split=BudgetSplitOut.model_validate(split),
    )


@router.get("/status", response_model=OnboardingStatus)
def onboarding_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mode_config = db.query(IncomeModeConfig).first()
    ef_config = db.query(EmergencyFundConfig).first()
    current_split = (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date <= date.today())
        .order_by(BudgetSplit.effective_date.desc())
        .first()
    )

    is_onboarded = mode_config is not None and ef_config is not None and current_split is not None

    return OnboardingStatus(
        is_onboarded=is_onboarded,
        income_mode=mode_config.mode if mode_config else None,
        ef_multiplier=ef_config.multiplier if ef_config else None,
        ef_target_cents=ef_config.target_cents if ef_config else None,
        current_budget_split=BudgetSplitOut.model_validate(current_split) if current_split else None,
    )
