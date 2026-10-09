from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.category import TrackKind
from app.schemas.debt import DebtStatus
from app.schemas.goal import GoalStatus
from app.schemas.investment import AssetStatus
from app.schemas.money_event import MoneyEventOut


class DashboardTrackOut(BaseModel):
    track_kind: TrackKind
    percentage: int = Field(ge=0, le=100)
    balance_cents: int


class DashboardGoalOut(BaseModel):
    id: int
    name: str
    current_balance_cents: int
    target_cents: int | None
    progress_pct: float | None
    status: GoalStatus


class DashboardDebtOut(BaseModel):
    id: int
    name: str
    current_balance_cents: int
    planned_monthly_payment_cents: int
    progress_pct: float
    status: DebtStatus


class DashboardInvestmentOut(BaseModel):
    id: int
    name: str
    asset_type: str
    current_units: Decimal
    current_value_cents: int | None
    status: AssetStatus


class MonthlyActivityOut(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    income_cents: int = Field(ge=0)
    expenses_cents: int = Field(ge=0)
    debt_payments_cents: int = Field(ge=0)
    investment_purchases_cents: int = Field(ge=0)
    investment_income_cents: int = Field(ge=0)
    net_money_change_cents: int


class SpendingCategoryOut(BaseModel):
    category_id: int
    category_name: str
    track_kind: TrackKind
    amount_cents: int = Field(ge=0)


class MonthlyTrendPointOut(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    money_in_cents: int = Field(ge=0)
    money_out_cents: int = Field(ge=0)
    closing_money_cents: int


class DashboardOut(BaseModel):
    as_of_date: date
    currency: str
    expected_monthly_income_cents: int
    total_money_cents: int
    money_in_tracks_cents: int
    money_in_goals_cents: int
    total_debt_cents: int
    total_investment_value_cents: int
    estimated_net_worth_cents: int
    tracks: list[DashboardTrackOut]
    monthly_activity: MonthlyActivityOut
    goals: list[DashboardGoalOut]
    debts: list[DashboardDebtOut]
    investments: list[DashboardInvestmentOut]
    spending_by_category: list[SpendingCategoryOut]
    monthly_trend: list[MonthlyTrendPointOut]
    recent_events: list[MoneyEventOut]