from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.income import sync_current_month_base_income
from app.db.session import get_db
from app.models.budget import BudgetSplit, EmergencyFundConfig
from app.models.category import Category
from app.models.debt import Debt, DebtPayment
from app.models.enums import BudgetBucket
from app.models.expense import Expense
from app.models.income import IncomeConfig, IncomeEntry
from app.models.investment import Investment
from app.models.user import User
from app.schemas.dashboard import (
    BudgetComparisonItem,
    CategoryBreakdown,
    DashboardOut,
    MonthlyTrendPoint,
)

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
)


def _current_split(db: Session) -> BudgetSplit | None:
    return (
        db.query(BudgetSplit)
        .filter(BudgetSplit.effective_date <= date.today())
        .order_by(BudgetSplit.effective_date.desc())
        .first()
    )


def _monthly_income_cents(
    db: Session,
    year: int,
    month: int,
) -> int:
    changed = sync_current_month_base_income(
        db=db,
        year=year,
        month=month,
    )

    if changed:
        db.commit()

    entries = (
        db.query(IncomeEntry)
        .filter(
            extract("year", IncomeEntry.date) == year
        )
        .filter(
            extract("month", IncomeEntry.date) == month
        )
        .all()
    )

    return sum(
        entry.amount_cents
        for entry in entries
    )


def _monthly_expense_cents(
    db: Session,
    year: int,
    month: int,
) -> int:
    expenses = (
        db.query(Expense)
        .filter(
            extract("year", Expense.date) == year
        )
        .filter(
            extract("month", Expense.date) == month
        )
        .all()
    )

    regular_debt_payments = (
        db.query(DebtPayment)
        .filter(
            extract("year", DebtPayment.date) == year
        )
        .filter(
            extract("month", DebtPayment.date) == month
        )
        .filter(
            DebtPayment.payment_type == "regular"
        )
        .all()
    )

    expense_total = sum(
        expense.amount_cents
        for expense in expenses
    )

    regular_debt_total = sum(
        payment.amount_cents
        for payment in regular_debt_payments
    )

    return expense_total + regular_debt_total


def _months_back(
    base: date,
    number_of_months: int,
) -> list[tuple[int, int]]:
    months = []
    year = base.year
    month = base.month

    for _ in range(number_of_months):
        months.append((year, month))

        month -= 1

        if month == 0:
            month = 12
            year -= 1

    return list(reversed(months))


@router.get("", response_model=DashboardOut)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    split = _current_split(db)
    ef_config = db.query(EmergencyFundConfig).first()
    income_config = db.query(IncomeConfig).first()

    if not split or not ef_config or not income_config:
        raise HTTPException(
            status_code=400,
            detail="Complete onboarding first",
        )

    income_cents = _monthly_income_cents(
        db,
        today.year,
        today.month,
    )

    freedom_funds_cents = (
        income_cents
        * split.freedom_funds_pct
        // 100
    )

    essentials_budget_cents = (
        income_cents
        * split.essentials_pct
        // 100
    )

    lifestyle_budget_cents = (
        income_cents
        * split.lifestyle_pct
        // 100
    )

    expense_rows = (
        db.query(
            Expense,
            Category.bucket,
            Category.name,
        )
        .join(
            Category,
            Expense.category_id == Category.id,
        )
        .filter(
            extract("year", Expense.date)
            == today.year
        )
        .filter(
            extract("month", Expense.date)
            == today.month
        )
        .all()
    )

    lifestyle_spent_cents = sum(
        expense.amount_cents
        for expense, bucket, _ in expense_rows
        if bucket == BudgetBucket.LIFESTYLE
    )

    essentials_spent_cents = sum(
        expense.amount_cents
        for expense, bucket, _ in expense_rows
        if bucket == BudgetBucket.ESSENTIALS
    )

    lifestyle_remaining_cents = (
        lifestyle_budget_cents
        - lifestyle_spent_cents
    )

    ef_target_cents = ef_config.target_cents
    ef_current = ef_config.current_balance_cents
    ef_is_met = ef_current >= ef_target_cents

    ef_progress_pct = (
        min(
            round(
                (ef_current / ef_target_cents) * 100,
                1,
            ),
            100.0,
        )
        if ef_target_cents
        else 0.0
    )

    ef_projected_months = None

    if not ef_is_met and freedom_funds_cents > 0:
        ef_projected_months = round(
            max(
                ef_target_cents - ef_current,
                0,
            )
            / freedom_funds_cents,
            1,
        )

    investments_total_cents = sum(
        investment.amount_cents
        for investment in db.query(Investment).all()
    )

    debts = db.query(Debt).all()
    total_debt_remaining_cents = 0

    for debt in debts:
        paid_cents = sum(
            payment.amount_cents
            for payment in debt.payments
        )

        total_debt_remaining_cents += max(
            debt.balance_cents - paid_cents,
            0,
        )

    current_month_debt_payments = (
        db.query(DebtPayment)
        .filter(
            extract("year", DebtPayment.date)
            == today.year
        )
        .filter(
            extract("month", DebtPayment.date)
            == today.month
        )
        .all()
    )

    regular_debt_payments_this_month_cents = sum(
        payment.amount_cents
        for payment in current_month_debt_payments
        if payment.payment_type == "regular"
    )

    extra_debt_payments_this_month_cents = sum(
        payment.amount_cents
        for payment in current_month_debt_payments
        if payment.payment_type == "extra"
    )

    extra_debt_payments_from_income_cents = sum(
        payment.amount_cents
        for payment in current_month_debt_payments
        if (
            payment.payment_type == "extra"
            and payment.funding_source
            == "current_income"
        )
    )

    extra_debt_payments_from_savings_cents = sum(
        payment.amount_cents
        for payment in current_month_debt_payments
        if (
            payment.payment_type == "extra"
            and payment.funding_source
            == "existing_savings"
        )
    )

    extra_debt_payments_undisclosed_cents = sum(
        payment.amount_cents
        for payment in current_month_debt_payments
        if (
            payment.payment_type == "extra"
            and payment.funding_source is None
        )
    )

    monthly_trend = [
        MonthlyTrendPoint(
            year=year,
            month=month,
            income_cents=_monthly_income_cents(
                db,
                year,
                month,
            ),
            expense_cents=_monthly_expense_cents(
                db,
                year,
                month,
            ),
        )
        for year, month in _months_back(today, 6)
    ]

    investments_this_month_cents = sum(
        investment.amount_cents
        for investment in (
            db.query(Investment)
            .filter(
                extract("year", Investment.date)
                == today.year
            )
            .filter(
                extract("month", Investment.date)
                == today.month
            )
            .all()
        )
    )

    category_totals: dict[
        tuple[BudgetBucket, str],
        int,
    ] = defaultdict(int)

    for expense, bucket, name in expense_rows:
        category_totals[(bucket, name)] += (
            expense.amount_cents
        )

    if regular_debt_payments_this_month_cents:
        category_totals[
            (
                BudgetBucket.ESSENTIALS,
                "Regular debt payments",
            )
        ] += regular_debt_payments_this_month_cents

    spending_by_category = [
        CategoryBreakdown(
            category=name,
            bucket=bucket,
            amount_cents=amount,
        )
        for (
            bucket,
            name,
        ), amount in category_totals.items()
    ]

    essentials_actual_cents = (
        essentials_spent_cents
        + regular_debt_payments_this_month_cents
    )

    freedom_funds_actual_cents = (
        investments_this_month_cents
    )

    essentials_actual_pct = (
        round(
            (
                essentials_actual_cents
                / income_cents
            )
            * 100,
            1,
        )
        if income_cents
        else 0.0
    )

    freedom_funds_actual_pct = (
        round(
            (
                freedom_funds_actual_cents
                / income_cents
            )
            * 100,
            1,
        )
        if income_cents
        else 0.0
    )

    lifestyle_actual_pct = (
        round(
            (
                lifestyle_spent_cents
                / income_cents
            )
            * 100,
            1,
        )
        if income_cents
        else 0.0
    )

    budget_comparison = [
        BudgetComparisonItem(
            bucket="freedom_funds",
            planned_pct=float(
                split.freedom_funds_pct
            ),
            actual_pct=freedom_funds_actual_pct,
            planned_cents=freedom_funds_cents,
            actual_cents=(
                freedom_funds_actual_cents
            ),
        ),
        BudgetComparisonItem(
            bucket="essentials",
            planned_pct=float(
                split.essentials_pct
            ),
            actual_pct=essentials_actual_pct,
            planned_cents=essentials_budget_cents,
            actual_cents=essentials_actual_cents,
        ),
        BudgetComparisonItem(
            bucket="lifestyle",
            planned_pct=float(
                split.lifestyle_pct
            ),
            actual_pct=lifestyle_actual_pct,
            planned_cents=lifestyle_budget_cents,
            actual_cents=lifestyle_spent_cents,
        ),
    ]

    return DashboardOut(
        year=today.year,
        month=today.month,
        savings_cents=ef_current,
        available_savings_cents=(
            income_config.available_savings_cents
        ),
        ef_target_cents=ef_target_cents,
        ef_current_balance_cents=ef_current,
        ef_progress_pct=ef_progress_pct,
        ef_is_met=ef_is_met,
        ef_projected_months_to_target=(
            ef_projected_months
        ),
        lifestyle_budget_cents=(
            lifestyle_budget_cents
        ),
        lifestyle_spent_cents=(
            lifestyle_spent_cents
        ),
        lifestyle_remaining_cents=(
            lifestyle_remaining_cents
        ),
        investments_total_cents=(
            investments_total_cents
        ),
        total_debt_remaining_cents=(
            total_debt_remaining_cents
        ),
        debt_count=len(debts),
        regular_debt_payments_this_month_cents=(
            regular_debt_payments_this_month_cents
        ),
        extra_debt_payments_this_month_cents=(
            extra_debt_payments_this_month_cents
        ),
        extra_debt_payments_from_income_cents=(
            extra_debt_payments_from_income_cents
        ),
        extra_debt_payments_from_savings_cents=(
            extra_debt_payments_from_savings_cents
        ),
        extra_debt_payments_undisclosed_cents=(
            extra_debt_payments_undisclosed_cents
        ),
        spending_by_category=spending_by_category,
        monthly_trend=monthly_trend,
        budget_comparison=budget_comparison,
    )