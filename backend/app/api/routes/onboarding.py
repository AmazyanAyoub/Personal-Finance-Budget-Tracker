from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.onboarding import OnboardingRequest, OnboardingResultOut, OnboardingStatusOut
from app.services.onboarding import OnboardingConflictError, OnboardingError, complete_onboarding, get_onboarding_status


router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/status", response_model=OnboardingStatusOut)
def onboarding_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_onboarding_status(db, current_user.id)


@router.post("", response_model=OnboardingResultOut, status_code=status.HTTP_201_CREATED)
def submit_onboarding(payload: OnboardingRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = complete_onboarding(db, current_user.id, payload, date.today())
        db.commit()
        return result
    except OnboardingConflictError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except OnboardingError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception:
        db.rollback()
        raise