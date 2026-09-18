import unittest

from app.api.routes.budget_engine import calculate_budget_recommendation


class BudgetEngineTests(unittest.TestCase):
    # 2,000 MAD of Freedom Funds; 30,000 MAD EF target
    freedom_funds = 200_000
    target = 3_000_000

    def test_one_cent_below_target(self):
        result = calculate_budget_recommendation(
            self.freedom_funds, self.target, self.target - 1
        )

        self.assertFalse(result.ef_is_met)
        self.assertEqual(result.ef_gap_cents, 1)
        self.assertEqual(result.recommended_ef_cents, self.freedom_funds)
        self.assertEqual(result.recommended_investments_cents, 0)
        self.assertEqual(result.recommended_debt_cents, 0)

    def test_exactly_at_target(self):
        result = calculate_budget_recommendation(
            self.freedom_funds, self.target, self.target
        )

        self.assertTrue(result.ef_is_met)
        self.assertEqual(result.ef_gap_cents, 0)
        self.assertEqual(result.recommended_ef_cents, 0)
        self.assertEqual(result.recommended_investments_cents, self.freedom_funds)
        self.assertEqual(result.recommended_debt_cents, 0)

    def test_above_target(self):
        result = calculate_budget_recommendation(
            self.freedom_funds, self.target, self.target + 100_000
        )

        self.assertTrue(result.ef_is_met)
        self.assertEqual(result.ef_gap_cents, 0)
        self.assertEqual(result.recommended_ef_cents, 0)
        self.assertEqual(result.recommended_investments_cents, self.freedom_funds)
        self.assertEqual(result.recommended_debt_cents, 0)


if __name__ == "__main__":
    unittest.main()