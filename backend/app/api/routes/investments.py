from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.investment import Investment, InvestmentType
from app.models.user import User
from app.schemas.investment import (
    InvestmentCreate,
    InvestmentOut,
    InvestmentSummary,
    InvestmentTypeOut,
    InvestmentTypeTotal,
)

router = APIRouter(prefix="/investments", tags=["investments"])


@router.get("/types", response_model=list[InvestmentTypeOut])
def list_investment_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(InvestmentType).order_by(InvestmentType.name).all()


@router.post("", response_model=InvestmentOut)
def create_investment(
    payload: InvestmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(InvestmentType).filter(InvestmentType.id == payload.investment_type_id).first():
        raise HTTPException(status_code=400, detail="Invalid investment_type_id")
    investment = Investment(**payload.model_dump())
    db.add(investment)
    db.commit()
    db.refresh(investment)
    return investment


@router.get("", response_model=list[InvestmentOut])
def list_investments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Investment).order_by(Investment.date.desc()).all()


# must stay above /{investment_id} — same route-order rule as everywhere else
@router.get("/summary", response_model=InvestmentSummary)
def investment_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Investment, InvestmentType.name)
        .join(InvestmentType, Investment.investment_type_id == InvestmentType.id)
        .all()
    )
    totals: dict[str, int] = {}
    for inv, type_name in rows:
        totals[type_name] = totals.get(type_name, 0) + inv.amount_cents
    return InvestmentSummary(
        total_invested_cents=sum(totals.values()),
        by_type=[InvestmentTypeTotal(type=name, amount_cents=amt) for name, amt in totals.items()],
    )


@router.delete("/{investment_id}", status_code=204)
def delete_investment(
    investment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    investment = db.query(Investment).filter(Investment.id == investment_id).first()
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    db.delete(investment)
    db.commit()
