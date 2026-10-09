from datetime import date

from pydantic import ValidationError

from app.models.allocation import AllocationPlan
from app.models.goal import Goal
from app.models.money_event import MoneyEvent
from app.models.profile import FinancialProfile
from app.schemas.onboarding import OnboardingRequest
from app.services.ledger import get_goal_balance, get_total_money, get_track_balances
from app.services.onboarding import OnboardingConflictError, OnboardingError, complete_onboarding, get_onboarding_status
from tests.support import DatabaseTestCase


class OnboardingTests(DatabaseTestCase):
    def payload(self, **changes) -> OnboardingRequest:
        values = {
            "currency": "MAD",
            "expected_monthly_income_cents": 1_000_000,
            "essentials_pct": 50,
            "lifestyle_pct": 30,
            "investments_pct": 20,
            "emergency_fund_months": 3,
            "current_total_money_cents": 2_000_000,
            "current_emergency_fund_cents": 500_000,
        }
        values.update(changes)
        return OnboardingRequest(**values)

    def test_complete_onboarding_creates_all_required_records(self):
        result = complete_onboarding(self.db, self.user.id, self.payload(), date(2026, 10, 1))

        self.assertEqual(self.db.query(FinancialProfile).count(), 1)
        self.assertEqual(self.db.query(AllocationPlan).count(), 1)
        self.assertEqual(self.db.query(Goal).count(), 1)
        self.assertEqual(self.db.query(MoneyEvent).count(), 1)
        self.assertEqual(result.emergency_fund_goal.target_cents, 1_500_000)
        self.assertEqual(get_total_money(self.db, self.user.id), 2_000_000)
        self.assertEqual(get_goal_balance(self.db, self.user.id, result.emergency_fund_goal.id), 500_000)
        self.assertEqual(get_track_balances(self.db, self.user.id), {"essentials": 750_000, "lifestyle": 450_000, "investments": 300_000})
        self.assertTrue(get_onboarding_status(self.db, self.user.id).completed)

    def test_zero_opening_money_creates_no_event(self):
        complete_onboarding(self.db, self.user.id, self.payload(current_total_money_cents=0, current_emergency_fund_cents=0), date(2026, 10, 1))
        self.assertEqual(self.db.query(MoneyEvent).count(), 0)

    def test_onboarding_cannot_run_twice(self):
        complete_onboarding(self.db, self.user.id, self.payload(), date(2026, 10, 1))
        with self.assertRaises(OnboardingConflictError):
            complete_onboarding(self.db, self.user.id, self.payload(), date(2026, 10, 1))

    def test_emergency_fund_cannot_exceed_total_money(self):
        with self.assertRaises(ValidationError):
            self.payload(current_total_money_cents=100_000, current_emergency_fund_cents=200_000)

    def test_essentials_percentage_must_be_positive(self):
        payload = self.payload(essentials_pct=0, lifestyle_pct=80, investments_pct=20)
        with self.assertRaises(OnboardingError):
            complete_onboarding(self.db, self.user.id, payload, date(2026, 10, 1))


if __name__ == "__main__":
    import unittest

    unittest.main()
