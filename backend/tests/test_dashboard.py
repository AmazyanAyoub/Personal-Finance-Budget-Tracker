from datetime import date
from decimal import Decimal

from app.models.category import Category
from app.schemas.debt import DebtCreate, DebtPaymentCreate
from app.schemas.goal import GoalCreate, GoalMoneyActionCreate
from app.schemas.investment import InvestmentAssetCreate, InvestmentTradeCreate, InvestmentValuationCreate
from app.schemas.money_action import EventCorrectionCreate, ExpenseCreate, IncomeCreate
from app.schemas.onboarding import OnboardingRequest
from app.services.dashboard import DashboardNotReadyError, get_dashboard
from app.services.debts import create_debt, pay_debt
from app.services.goals import create_goal, reserve_for_goal
from app.services.investments import add_valuation, create_asset, record_trade
from app.services.ledger import record_expense, record_income, reverse_event
from app.services.onboarding import complete_onboarding
from tests.support import DatabaseTestCase


class DashboardTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        complete_onboarding(
            self.db,
            self.user.id,
            OnboardingRequest(
                currency="MAD",
                expected_monthly_income_cents=100_000,
                essentials_pct=50,
                lifestyle_pct=30,
                investments_pct=20,
                emergency_fund_months=3,
                current_total_money_cents=100_000,
                current_emergency_fund_cents=10_000,
            ),
            date(2026, 9, 1),
        )
        self.category = Category(name="Groceries", track_kind="essentials", is_system=True, active=True)
        self.db.add(self.category)
        self.db.flush()

    def test_dashboard_combines_all_financial_domains(self):
        record_income(self.db, self.user.id, IncomeCreate(name="Salary", amount_cents=100_000, occurred_on=date(2026, 10, 1)))
        record_expense(self.db, self.user.id, ExpenseCreate(amount_cents=10_000, category_id=self.category.id, occurred_on=date(2026, 10, 2)))
        mistaken = record_expense(self.db, self.user.id, ExpenseCreate(amount_cents=3_000, category_id=self.category.id, occurred_on=date(2026, 10, 2)))
        reverse_event(self.db, self.user.id, mistaken.id, EventCorrectionCreate(occurred_on=date(2026, 10, 2), reason="Duplicate"))

        debt = create_debt(self.db, self.user.id, DebtCreate(name="Small debt", starting_balance_cents=20_000, planned_monthly_payment_cents=5_000))
        pay_debt(self.db, self.user.id, debt.id, DebtPaymentCreate(amount_cents=5_000, occurred_on=date(2026, 10, 3)))

        goal = create_goal(self.db, self.user.id, GoalCreate(name="Travel", type_name="Travel", linked_track_kind="lifestyle", target_cents=50_000))
        reserve_for_goal(self.db, self.user.id, goal.id, GoalMoneyActionCreate(amount_cents=10_000, occurred_on=date(2026, 10, 4)))

        asset = create_asset(self.db, self.user.id, InvestmentAssetCreate(asset_type="Stock", name="IAM", symbol="IAM", currency="MAD"), date(2026, 10, 5))
        record_trade(self.db, self.user.id, asset.id, InvestmentTradeCreate(action="buy", units=Decimal("10"), unit_price_cents=1_000, occurred_on=date(2026, 10, 5)))
        add_valuation(self.db, self.user.id, asset.id, InvestmentValuationCreate(price_per_unit_cents=1_500, as_of_date=date(2026, 10, 6)))

        dashboard = get_dashboard(self.db, self.user.id, date(2026, 10, 8))
        tracks = {track.track_kind: track.balance_cents for track in dashboard.tracks}

        self.assertEqual(dashboard.total_money_cents, 175_000)
        self.assertEqual(dashboard.money_in_tracks_cents, 155_000)
        self.assertEqual(dashboard.money_in_goals_cents, 20_000)
        self.assertEqual(dashboard.total_debt_cents, 15_000)
        self.assertEqual(dashboard.total_investment_value_cents, 15_000)
        self.assertEqual(dashboard.estimated_net_worth_cents, 175_000)
        self.assertEqual(tracks, {"essentials": 80_000, "lifestyle": 47_000, "investments": 28_000})
        self.assertEqual(dashboard.monthly_activity.income_cents, 100_000)
        self.assertEqual(dashboard.monthly_activity.expenses_cents, 10_000)
        self.assertEqual(dashboard.monthly_activity.debt_payments_cents, 5_000)
        self.assertEqual(dashboard.monthly_activity.investment_purchases_cents, 10_000)
        self.assertEqual(dashboard.monthly_activity.net_money_change_cents, 75_000)
        self.assertEqual(len(dashboard.spending_by_category), 1)
        self.assertEqual(dashboard.spending_by_category[0].amount_cents, 10_000)
        self.assertEqual(dashboard.monthly_trend[-1].closing_money_cents, 175_000)

    def test_dashboard_requires_completed_onboarding(self):
        with self.assertRaises(DashboardNotReadyError):
            get_dashboard(self.db, self.other_user.id, date(2026, 10, 8))


if __name__ == "__main__":
    import unittest

    unittest.main()
