import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.income import (
    BASE_INCOME_NAME,
    sync_current_month_base_income,
)
from app.models.income import IncomeConfig, IncomeEntry


class IncomeGenerationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:"
        )

        IncomeConfig.__table__.create(self.engine)
        IncomeEntry.__table__.create(self.engine)

        self.db = Session(self.engine)

        self.config = IncomeConfig(
            monthly_income_cents=1_000_000,
        )

        self.db.add(self.config)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_current_month_base_entry_created_once(self):
        today = date.today()

        first_changed = sync_current_month_base_income(
            db=self.db,
            year=today.year,
            month=today.month,
        )
        self.db.commit()

        second_changed = sync_current_month_base_income(
            db=self.db,
            year=today.year,
            month=today.month,
        )
        self.db.commit()

        entries = self.db.query(IncomeEntry).all()

        self.assertTrue(first_changed)
        self.assertFalse(second_changed)
        self.assertEqual(len(entries), 1)
        self.assertEqual(
            entries[0].name,
            BASE_INCOME_NAME,
        )
        self.assertEqual(
            entries[0].amount_cents,
            1_000_000,
        )
        self.assertTrue(
            entries[0].is_recurring_base
        )

    def test_current_entry_updates_without_duplicate(self):
        today = date.today()

        sync_current_month_base_income(
            db=self.db,
            year=today.year,
            month=today.month,
        )
        self.db.commit()

        self.config.monthly_income_cents = 1_500_000
        self.db.commit()

        changed = sync_current_month_base_income(
            db=self.db,
            year=today.year,
            month=today.month,
        )
        self.db.commit()

        entries = self.db.query(IncomeEntry).all()

        self.assertTrue(changed)
        self.assertEqual(len(entries), 1)
        self.assertEqual(
            entries[0].amount_cents,
            1_500_000,
        )

    def test_historical_month_is_not_generated(self):
        today = date.today()

        if today.month == 1:
            historical_year = today.year - 1
            historical_month = 12
        else:
            historical_year = today.year
            historical_month = today.month - 1

        changed = sync_current_month_base_income(
            db=self.db,
            year=historical_year,
            month=historical_month,
        )
        self.db.commit()

        entries = self.db.query(IncomeEntry).all()

        self.assertFalse(changed)
        self.assertEqual(len(entries), 0)


if __name__ == "__main__":
    unittest.main()