from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.budget import BudgetSplit, EmergencyFundConfig
from app.models.category import Category
from app.models.debt import Debt, DebtPayment
from app.models.enums import BudgetBucket, IncomeSource
from app.models.expense import Expense
from app.models.income import IncomeEntry, IncomeModeConfig
from app.models.investment import Investment
from app.models.user import User
from app.schemas.dashboard import BudgetComparisonItem, CategoryBreakdown, DashboardOut, MonthlyTrendPoint

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _current_split(db: Session) -> BudgetSplit | None:
    return (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date <= date.today())
        .order_by(BudgetSplit.effective_date.desc())
        .first()
    )


def _ensure_fixed_entry(db: Session, year: int, month: int) -> None:
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


def _monthly_income_cents(db: Session, year: int, month: int) -> int:
    _ensure_fixed_entry(db, year, month)
    entries = (
        db.query(IncomeEntry)
        .filter(extract("year", IncomeEntry.date) == year)
        .filter(extract("month", IncomeEntry.date) == month)
        .all()
    )
    return sum(e.amount_cents for e in entries)


def _monthly_expense_cents(db: Session, year: int, month: int) -> int:
    expenses = (
        db.query(Expense)
        .filter(extract("year", Expense.date) == year)
        .filter(extract("month", Expense.date) == month)
        .all()
    )
    debt_payments = (
        db.query(DebtPayment)
        .filter(extract("year", DebtPayment.date) == year)
        .filter(extract("month", DebtPayment.date) == month)
        .all()
    )
    return sum(e.amount_cents for e in expenses) + sum(
        p.amount_cents for p in debt_payments
    )


def _months_back(base: date, n: int) -> list[tuple[int, int]]:
    months = []
    y, m = base.year, base.month
    for _ in range(n):
        months.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(months))


@router.get("", response_model=DashboardOut)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    split = _current_split(db)
    ef_config = db.query(EmergencyFundConfig).first()

    if not split or not ef_config:
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    income_cents = _monthly_income_cents(db, today.year, today.month)
    freedom_funds_cents = income_cents * split.freedom_funds_pct // 100
    essentials_budget_cents = income_cents * split.essentials_pct // 100
    lifestyle_budget_cents = income_cents * split.lifestyle_pct // 100

    expense_rows = (
        db.query(Expense, Category.bucket, Category.name)
        .join(Category, Expense.category_id == Category.id)
        .filter(extract("year", Expense.date) == today.year)
        .filter(extract("month", Expense.date) == today.month)
        .all()
    )
    lifestyle_spent_cents = sum(e.amount_cents for e, bucket, name in expense_rows if bucket == BudgetBucket.LIFESTYLE)
    essentials_spent_cents = sum(e.amount_cents for e, bucket, name in expense_rows if bucket == BudgetBucket.ESSENTIALS)
    lifestyle_remaining_cents = lifestyle_budget_cents - lifestyle_spent_cents


    ef_target_cents = ef_config.target_cents
    ef_current = ef_config.current_balance_cents
    ef_is_met = ef_current >= ef_target_cents
    ef_progress_pct = min(round((ef_current / ef_target_cents) * 100, 1), 100.0) if ef_target_cents else 0.0
    ef_projected_months = None
    if not ef_is_met and freedom_funds_cents > 0:
        ef_projected_months = round(max(ef_target_cents - ef_current, 0) / freedom_funds_cents, 1)

    investments_total_cents = sum(i.amount_cents for i in db.query(Investment).all())

    debts = db.query(Debt).all()
    total_debt_remaining_cents = 0
    for debt in debts:
        paid = sum(p.amount_cents for p in debt.payments)
        total_debt_remaining_cents += max(debt.balance_cents - paid, 0)

    monthly_trend = [
        MonthlyTrendPoint(
            year=y, month=m,
            income_cents=_monthly_income_cents(db, y, m),
            expense_cents=_monthly_expense_cents(db, y, m),
        )
        for y, m in _months_back(today, 6)
    ]

    investments_this_month_cents = sum(
        i.amount_cents for i in db.query(Investment)
        .filter(extract("year", Investment.date) == today.year)
        .filter(extract("month", Investment.date) == today.month)
        .all()
    )
    debt_payments_this_month_cents = sum(
        p.amount_cents for p in db.query(DebtPayment)
        .filter(extract("year", DebtPayment.date) == today.year)
        .filter(extract("month", DebtPayment.date) == today.month)
        .all()
    )

    category_totals: dict[tuple[BudgetBucket, str], int] = defaultdict(int)

    for expense, bucket, name in expense_rows:
        category_totals[(bucket, name)] += expense.amount_cents

    if debt_payments_this_month_cents:
        category_totals[(BudgetBucket.ESSENTIALS, "Debt payments")] += (
            debt_payments_this_month_cents
        )

    spending_by_category = [
        CategoryBreakdown(
            category=name,
            bucket=bucket,
            amount_cents=amount,
        )
        for (bucket, name), amount in category_totals.items()
    ]

    # Debt payments are Essentials. Investments are Freedom Funds.
    essentials_actual_cents = essentials_spent_cents + debt_payments_this_month_cents
    freedom_funds_actual_cents = investments_this_month_cents

    essentials_actual_pct = (
        round((essentials_actual_cents / income_cents) * 100, 1)
        if income_cents else 0.0
    )
    freedom_funds_actual_pct = (
        round((freedom_funds_actual_cents / income_cents) * 100, 1)
        if income_cents else 0.0
    )
    lifestyle_actual_pct = (
        round((lifestyle_spent_cents / income_cents) * 100, 1)
        if income_cents else 0.0
    )

    budget_comparison = [
        BudgetComparisonItem(
            bucket="freedom_funds",
            planned_pct=float(split.freedom_funds_pct),
            actual_pct=freedom_funds_actual_pct,
            planned_cents=freedom_funds_cents,
            actual_cents=freedom_funds_actual_cents,
        ),
        BudgetComparisonItem(
            bucket="essentials",
            planned_pct=float(split.essentials_pct),
            actual_pct=essentials_actual_pct,
            planned_cents=essentials_budget_cents,
            actual_cents=essentials_actual_cents,
        ),
        BudgetComparisonItem(
            bucket="lifestyle",
            planned_pct=float(split.lifestyle_pct),
            actual_pct=lifestyle_actual_pct,
            planned_cents=lifestyle_budget_cents,
            actual_cents=lifestyle_spent_cents,
        ),
    ]

    return DashboardOut(
        year=today.year, month=today.month,
        savings_cents=ef_current,
        ef_target_cents=ef_target_cents, ef_current_balance_cents=ef_current,
        ef_progress_pct=ef_progress_pct, ef_is_met=ef_is_met,
        ef_projected_months_to_target=ef_projected_months,
        lifestyle_budget_cents=lifestyle_budget_cents, lifestyle_spent_cents=lifestyle_spent_cents,
        lifestyle_remaining_cents=lifestyle_remaining_cents,
        investments_total_cents=investments_total_cents,
        total_debt_remaining_cents=total_debt_remaining_cents, debt_count=len(debts),
        spending_by_category=spending_by_category,
        monthly_trend=monthly_trend,
        budget_comparison=budget_comparison,
    )
