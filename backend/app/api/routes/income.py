from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.income import sync_current_month_base_income
from app.db.session import get_db
from app.models.income import IncomeConfig, IncomeEntry
from app.models.user import User
from app.schemas.income import (
    AvailableSavingsOut,
    AvailableSavingsUpdate,
    IncomeEntryCreate,
    IncomeEntryOut,
    IncomeEntryUpdate,
    MonthlyIncomeOut,
    MonthlyIncomeSummary,
    MonthlyIncomeUpdate,
)

router = APIRouter(prefix="/income-entries", tags=["income"])


def sync_and_commit_current_month(
    db: Session,
    year: int,
    month: int,
) -> None:
    changed = sync_current_month_base_income(
        db=db,
        year=year,
        month=month,
    )

    if changed:
        db.commit()


@router.get(
    "/monthly-income",
    response_model=MonthlyIncomeOut,
)
def get_monthly_income(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = db.query(IncomeConfig).first()

    if not config:
        raise HTTPException(
            status_code=400,
            detail="Complete onboarding first",
        )

    return MonthlyIncomeOut(
        monthly_income_cents=config.monthly_income_cents,
    )


@router.patch(
    "/monthly-income",
    response_model=MonthlyIncomeOut,
)
def update_monthly_income(
    payload: MonthlyIncomeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = db.query(IncomeConfig).first()

    if not config:
        raise HTTPException(
            status_code=400,
            detail="Complete onboarding first",
        )

    config.monthly_income_cents = payload.monthly_income_cents

    today = date.today()

    sync_current_month_base_income(
        db=db,
        year=today.year,
        month=today.month,
    )

    db.commit()

    return MonthlyIncomeOut(
        monthly_income_cents=config.monthly_income_cents,
    )

@router.get(
    "/available-savings",
    response_model=AvailableSavingsOut,
)
def get_available_savings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = db.query(IncomeConfig).first()

    if not config:
        raise HTTPException(
            status_code=400,
            detail="Complete onboarding first",
        )

    return AvailableSavingsOut(
        available_savings_cents=(
            config.available_savings_cents
        ),
    )


@router.patch(
    "/available-savings",
    response_model=AvailableSavingsOut,
)
def update_available_savings(
    payload: AvailableSavingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = db.query(IncomeConfig).first()

    if not config:
        raise HTTPException(
            status_code=400,
            detail="Complete onboarding first",
        )

    config.available_savings_cents = (
        payload.available_savings_cents
    )

    db.commit()
    db.refresh(config)

    return AvailableSavingsOut(
        available_savings_cents=(
            config.available_savings_cents
        ),
    )

@router.post("", response_model=IncomeEntryOut)
def create_income_entry(
    payload: IncomeEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = IncomeEntry(
        name=payload.name,
        amount_cents=payload.amount_cents,
        date=payload.date,
        is_recurring_base=False,
        note=payload.note,
    )

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
        sync_and_commit_current_month(
            db=db,
            year=year,
            month=month,
        )

    query = db.query(IncomeEntry)

    if year is not None:
        query = query.filter(
            extract("year", IncomeEntry.date) == year
        )

    if month is not None:
        query = query.filter(
            extract("month", IncomeEntry.date) == month
        )

    return (
        query
        .order_by(
            IncomeEntry.date.desc(),
            IncomeEntry.id.desc(),
        )
        .all()
    )


@router.get(
    "/summary",
    response_model=MonthlyIncomeSummary,
)
def monthly_income_summary(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    selected_year = year or today.year
    selected_month = month or today.month

    sync_and_commit_current_month(
        db=db,
        year=selected_year,
        month=selected_month,
    )

    entries = (
        db.query(IncomeEntry)
        .filter(
            extract("year", IncomeEntry.date)
            == selected_year
        )
        .filter(
            extract("month", IncomeEntry.date)
            == selected_month
        )
        .all()
    )

    base_income_cents = sum(
        entry.amount_cents
        for entry in entries
        if entry.is_recurring_base
    )

    additional_income_cents = sum(
        entry.amount_cents
        for entry in entries
        if not entry.is_recurring_base
    )

    return MonthlyIncomeSummary(
        year=selected_year,
        month=selected_month,
        total_cents=(
            base_income_cents + additional_income_cents
        ),
        base_income_cents=base_income_cents,
        additional_income_cents=additional_income_cents,
        entry_count=len(entries),
    )


@router.get("/{entry_id}", response_model=IncomeEntryOut)
def get_income_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(IncomeEntry)
        .filter(IncomeEntry.id == entry_id)
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Income entry not found",
        )

    return entry


@router.patch("/{entry_id}", response_model=IncomeEntryOut)
def update_income_entry(
    entry_id: int,
    payload: IncomeEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(IncomeEntry)
        .filter(IncomeEntry.id == entry_id)
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Income entry not found",
        )

    if entry.is_recurring_base:
        raise HTTPException(
            status_code=400,
            detail=(
                "Update the base monthly income configuration "
                "instead"
            ),
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
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
    entry = (
        db.query(IncomeEntry)
        .filter(IncomeEntry.id == entry_id)
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Income entry not found",
        )

    if entry.is_recurring_base:
        raise HTTPException(
            status_code=400,
            detail=(
                "The automatically generated base income "
                "cannot be deleted"
            ),
        )

    db.delete(entry)
    db.commit()