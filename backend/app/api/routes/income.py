from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import IncomeSource
from app.models.income import IncomeEntry, IncomeModeConfig
from app.models.user import User
from app.schemas.income import (
    FixedSalaryOut,
    FixedSalaryUpdate,
    IncomeEntryCreate,
    IncomeEntryOut,
    IncomeEntryUpdate,
    MonthlyIncomeSummary,
)

router = APIRouter(prefix="/income-entries", tags=["income"])


def _ensure_fixed_entry(db: Session, year: int, month: int) -> None:
    """Auto-creates this month's fixed-salary entry the first time it's looked up, if one isn't set."""
    today = date.today()
    target = date(year, month, 1)
    if target != today.replace(day=1):
        return
    mode_config = db.query(IncomeModeConfig).first()
    if not mode_config or not mode_config.fixed_salary_cents:
        return
    exists = (
        db.query(IncomeEntry)
        .filter(IncomeEntry.source == IncomeSource.FIXED)
        .filter(extract("year", IncomeEntry.date) == year)
        .filter(extract("month", IncomeEntry.date) == month)
        .first()
    )
    if exists:
        return
    db.add(IncomeEntry(
        source=IncomeSource.FIXED,
        amount_cents=mode_config.fixed_salary_cents,
        date=target,
        note="Auto-generated fixed salary",
    ))
    db.commit()


@router.get("/fixed-salary", response_model=FixedSalaryOut)
def get_fixed_salary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mode_config = db.query(IncomeModeConfig).first()
    return FixedSalaryOut(fixed_salary_cents=mode_config.fixed_salary_cents if mode_config else None)


@router.patch("/fixed-salary", response_model=FixedSalaryOut)
def set_fixed_salary(
    payload: FixedSalaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mode_config = db.query(IncomeModeConfig).first()
    if not mode_config:
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    mode_config.fixed_salary_cents = payload.fixed_salary_cents
    db.commit()
    return FixedSalaryOut(fixed_salary_cents=mode_config.fixed_salary_cents)


@router.post("", response_model=IncomeEntryOut)
def create_income_entry(
    payload: IncomeEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = IncomeEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[IncomeEntryOut])
def list_income_entries(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if year is not None and month is not None:
        _ensure_fixed_entry(db, year, month)
    query = db.query(IncomeEntry)
    if year is not None:
        query = query.filter(extract("year", IncomeEntry.date) == year)
    if month is not None:
        query = query.filter(extract("month", IncomeEntry.date) == month)
    return query.order_by(IncomeEntry.date.desc()).all()


@router.get("/summary", response_model=MonthlyIncomeSummary)
def monthly_income_summary(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    year = year or today.year
    month = month or today.month
    _ensure_fixed_entry(db, year, month)

    entries = (
        db.query(IncomeEntry)
        .filter(extract("year", IncomeEntry.date) == year)
        .filter(extract("month", IncomeEntry.date) == month)
        .all()
    )
    fixed_cents = sum(e.amount_cents for e in entries if e.source == IncomeSource.FIXED)
    freelance_cents = sum(e.amount_cents for e in entries if e.source == IncomeSource.FREELANCE)

    return MonthlyIncomeSummary(
        year=year,
        month=month,
        total_cents=fixed_cents + freelance_cents,
        fixed_cents=fixed_cents,
        freelance_cents=freelance_cents,
        entry_count=len(entries),
    )


@router.get("/{entry_id}", response_model=IncomeEntryOut)
def get_income_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(IncomeEntry).filter(IncomeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Income entry not found")
    return entry


@router.patch("/{entry_id}", response_model=IncomeEntryOut)
def update_income_entry(
    entry_id: int,
    payload: IncomeEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(IncomeEntry).filter(IncomeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Income entry not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_income_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(IncomeEntry).filter(IncomeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Income entry not found")
    db.delete(entry)
    db.commit()
