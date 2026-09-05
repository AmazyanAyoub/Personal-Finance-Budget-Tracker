from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import BudgetBucket
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseOut, ExpenseUpdate, MonthlyExpenseSummary

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.post("", response_model=ExpenseOut)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Category).filter(Category.id == payload.category_id).first():
        raise HTTPException(status_code=400, detail="Invalid category_id")
    expense = Expense(**payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Expense)
    if year is not None:
        query = query.filter(extract("year", Expense.date) == year)
    if month is not None:
        query = query.filter(extract("month", Expense.date) == month)
    return query.order_by(Expense.date.desc()).all()


# must stay above /{expense_id} — same route-order reason as income's /summary
@router.get("/summary", response_model=MonthlyExpenseSummary)
def monthly_expense_summary(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    year = year or today.year
    month = month or today.month

    results = (
        db.query(Expense, Category.bucket)
        .join(Category, Expense.category_id == Category.id)
        .filter(extract("year", Expense.date) == year)
        .filter(extract("month", Expense.date) == month)
        .all()
    )
    essentials_cents = sum(e.amount_cents for e, bucket in results if bucket == BudgetBucket.ESSENTIALS)
    lifestyle_cents = sum(e.amount_cents for e, bucket in results if bucket == BudgetBucket.LIFESTYLE)

    return MonthlyExpenseSummary(
        year=year,
        month=month,
        total_cents=essentials_cents + lifestyle_cents,
        essentials_cents=essentials_cents,
        lifestyle_cents=lifestyle_cents,
        entry_count=len(results),
    )


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and not db.query(Category).filter(Category.id == data["category_id"]).first():
        raise HTTPException(status_code=400, detail="Invalid category_id")
    for field, value in data.items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
