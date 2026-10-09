from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.investment import InvestmentAssetCreate, InvestmentAssetOut, InvestmentAssetUpdate, InvestmentFeeCreate, InvestmentIncomeCreate, InvestmentTradeCreate, InvestmentTransactionOut, InvestmentUnitsChangeCreate, InvestmentValuationCreate, InvestmentValuationOut
from app.schemas.money_action import EventCorrectionCreate
from app.services.investments import InvestmentConflictError, InvestmentError, InvestmentNotFoundError, add_valuation, create_asset, get_asset, list_assets, list_transactions, list_valuations, record_fee, record_income, record_trade, record_units_change, reverse_transaction, update_asset


router = APIRouter(prefix="/investments", tags=["investments"])


def _raise_investment_error(exc: InvestmentError) -> None:
    """Converts investment service errors into HTTP responses."""
    if isinstance(exc, InvestmentNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, InvestmentConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("", response_model=list[InvestmentAssetOut])
def read_assets(as_of_date: date | None = Query(default=None), include_archived: bool = Query(default=False), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return list_assets(db, current_user.id, as_of_date or date.today(), include_archived)
    except InvestmentError as exc:
        _raise_investment_error(exc)


@router.post("", response_model=InvestmentAssetOut, status_code=status.HTTP_201_CREATED)
def add_asset(payload: InvestmentAssetCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = create_asset(db, current_user.id, payload, date.today())
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise


@router.get("/{asset_id}", response_model=InvestmentAssetOut)
def read_asset(asset_id: int = Path(gt=0), as_of_date: date | None = Query(default=None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return get_asset(db, current_user.id, asset_id, as_of_date or date.today())
    except InvestmentError as exc:
        _raise_investment_error(exc)


@router.patch("/{asset_id}", response_model=InvestmentAssetOut)
def edit_asset(payload: InvestmentAssetUpdate, asset_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = update_asset(db, current_user.id, asset_id, payload, date.today())
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{asset_id}/trades", response_model=InvestmentTransactionOut, status_code=status.HTTP_201_CREATED)
def add_trade(payload: InvestmentTradeCreate, asset_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = record_trade(db, current_user.id, asset_id, payload, idempotency_key)
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{asset_id}/income", response_model=InvestmentTransactionOut, status_code=status.HTTP_201_CREATED)
def add_income(payload: InvestmentIncomeCreate, asset_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = record_income(db, current_user.id, asset_id, payload, idempotency_key)
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{asset_id}/fees", response_model=InvestmentTransactionOut, status_code=status.HTTP_201_CREATED)
def add_fee(payload: InvestmentFeeCreate, asset_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = record_fee(db, current_user.id, asset_id, payload, idempotency_key)
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{asset_id}/unit-changes", response_model=InvestmentTransactionOut, status_code=status.HTTP_201_CREATED)
def add_unit_change(payload: InvestmentUnitsChangeCreate, asset_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = record_units_change(db, current_user.id, asset_id, payload)
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{asset_id}/valuations", response_model=InvestmentValuationOut, status_code=status.HTTP_201_CREATED)
def create_valuation(payload: InvestmentValuationCreate, asset_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = add_valuation(db, current_user.id, asset_id, payload)
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise


@router.get("/{asset_id}/transactions", response_model=list[InvestmentTransactionOut])
def read_transactions(asset_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return list_transactions(db, current_user.id, asset_id)
    except InvestmentError as exc:
        _raise_investment_error(exc)


@router.get("/{asset_id}/valuations", response_model=list[InvestmentValuationOut])
def read_valuations(asset_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return list_valuations(db, current_user.id, asset_id)
    except InvestmentError as exc:
        _raise_investment_error(exc)


@router.post("/transactions/{transaction_id}/reversal", response_model=InvestmentTransactionOut, status_code=status.HTTP_201_CREATED)
def cancel_transaction(payload: EventCorrectionCreate, transaction_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = reverse_transaction(db, current_user.id, transaction_id, payload, idempotency_key)
        db.commit()
        return result
    except InvestmentError as exc:
        db.rollback()
        _raise_investment_error(exc)
    except Exception:
        db.rollback()
        raise