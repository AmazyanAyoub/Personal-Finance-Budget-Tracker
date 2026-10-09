from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalMoneyActionCreate, GoalOut, GoalUpdate
from app.services.goals import GoalConflictError, GoalError, GoalNotFoundError, create_goal, get_goal, list_goals, release_from_goal, reserve_for_goal, spend_from_goal, update_goal


router = APIRouter(prefix="/goals", tags=["goals"])


def _raise_goal_error(exc: GoalError) -> None:
    """Converts goal service errors into HTTP responses."""
    if isinstance(exc, GoalNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, GoalConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("", response_model=list[GoalOut])
def read_goals(include_archived: bool = Query(default=False), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return list_goals(db, current_user.id, include_archived)
    except GoalError as exc:
        _raise_goal_error(exc)


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def add_goal(payload: GoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = create_goal(db, current_user.id, payload)
        db.commit()
        return result
    except GoalError as exc:
        db.rollback()
        _raise_goal_error(exc)
    except Exception:
        db.rollback()
        raise


@router.get("/{goal_id}", response_model=GoalOut)
def read_goal(goal_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return get_goal(db, current_user.id, goal_id)
    except GoalError as exc:
        _raise_goal_error(exc)


@router.patch("/{goal_id}", response_model=GoalOut)
def edit_goal(payload: GoalUpdate, goal_id: int = Path(gt=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = update_goal(db, current_user.id, goal_id, payload)
        db.commit()
        return result
    except GoalError as exc:
        db.rollback()
        _raise_goal_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{goal_id}/reserve", response_model=GoalOut)
def reserve_money(payload: GoalMoneyActionCreate, goal_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = reserve_for_goal(db, current_user.id, goal_id, payload, idempotency_key)
        db.commit()
        return result
    except GoalError as exc:
        db.rollback()
        _raise_goal_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{goal_id}/release", response_model=GoalOut)
def release_money(payload: GoalMoneyActionCreate, goal_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = release_from_goal(db, current_user.id, goal_id, payload, idempotency_key)
        db.commit()
        return result
    except GoalError as exc:
        db.rollback()
        _raise_goal_error(exc)
    except Exception:
        db.rollback()
        raise


@router.post("/{goal_id}/spend", response_model=GoalOut)
def spend_money(payload: GoalMoneyActionCreate, goal_id: int = Path(gt=0), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = spend_from_goal(db, current_user.id, goal_id, payload, idempotency_key)
        db.commit()
        return result
    except GoalError as exc:
        db.rollback()
        _raise_goal_error(exc)
    except Exception:
        db.rollback()
        raise