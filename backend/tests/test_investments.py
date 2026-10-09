from datetime import date
from decimal import Decimal

from app.schemas.investment import InvestmentAssetCreate, InvestmentAssetUpdate, InvestmentFeeCreate, InvestmentIncomeCreate, InvestmentTradeCreate, InvestmentUnitsChangeCreate, InvestmentValuationCreate
from app.schemas.money_action import EventCorrectionCreate
from app.services.investments import InvestmentConflictError, add_valuation, create_asset, get_asset, record_fee, record_income, record_trade, record_units_change, reverse_transaction, update_asset
from app.services.ledger import get_total_money, get_track_balances
from tests.support import DatabaseTestCase


class InvestmentTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.prepare_finances()

    def create_stock(self, name: str = "IAM", currency: str = "MAD"):
        return create_asset(
            self.db,
            self.user.id,
            InvestmentAssetCreate(asset_type="Stock", name=name, symbol=name, currency=currency),
            date(2026, 10, 1),
        )

    def test_buy_and_sell_update_units_and_investment_money(self):
        asset = self.create_stock()
        purchase = record_trade(
            self.db,
            self.user.id,
            asset.id,
            InvestmentTradeCreate(action="buy", units=Decimal("10"), unit_price_cents=1_000, fees_cents=500, occurred_on=date(2026, 10, 1)),
        )

        self.assertEqual(purchase.units_change, Decimal("10"))
        self.assertEqual(get_asset(self.db, self.user.id, asset.id, date(2026, 10, 1)).current_units, Decimal("10"))
        self.assertEqual(get_total_money(self.db, self.user.id), 989_500)
        self.assertEqual(get_track_balances(self.db, self.user.id)["investments"], 189_500)

        sale = record_trade(
            self.db,
            self.user.id,
            asset.id,
            InvestmentTradeCreate(action="sell", units=Decimal("4"), unit_price_cents=2_000, fees_cents=200, occurred_on=date(2026, 10, 2)),
        )

        self.assertEqual(sale.units_change, Decimal("-4"))
        self.assertEqual(get_asset(self.db, self.user.id, asset.id, date(2026, 10, 2)).current_units, Decimal("6"))
        self.assertEqual(get_total_money(self.db, self.user.id), 997_300)

    def test_cannot_buy_without_track_money_or_sell_unowned_units(self):
        asset = self.create_stock()
        with self.assertRaises(InvestmentConflictError):
            record_trade(self.db, self.user.id, asset.id, InvestmentTradeCreate(action="buy", units=Decimal("300"), unit_price_cents=1_000, occurred_on=date(2026, 10, 1)))
        with self.assertRaises(InvestmentConflictError):
            record_trade(self.db, self.user.id, asset.id, InvestmentTradeCreate(action="sell", units=Decimal("1"), unit_price_cents=1_000, occurred_on=date(2026, 10, 1)))

    def test_income_and_fee_change_investment_track(self):
        asset = self.create_stock()
        record_income(self.db, self.user.id, asset.id, InvestmentIncomeCreate(amount_cents=5_000, occurred_on=date(2026, 10, 1)))
        record_fee(self.db, self.user.id, asset.id, InvestmentFeeCreate(amount_cents=1_000, occurred_on=date(2026, 10, 2)))

        self.assertEqual(get_total_money(self.db, self.user.id), 1_004_000)
        self.assertEqual(get_track_balances(self.db, self.user.id)["investments"], 204_000)

    def test_valuation_calculates_current_value(self):
        asset = self.create_stock()
        record_trade(self.db, self.user.id, asset.id, InvestmentTradeCreate(action="buy", units=Decimal("10"), unit_price_cents=1_000, occurred_on=date(2026, 10, 1)))
        add_valuation(self.db, self.user.id, asset.id, InvestmentValuationCreate(price_per_unit_cents=1_500, as_of_date=date(2026, 10, 2)))

        result = get_asset(self.db, self.user.id, asset.id, date(2026, 10, 2))
        self.assertEqual(result.current_value_cents, 15_000)

    def test_foreign_trade_requires_exchange_rate(self):
        asset = self.create_stock("Apple", "USD")
        with self.assertRaises(InvestmentConflictError):
            record_trade(self.db, self.user.id, asset.id, InvestmentTradeCreate(action="buy", units=Decimal("1"), unit_price_cents=10_000, occurred_on=date(2026, 10, 1)))

        transaction = record_trade(
            self.db,
            self.user.id,
            asset.id,
            InvestmentTradeCreate(action="buy", units=Decimal("1"), unit_price_cents=10_000, exchange_rate_to_profile=Decimal("10"), occurred_on=date(2026, 10, 1)),
        )
        self.assertEqual(transaction.exchange_rate_to_profile, Decimal("10"))
        self.assertEqual(get_total_money(self.db, self.user.id), 900_000)

    def test_units_change_cannot_make_position_negative(self):
        asset = self.create_stock()
        record_units_change(self.db, self.user.id, asset.id, InvestmentUnitsChangeCreate(action="adjustment", units_change=Decimal("5"), occurred_on=date(2026, 10, 1)))

        with self.assertRaises(InvestmentConflictError):
            record_units_change(self.db, self.user.id, asset.id, InvestmentUnitsChangeCreate(action="adjustment", units_change=Decimal("-6"), occurred_on=date(2026, 10, 2)))

    def test_reversal_restores_cash_and_units(self):
        asset = self.create_stock()
        purchase = record_trade(
            self.db,
            self.user.id,
            asset.id,
            InvestmentTradeCreate(action="buy", units=Decimal("10"), unit_price_cents=1_000, occurred_on=date(2026, 10, 1)),
        )
        reverse_transaction(self.db, self.user.id, purchase.id, EventCorrectionCreate(occurred_on=date(2026, 10, 2), reason="Wrong purchase"))

        result = get_asset(self.db, self.user.id, asset.id, date(2026, 10, 2))
        self.assertEqual(result.current_units, 0)
        self.assertEqual(result.status, "sold")
        self.assertEqual(get_total_money(self.db, self.user.id), 1_000_000)

    def test_asset_with_units_cannot_be_archived(self):
        asset = self.create_stock()
        record_units_change(self.db, self.user.id, asset.id, InvestmentUnitsChangeCreate(action="adjustment", units_change=Decimal("1"), occurred_on=date(2026, 10, 1)))

        with self.assertRaises(InvestmentConflictError):
            update_asset(self.db, self.user.id, asset.id, InvestmentAssetUpdate(status="archived"), date(2026, 10, 2))


if __name__ == "__main__":
    import unittest

    unittest.main()
