import unittest
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.db.base import Base
from app.db.session import get_db
from app.main import app


class AuthAndApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _connection_record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def register(self, email: str = "new@example.com", password: str = "strongpass123") -> str:
        response = self.client.post("/auth/register", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["access_token"]

    def test_registration_login_and_current_user(self):
        token = self.register("New@Example.com")
        me = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        login = self.client.post("/auth/login", json={"email": "NEW@example.com", "password": "strongpass123"})

        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "new@example.com")
        self.assertEqual(login.status_code, 200)
        self.assertIn("access_token", login.json())

    def test_duplicate_registration_and_wrong_password_are_rejected(self):
        self.register()
        duplicate = self.client.post("/auth/register", json={"email": "NEW@example.com", "password": "strongpass123"})
        wrong_login = self.client.post("/auth/login", json={"email": "new@example.com", "password": "wrong-password"})

        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(wrong_login.status_code, 401)

    def test_complete_api_flow_from_registration_to_dashboard(self):
        token = self.register()
        headers = {"Authorization": f"Bearer {token}"}
        today = date.today().isoformat()

        onboarding = self.client.post(
            "/onboarding",
            headers=headers,
            json={
                "currency": "MAD",
                "expected_monthly_income_cents": 100_000,
                "essentials_pct": 50,
                "lifestyle_pct": 30,
                "investments_pct": 20,
                "emergency_fund_months": 3,
                "current_total_money_cents": 100_000,
                "current_emergency_fund_cents": 10_000,
            },
        )
        self.assertEqual(onboarding.status_code, 201, onboarding.text)

        category = self.client.post(
            "/categories",
            headers=headers,
            json={"name": "Groceries", "track_kind": "essentials"},
        )
        self.assertEqual(category.status_code, 201, category.text)

        income = self.client.post(
            "/money/income",
            headers={**headers, "Idempotency-Key": "api-income-1"},
            json={"name": "Salary", "amount_cents": 50_000, "occurred_on": today},
        )
        self.assertEqual(income.status_code, 201, income.text)

        expense = self.client.post(
            "/money/expenses",
            headers={**headers, "Idempotency-Key": "api-expense-1"},
            json={"amount_cents": 5_000, "category_id": category.json()["id"], "occurred_on": today},
        )
        self.assertEqual(expense.status_code, 201, expense.text)

        dashboard = self.client.get("/dashboard", headers=headers)
        self.assertEqual(dashboard.status_code, 200, dashboard.text)
        self.assertEqual(dashboard.json()["total_money_cents"], 145_000)
        self.assertEqual(dashboard.json()["monthly_activity"]["income_cents"], 50_000)
        self.assertEqual(dashboard.json()["monthly_activity"]["expenses_cents"], 5_000)

    def test_v2_routes_are_registered(self):
        paths = {route.path for route in app.routes}
        required = {
            "/auth/register",
            "/onboarding",
            "/settings/profile",
            "/categories",
            "/money/income",
            "/goals",
            "/debts",
            "/investments",
            "/dashboard",
        }
        self.assertTrue(required.issubset(paths))


if __name__ == "__main__":
    unittest.main()
