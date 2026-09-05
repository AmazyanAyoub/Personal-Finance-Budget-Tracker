from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.debt import Debt, DebtPayment
from app.models.user import User
from app.schemas.debt import DebtCreate, DebtOut, DebtPaymentCreate, DebtPaymentOut, DebtUpdate

router = APIRouter(prefix="/debts", tags=["debts"])


def _to_debt_out(debt: Debt) -> DebtOut:
    total_paid = sum(p.amount_cents for p in debt.payments)
    current_balance = max(debt.balance_cents - total_paid, 0)
    progress_pct = min(round((total_paid / debt.balance_cents) * 100, 1), 100.0) if debt.balance_cents else 0.0
    return DebtOut(
        id=debt.id,
        name=debt.name,
        starting_balance_cents=debt.balance_cents,
        current_balance_cents=current_balance,
        monthly_payment_cents=debt.monthly_payment_cents,
        payoff_target_date=debt.payoff_target_date,
        total_paid_cents=total_paid,
        progress_pct=progress_pct,
        is_paid_off=current_balance <= 0,
        created_at=debt.created_at,
    )


@router.post("", response_model=DebtOut)
def create_debt(
    payload: DebtCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = Debt(**payload.model_dump())
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return _to_debt_out(debt)


@router.get("", response_model=list[DebtOut])
def list_debts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debts = db.query(Debt).order_by(Debt.created_at.desc()).all()
    return [_to_debt_out(d) for d in debts]


@router.get("/{debt_id}", response_model=DebtOut)
def get_debt(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    return _to_debt_out(debt)


@router.patch("/{debt_id}", response_model=DebtOut)
def update_debt(
    debt_id: int,
    payload: DebtUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(debt, field, value)
    db.commit()
    db.refresh(debt)
    return _to_debt_out(debt)


@router.delete("/{debt_id}", status_code=204)
def delete_debt(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    db.delete(debt)
    db.commit()


@router.post("/{debt_id}/payments", response_model=DebtOut)
def log_payment(
    debt_id: int,
    payload: DebtPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    db.add(DebtPayment(debt_id=debt_id, **payload.model_dump()))
    db.commit()
    db.refresh(debt)
    return _to_debt_out(debt)


@router.get("/{debt_id}/payments", response_model=list[DebtPaymentOut])
def list_payments(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    return db.query(DebtPayment).filter(DebtPayment.debt_id == debt_id).order_by(DebtPayment.date.desc()).all()
