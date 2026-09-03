from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.budget import BudgetSplit
from app.models.user import User
from app.schemas.budget import BudgetSplitCreate, BudgetSplitOut

router = APIRouter(prefix="/budget-splits", tags=["budget"])


@router.post("", response_model=BudgetSplitOut)
def create_budget_split(
    payload: BudgetSplitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    split = BudgetSplit(
        freedom_funds_pct=payload.freedom_funds_pct,
        essentials_pct=payload.essentials_pct,
        lifestyle_pct=payload.lifestyle_pct,
        effective_date=payload.effective_date or date.today(),
    )
    db.add(split)
    db.commit()
    db.refresh(split)
    return split


@router.get("", response_model=list[BudgetSplitOut])
def list_budget_splits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(BudgetSplit).order_by(BudgetSplit.effective_date.desc()).all()


@router.get("/current", response_model=BudgetSplitOut)
def current_budget_split(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    split = (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date <= date.today())
        .order_by(BudgetSplit.effective_date.desc())
        .first()
    )
    if not split:
        raise HTTPException(status_code=404, detail="No budget split set yet")
    return split
