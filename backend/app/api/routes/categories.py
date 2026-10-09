from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services.categories import CategoryConflictError, CategoryError, CategoryNotFoundError, create_category, get_category, list_categories, update_category


router = APIRouter(prefix="/categories", tags=["categories"])


def _raise_category_error(exc: CategoryError) -> None:
    """Converts category service errors into HTTP responses."""
    if isinstance(exc, CategoryNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, CategoryConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("", response_model=list[CategoryOut])
def read_categories(include_inactive: bool = Query(default=False), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_categories(db, current_user.id, include_inactive)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def add_category(payload: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = create_category(db, current_user.id, payload)
        db.commit()
        return result
    except CategoryError as exc:
        db.rollback()
        _raise_category_error(exc)
    except Exception:
        db.rollback()
        raise


@router.get("/{category_id}", response_model=CategoryOut)
def read_category(category_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return get_category(db, current_user.id, category_id)
    except CategoryError as exc:
        _raise_category_error(exc)


@router.patch("/{category_id}", response_model=CategoryOut)
def edit_category(payload: CategoryUpdate, category_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = update_category(db, current_user.id, category_id, payload)
        db.commit()
        return result
    except CategoryError as exc:
        db.rollback()
        _raise_category_error(exc)
    except Exception:
        db.rollback()
        raise