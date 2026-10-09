from datetime import date

from app.models.category import Category
from app.schemas.allocation import AllocationPlanCreate
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.schemas.profile import FinancialProfileUpdate
from app.services.categories import CategoryConflictError, CategoryNotFoundError, create_category, list_categories, update_category
from app.services.settings import SettingsConflictError, create_allocation_plan, get_current_allocation_plan, get_profile, list_allocation_plans, update_profile
from tests.support import DatabaseTestCase


class CategoryTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.system_category = Category(name="Groceries", track_kind="essentials", is_system=True, active=True)
        self.other_category = Category(user_id=self.other_user.id, name="Other private", track_kind="lifestyle", is_system=False, active=True)
        self.db.add_all([self.system_category, self.other_category])
        self.db.flush()

    def test_list_contains_system_and_owned_categories_only(self):
        own = create_category(self.db, self.user.id, CategoryCreate(name="Gym", track_kind="lifestyle"))
        results = list_categories(self.db, self.user.id)
        names = {category.name for category in results}

        self.assertEqual(names, {"Groceries", own.name})
        self.assertNotIn("Other private", names)

    def test_system_name_cannot_be_duplicated(self):
        with self.assertRaises(CategoryConflictError):
            create_category(self.db, self.user.id, CategoryCreate(name="groceries", track_kind="lifestyle"))

    def test_system_category_cannot_be_edited(self):
        with self.assertRaises(CategoryNotFoundError):
            update_category(self.db, self.user.id, self.system_category.id, CategoryUpdate(name="Changed"))

    def test_deactivated_category_is_hidden_but_preserved(self):
        category = create_category(self.db, self.user.id, CategoryCreate(name="Gym", track_kind="lifestyle"))
        updated = update_category(self.db, self.user.id, category.id, CategoryUpdate(active=False))

        self.assertFalse(updated.active)
        self.assertNotIn("Gym", {item.name for item in list_categories(self.db, self.user.id)})
        self.assertIn("Gym", {item.name for item in list_categories(self.db, self.user.id, include_inactive=True)})


class SettingsTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.add_profile_and_plan(effective_from=date(2026, 1, 1))

    def test_profile_income_can_change_but_currency_cannot(self):
        updated = update_profile(self.db, self.user.id, FinancialProfileUpdate(expected_monthly_income_cents=1_500_000))
        self.assertEqual(updated.expected_monthly_income_cents, 1_500_000)
        self.assertEqual(get_profile(self.db, self.user.id).currency, "MAD")

        with self.assertRaises(SettingsConflictError):
            update_profile(self.db, self.user.id, FinancialProfileUpdate(currency="USD"))

    def test_new_plan_becomes_current_on_effective_date(self):
        create_allocation_plan(
            self.db,
            self.user.id,
            AllocationPlanCreate(essentials_pct=60, lifestyle_pct=20, investments_pct=20, effective_from=date(2026, 10, 1)),
        )

        september = get_current_allocation_plan(self.db, self.user.id, date(2026, 9, 30))
        october = get_current_allocation_plan(self.db, self.user.id, date(2026, 10, 1))
        history = list_allocation_plans(self.db, self.user.id)

        self.assertEqual(september.essentials_pct, 50)
        self.assertEqual(october.essentials_pct, 60)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].effective_from, date(2026, 10, 1))

    def test_duplicate_effective_date_is_rejected(self):
        with self.assertRaises(SettingsConflictError):
            create_allocation_plan(
                self.db,
                self.user.id,
                AllocationPlanCreate(essentials_pct=40, lifestyle_pct=30, investments_pct=30, effective_from=date(2026, 1, 1)),
            )


if __name__ == "__main__":
    import unittest

    unittest.main()
