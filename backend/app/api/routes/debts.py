from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.debt import DebtCreate, DebtOut, DebtPaymentCreate, DebtUpdate
from app.services.debts import DebtConflictError, DebtError, DebtNotFoundError, create_debt, get_debt, list_debts, pay_debt, update_debt


router = APIRouter(prefix="/debts", tags=["debts"])


def _raise_debt_error(exc: DebtError) -> None:
    """Converts debt service errors into HTTP responses."""
    if isinstance(exc, DebtNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, DebtConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("", response_model=list[DebtOut])
def read_debts(include_archived: bool = Query(default=False), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return list_debts(db, current_user.id, include_archived)
    except DebtError as exc:
        _raise_debt_error(exc)


@router.post("", response_model=DebtOut, status_code=status.HTTP_201_CREATED)
def add_debt(payload: DebtCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = create_debt(db, current_user.id, payload)
        db.commit()
        return result
    except DebtError as exc:
        db.rollback()
        _raise_debt_error(exc)
    except Exception:
        db.rollback()
        raise


@router.get("/{debt_id}", response_model=DebtOut)
def read_debt(debt_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return get_debt(db, current_user.id, debt_id)
    except DebtError as exc:
        _raise_debt_error(exc)


@router.patch("/{debt_id}", response_model=DebtOut)
def edit_debt(payload: DebtUpdate, debt_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = update_debt(db, current_user.id, debt_id, payload)
        db.commit()
        return result
    except DebtError as exc:
        db.rollback()
        _raise_debt_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{debt_id}/payments", response_model=DebtOut)
def record_payment(payload: DebtPaymentCreate, debt_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = pay_debt(db, current_user.id, debt_id, payload, idempotency_key)
        db.commit()
        return result
    except DebtError as exc:
        db.rollback()
        _raise_debt_error(exc)
    except Exception:
        db.rollback()
        raise