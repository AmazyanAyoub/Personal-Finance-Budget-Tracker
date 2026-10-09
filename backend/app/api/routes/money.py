from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.money_action import BalanceAdjustmentCreate, EventCorrectionCreate, ExpenseCreate, IncomeCreate, TrackTransferCreate
from app.schemas.money_event import MoneyEventOut
from app.services.ledger import LedgerConflictError, LedgerError, LedgerNotFoundError, adjust_total_balance, get_event, list_events, record_expense, record_income, reverse_event, transfer_between_tracks


router = APIRouter(prefix="/money", tags=["money"])


def _raise_ledger_error(exc: LedgerError) -> None:
    """Converts ledger service errors into HTTP responses."""
    if isinstance(exc, LedgerNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, LedgerConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/income", response_model=MoneyEventOut, status_code=status.HTTP_201_CREATED)
def add_income(payload: IncomeCreate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        event = record_income(db, current_user.id, payload, idempotency_key)
        result = MoneyEventOut.model_validate(event)
        db.commit()
        return result
    except LedgerError as exc:
        db.rollback()
        _raise_ledger_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/expenses", response_model=MoneyEventOut, status_code=status.HTTP_201_CREATED)
def add_expense(payload: ExpenseCreate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        event = record_expense(db, current_user.id, payload, idempotency_key)
        result = MoneyEventOut.model_validate(event)
        db.commit()
        return result
    except LedgerError as exc:
        db.rollback()
        _raise_ledger_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/transfers", response_model=MoneyEventOut, status_code=status.HTTP_201_CREATED)
def transfer_money(payload: TrackTransferCreate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        event = transfer_between_tracks(db, current_user.id, payload, idempotency_key)
        result = MoneyEventOut.model_validate(event)
        db.commit()
        return result
    except LedgerError as exc:
        db.rollback()
        _raise_ledger_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/balance-adjustments", response_model=MoneyEventOut, status_code=status.HTTP_201_CREATED)
def correct_balance(payload: BalanceAdjustmentCreate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        event = adjust_total_balance(db, current_user.id, payload, idempotency_key)
        result = MoneyEventOut.model_validate(event)
        db.commit()
        return result
    except LedgerError as exc:
        db.rollback()
        _raise_ledger_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/events/{event_id}/reversal", response_model=MoneyEventOut, status_code=status.HTTP_201_CREATED)
def cancel_event(payload: EventCorrectionCreate, event_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        event = reverse_event(db, current_user.id, event_id, payload, idempotency_key)
        result = MoneyEventOut.model_validate(event)
        db.commit()
        return result
    except LedgerError as exc:
        db.rollback()
        _raise_ledger_error(exc)
    except Exception:
        db.rollback()
        raise


@router.get("/events/{event_id}", response_model=MoneyEventOut)
def read_event(event_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return MoneyEventOut.model_validate(get_event(db, current_user.id, event_id))
    except LedgerError as exc:
        _raise_ledger_error(exc)


@router.get("/events", response_model=list[MoneyEventOut])
def read_events(start_date: date | None = Query(default=None), end_date: date | None = Query(default=None), limit: int = Query(default=100, ge=1, le=500), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        events = list_events(db, current_user.id, start_date, end_date, limit)
        return [MoneyEventOut.model_validate(event) for event in events]
    except LedgerError as exc:
        _raise_ledger_error(exc)