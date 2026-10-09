from datetime import date

from app.models.category import Category
from app.models.money_event import MoneyEvent
from app.schemas.money_action import BalanceAdjustmentCreate, EventCorrectionCreate, ExpenseCreate, IncomeCreate, TrackTransferCreate
from app.services.ledger import LedgerConflictError, LedgerNotFoundError, adjust_total_balance, get_total_money, get_track_balances, list_events, record_expense, record_income, reverse_event, transfer_between_tracks
from tests.support import DatabaseTestCase


class LedgerTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.add_profile_and_plan()
        self.system_category = Category(name="Groceries", track_kind="essentials", is_system=True, active=True)
        self.own_category = Category(user_id=self.user.id, name="Gym", track_kind="lifestyle", is_system=False, active=True)
        self.other_category = Category(user_id=self.other_user.id, name="Other private", track_kind="essentials", is_system=False, active=True)
        self.db.add_all([self.system_category, self.own_category, self.other_category])
        self.db.flush()

    def test_income_is_split_and_expense_uses_category_track(self):
        record_income(self.db, self.user.id, IncomeCreate(name="Salary", amount_cents=100_000, occurred_on=date(2026, 10, 1)))
        record_expense(self.db, self.user.id, ExpenseCreate(amount_cents=10_000, category_id=self.system_category.id, occurred_on=date(2026, 10, 2)))

        self.assertEqual(get_total_money(self.db, self.user.id), 90_000)
        self.assertEqual(get_track_balances(self.db, self.user.id), {"essentials": 40_000, "lifestyle": 30_000, "investments": 20_000})

    def test_transfer_changes_tracks_without_changing_total(self):
        record_income(self.db, self.user.id, IncomeCreate(name="Salary", amount_cents=100_000, occurred_on=date(2026, 10, 1)))
        transfer_between_tracks(self.db, self.user.id, TrackTransferCreate(from_track="lifestyle", to_track="investments", amount_cents=5_000, occurred_on=date(2026, 10, 2)))

        self.assertEqual(get_total_money(self.db, self.user.id), 100_000)
        self.assertEqual(get_track_balances(self.db, self.user.id), {"essentials": 50_000, "lifestyle": 25_000, "investments": 25_000})

    def test_idempotency_key_prevents_duplicate_income(self):
        payload = IncomeCreate(name="Salary", amount_cents=100_000, occurred_on=date(2026, 10, 1))
        first = record_income(self.db, self.user.id, payload, "salary-2026-10")
        second = record_income(self.db, self.user.id, payload, "salary-2026-10")

        self.assertEqual(first.id, second.id)
        self.assertEqual(self.db.query(MoneyEvent).count(), 1)
        self.assertEqual(get_total_money(self.db, self.user.id), 100_000)

    def test_other_users_category_is_rejected(self):
        with self.assertRaises(LedgerNotFoundError):
            record_expense(self.db, self.user.id, ExpenseCreate(amount_cents=1_000, category_id=self.other_category.id, occurred_on=date(2026, 10, 1)))

    def test_reversal_cancels_original_event_and_cannot_repeat(self):
        record_income(self.db, self.user.id, IncomeCreate(name="Salary", amount_cents=100_000, occurred_on=date(2026, 10, 1)))
        expense = record_expense(self.db, self.user.id, ExpenseCreate(amount_cents=10_000, category_id=self.own_category.id, occurred_on=date(2026, 10, 2)))
        reversal = reverse_event(self.db, self.user.id, expense.id, EventCorrectionCreate(occurred_on=date(2026, 10, 2), reason="Duplicate"))

        self.assertEqual(reversal.reverses_event_id, expense.id)
        self.assertEqual(get_total_money(self.db, self.user.id), 100_000)
        self.assertEqual(get_track_balances(self.db, self.user.id)["lifestyle"], 30_000)

        with self.assertRaises(LedgerConflictError):
            reverse_event(self.db, self.user.id, expense.id, EventCorrectionCreate(occurred_on=date(2026, 10, 3), reason="Again"))

    def test_balance_adjustment_sets_declared_total(self):
        record_income(self.db, self.user.id, IncomeCreate(name="Salary", amount_cents=100_000, occurred_on=date(2026, 10, 1)))
        adjust_total_balance(self.db, self.user.id, BalanceAdjustmentCreate(actual_total_money_cents=95_000, affected_track="essentials", occurred_on=date(2026, 10, 2), reason="Forgotten cash expense"))

        self.assertEqual(get_total_money(self.db, self.user.id), 95_000)
        self.assertEqual(get_track_balances(self.db, self.user.id)["essentials"], 45_000)

    def test_event_listing_filters_dates_and_newest_first(self):
        record_income(self.db, self.user.id, IncomeCreate(name="September", amount_cents=50_000, occurred_on=date(2026, 9, 1)))
        record_income(self.db, self.user.id, IncomeCreate(name="October", amount_cents=60_000, occurred_on=date(2026, 10, 1)))
        events = list_events(self.db, self.user.id, date(2026, 10, 1), date(2026, 10, 31))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].note, "October")


if __name__ == "__main__":
    import unittest

    unittest.main()
