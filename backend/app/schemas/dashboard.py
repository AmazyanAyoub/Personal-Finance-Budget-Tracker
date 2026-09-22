from pydantic import BaseModel

from app.models.enums import BudgetBucket


class CategoryBreakdown(BaseModel):
    category: str
    bucket: BudgetBucket
    amount_cents: int


class MonthlyTrendPoint(BaseModel):
    year: int
    month: int
    income_cents: int
    expense_cents: int


class BudgetComparisonItem(BaseModel):
    bucket: str
    planned_pct: float
    actual_pct: float
    planned_cents: int
    actual_cents: int


class DashboardOut(BaseModel):
    year: int
    month: int

    savings_cents: int
    available_savings_cents: int | None

    ef_target_cents: int
    ef_current_balance_cents: int
    ef_progress_pct: float
    ef_is_met: bool
    ef_projected_months_to_target: float | None

    lifestyle_budget_cents: int
    lifestyle_spent_cents: int
    lifestyle_remaining_cents: int

    investments_total_cents: int

    total_debt_remaining_cents: int
    debt_count: int

    regular_debt_payments_this_month_cents: int
    extra_debt_payments_this_month_cents: int
    extra_debt_payments_from_income_cents: int
    extra_debt_payments_from_savings_cents: int
    extra_debt_payments_undisclosed_cents: int

    spending_by_category: list[CategoryBreakdown]
    monthly_trend: list[MonthlyTrendPoint]
    budget_comparison: list[BudgetComparisonItem]