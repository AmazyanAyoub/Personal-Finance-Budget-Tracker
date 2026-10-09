from datetime import date

from app.models.goal import Goal
from app.schemas.debt import DebtCreate, DebtPaymentCreate, DebtUpdate
from app.schemas.goal import GoalCreate, GoalMoneyActionCreate, GoalUpdate
from app.services.debts import DebtConflictError, DebtNotFoundError, create_debt, get_debt, pay_debt, update_debt
from app.services.goals import GoalConflictError, GoalNotFoundError, create_goal, get_goal, release_from_goal, reserve_for_goal, spend_from_goal, update_goal
from app.services.ledger import get_total_money, get_track_balances
from tests.support import DatabaseTestCase


class GoalTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.prepare_finances()

    def create_travel_goal(self, target_cents: int = 100_000):
        return create_goal(
            self.db,
            self.user.id,
            GoalCreate(name="Travel", type_name="Travel", linked_track_kind="lifestyle", target_cents=target_cents),
        )

    def test_reserve_release_and_spend_keep_balances_consistent(self):
        goal = self.create_travel_goal()
        reserved = reserve_for_goal(self.db, self.user.id, goal.id, GoalMoneyActionCreate(amount_cents=50_000, occurred_on=date(2026, 10, 1)))
        self.assertEqual(reserved.current_balance_cents, 50_000)
        self.assertEqual(get_total_money(self.db, self.user.id), 1_000_000)
        self.assertEqual(get_track_balances(self.db, self.user.id)["lifestyle"], 250_000)

        released = release_from_goal(self.db, self.user.id, goal.id, GoalMoneyActionCreate(amount_cents=20_000, occurred_on=date(2026, 10, 2)))
        self.assertEqual(released.current_balance_cents, 30_000)
        self.assertEqual(get_track_balances(self.db, self.user.id)["lifestyle"], 270_000)

        spent = spend_from_goal(self.db, self.user.id, goal.id, GoalMoneyActionCreate(amount_cents=30_000, occurred_on=date(2026, 10, 3)))
        self.assertEqual(spent.current_balance_cents, 0)
        self.assertEqual(get_total_money(self.db, self.user.id), 970_000)
        self.assertEqual(get_track_balances(self.db, self.user.id)["lifestyle"], 270_000)

    def test_goal_becomes_completed_at_target(self):
        goal = self.create_travel_goal(50_000)
        result = reserve_for_goal(self.db, self.user.id, goal.id, GoalMoneyActionCreate(amount_cents=50_000, occurred_on=date(2026, 10, 1)))

        self.assertEqual(result.status, "completed")
        self.assertEqual(result.progress_pct, 100)

    def test_cannot_reserve_more_than_linked_track(self):
        goal = self.create_travel_goal(500_000)
        with self.assertRaises(GoalConflictError):
            reserve_for_goal(self.db, self.user.id, goal.id, GoalMoneyActionCreate(amount_cents=400_000, occurred_on=date(2026, 10, 1)))

    def test_goal_with_money_cannot_be_archived_or_change_track(self):
        goal = self.create_travel_goal()
        reserve_for_goal(self.db, self.user.id, goal.id, GoalMoneyActionCreate(amount_cents=10_000, occurred_on=date(2026, 10, 1)))

        with self.assertRaises(GoalConflictError):
            update_goal(self.db, self.user.id, goal.id, GoalUpdate(status="archived"))
        with self.assertRaises(GoalConflictError):
            update_goal(self.db, self.user.id, goal.id, GoalUpdate(linked_track_kind="essentials"))

    def test_other_users_goal_is_private(self):
        other_goal = Goal(user_id=self.other_user.id, name="Private", type_name="Other", linked_track_kind="lifestyle", status="active")
        self.db.add(other_goal)
        self.db.flush()

        with self.assertRaises(GoalNotFoundError):
            get_goal(self.db, self.user.id, other_goal.id)


class DebtTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.prepare_finances()

    def create_car_debt(self, balance: int = 200_000):
        return create_debt(
            self.db,
            self.user.id,
            DebtCreate(name="Car debt", starting_balance_cents=balance, planned_monthly_payment_cents=20_000),
        )

    def test_payment_reduces_cash_essentials_and_debt(self):
        debt = self.create_car_debt()
        result = pay_debt(self.db, self.user.id, debt.id, DebtPaymentCreate(amount_cents=50_000, occurred_on=date(2026, 10, 1)))

        self.assertEqual(result.current_balance_cents, 150_000)
        self.assertEqual(result.amount_paid_cents, 50_000)
        self.assertEqual(result.progress_pct, 25)
        self.assertEqual(get_total_money(self.db, self.user.id), 950_000)
        self.assertEqual(get_track_balances(self.db, self.user.id)["essentials"], 450_000)

    def test_exact_final_payment_marks_debt_paid(self):
        debt = self.create_car_debt(100_000)
        result = pay_debt(self.db, self.user.id, debt.id, DebtPaymentCreate(amount_cents=100_000, occurred_on=date(2026, 10, 1)))

        self.assertEqual(result.current_balance_cents, 0)
        self.assertEqual(result.status, "paid")

    def test_overpayment_and_insufficient_essentials_are_rejected(self):
        small_debt = self.create_car_debt(100_000)
        with self.assertRaises(DebtConflictError):
            pay_debt(self.db, self.user.id, small_debt.id, DebtPaymentCreate(amount_cents=110_000, occurred_on=date(2026, 10, 1)))

        large_debt = create_debt(self.db, self.user.id, DebtCreate(name="Large debt", starting_balance_cents=700_000))
        with self.assertRaises(DebtConflictError):
            pay_debt(self.db, self.user.id, large_debt.id, DebtPaymentCreate(amount_cents=600_000, occurred_on=date(2026, 10, 1)))

    def test_unpaid_debt_cannot_be_archived(self):
        debt = self.create_car_debt()
        with self.assertRaises(DebtConflictError):
            update_debt(self.db, self.user.id, debt.id, DebtUpdate(status="archived"))

    def test_other_users_debt_is_private(self):
        other_debt = create_debt(self.db, self.other_user.id, DebtCreate(name="Other debt", starting_balance_cents=10_000))
        with self.assertRaises(DebtNotFoundError):
            get_debt(self.db, self.user.id, other_debt.id)


if __name__ == "__main__":
    import unittest

    unittest.main()
