from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.allocation import AllocationPlanCreate, AllocationPlanOut
from app.schemas.profile import FinancialProfileOut, FinancialProfileUpdate
from app.services.settings import SettingsConflictError, SettingsError, SettingsNotFoundError, create_allocation_plan, get_current_allocation_plan, get_profile, list_allocation_plans, update_profile


router = APIRouter(prefix="/settings", tags=["settings"])


def _raise_settings_error(exc: SettingsError) -> None:
    """Converts service errors into HTTP responses."""
    if isinstance(exc, SettingsNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, SettingsConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/profile", response_model=FinancialProfileOut)
def read_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return get_profile(db, current_user.id)
    except SettingsError as exc:
        _raise_settings_error(exc)


@router.patch("/profile", response_model=FinancialProfileOut)
def edit_profile(payload: FinancialProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = update_profile(db, current_user.id, payload)
        db.commit()
        return result
    except SettingsError as exc:
        db.rollback()
        _raise_settings_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/allocation-plans", response_model=AllocationPlanOut, status_code=status.HTTP_201_CREATED)
def add_allocation_plan(payload: AllocationPlanCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = create_allocation_plan(db, current_user.id, payload)
        db.commit()
        return result
    except SettingsError as exc:
        db.rollback()
        _raise_settings_error(exc)
    except Exception:
        db.rollback()
        raise


@router.get("/allocation-plans/current", response_model=AllocationPlanOut)
def read_current_allocation_plan(on_date: date | None = Query(default=None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return get_current_allocation_plan(db, current_user.id, on_date or date.today())
    except SettingsError as exc:
        _raise_settings_error(exc)


@router.get("/allocation-plans", response_model=list[AllocationPlanOut])
def read_allocation_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_allocation_plans(db, current_user.id)