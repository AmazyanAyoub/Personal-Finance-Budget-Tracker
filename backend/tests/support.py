import unittest
from datetime import date, datetime, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

import app.models
from app.db.base import Base
from app.models.allocation import AllocationPlan
from app.models.profile import FinancialProfile
from app.models.user import User
from app.schemas.money_event import MoneyEventCreate
from app.services.ledger import create_event


class DatabaseTestCase(unittest.TestCase):
    """Provides every V2 service test with a clean SQLite database and one user."""

    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _connection_record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.SessionLocal()

        self.user = User(
            email="owner@example.com",
            hashed_password="test-password",
        )

        self.other_user = User(
            email="other@example.com",
            hashed_password="test-password",
        )

        self.db.add_all([self.user, self.other_user])
        self.db.commit()
        self.db.refresh(self.user)
        self.db.refresh(self.other_user)

    def tearDown(self):
        self.db.rollback()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def add_profile_and_plan(
        self,
        user: User | None = None,
        expected_income_cents: int = 1_000_000,
        essentials_pct: int = 50,
        lifestyle_pct: int = 30,
        investments_pct: int = 20,
        effective_from: date = date(2026, 1, 1),
    ) -> tuple[FinancialProfile, AllocationPlan]:
        """Creates completed profile and allocation settings for service tests."""
        owner = user or self.user
        profile = FinancialProfile(
            user_id=owner.id,
            currency="MAD",
            expected_monthly_income_cents=expected_income_cents,
            onboarding_completed_at=datetime.now(timezone.utc),
        )
        plan = AllocationPlan(
            user_id=owner.id,
            essentials_pct=essentials_pct,
            lifestyle_pct=lifestyle_pct,
            investments_pct=investments_pct,
            effective_from=effective_from,
        )
        self.db.add_all([profile, plan])
        self.db.flush()
        return profile, plan

    def add_opening_balance(
        self,
        user: User | None = None,
        essentials_cents: int = 500_000,
        lifestyle_cents: int = 300_000,
        investments_cents: int = 200_000,
        occurred_on: date = date(2026, 1, 1),
    ):
        """Creates one balanced opening event for tests that need available money."""
        owner = user or self.user
        total = essentials_cents + lifestyle_cents + investments_cents
        return create_event(
            self.db,
            owner.id,
            MoneyEventCreate(
                event_type="opening_balance",
                cash_delta_cents=total,
                essentials_delta_cents=essentials_cents,
                lifestyle_delta_cents=lifestyle_cents,
                investments_delta_cents=investments_cents,
                occurred_on=occurred_on,
                note="Test opening balance",
                idempotency_key=f"test-opening:{owner.id}",
            ),
        )

    def prepare_finances(self, user: User | None = None) -> None:
        """Creates standard settings and opening money for a test user."""
        self.add_profile_and_plan(user=user)
        self.add_opening_balance(user=user)
