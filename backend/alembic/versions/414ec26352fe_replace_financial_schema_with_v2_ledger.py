"""Replace the legacy financial schema with the V2 ledger.

Revision ID: 414ec26352fe
Revises: 6a6c76aa7c3a
Create Date: 2026-10-04 15:41:25.472833
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "414ec26352fe"
down_revision: str | None = "6a6c76aa7c3a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Delete the complete legacy financial schema while preserving users.
    op.execute(sa.text("DROP TABLE IF EXISTS wallet_transactions, surplus_allocations, debt_payments, expenses, investments, monthly_closes, wallets, investment_types, emergency_fund_config, income_entries, income_config, budget_splits, categories, debts CASCADE"))
    op.execute(sa.text("DROP TYPE IF EXISTS budget_bucket CASCADE"))

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("track_kind", sa.String(20), nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint("track_kind IN ('essentials', 'lifestyle', 'investments')", name="category_track_kind_valid"),
        sa.CheckConstraint("(is_system = true AND user_id IS NULL) OR (is_system = false AND user_id IS NOT NULL)", name="category_owner_valid"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"])
    op.create_index("uq_categories_system_name", "categories", [sa.text("lower(name)")], unique=True, postgresql_where=sa.text("user_id IS NULL"), sqlite_where=sa.text("user_id IS NULL"))
    op.create_index("uq_categories_user_name", "categories", ["user_id", sa.text("lower(name)")], unique=True, postgresql_where=sa.text("user_id IS NOT NULL"), sqlite_where=sa.text("user_id IS NOT NULL"))

    op.create_table(
        "debts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("starting_balance_cents", sa.BigInteger(), nullable=False),
        sa.Column("planned_monthly_payment_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("starting_balance_cents > 0", name="debt_starting_balance_positive"),
        sa.CheckConstraint("planned_monthly_payment_cents >= 0", name="debt_monthly_payment_non_negative"),
        sa.CheckConstraint("status IN ('active', 'paid', 'archived')", name="debt_status_valid"),
    )
    op.create_index("ix_debts_user_id", "debts", ["user_id"])
    op.create_index("uq_debts_user_name", "debts", ["user_id", sa.text("lower(name)")], unique=True)

    op.create_table(
        "financial_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("currency", sa.String(3), server_default="MAD", nullable=False),
        sa.Column("expected_monthly_income_cents", sa.BigInteger(), nullable=False),
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("expected_monthly_income_cents > 0", name="profile_expected_income_positive"),
    )
    op.create_index("ix_financial_profiles_user_id", "financial_profiles", ["user_id"], unique=True)

    op.create_table(
        "allocation_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("essentials_pct", sa.Integer(), nullable=False),
        sa.Column("lifestyle_pct", sa.Integer(), nullable=False),
        sa.Column("investments_pct", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("essentials_pct BETWEEN 0 AND 100", name="allocation_essentials_range"),
        sa.CheckConstraint("lifestyle_pct BETWEEN 0 AND 100", name="allocation_lifestyle_range"),
        sa.CheckConstraint("investments_pct BETWEEN 0 AND 100", name="allocation_investments_range"),
        sa.CheckConstraint("essentials_pct + lifestyle_pct + investments_pct = 100", name="allocation_sums_to_100"),
        sa.UniqueConstraint("user_id", "effective_from", name="allocation_user_effective_unique"),
    )
    op.create_index("ix_allocation_plans_user_id", "allocation_plans", ["user_id"])

    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("type_name", sa.String(100), nullable=False),
        sa.Column("linked_track_kind", sa.String(20), nullable=False),
        sa.Column("system_role", sa.String(30), nullable=True),
        sa.Column("target_cents", sa.BigInteger(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("linked_track_kind IN ('essentials', 'lifestyle', 'investments')", name="goal_track_kind_valid"),
        sa.CheckConstraint("system_role IS NULL OR system_role = 'emergency_fund'", name="goal_system_role_valid"),
        sa.CheckConstraint("target_cents IS NULL OR target_cents > 0", name="goal_target_positive"),
        sa.CheckConstraint("status IN ('active', 'completed', 'archived')", name="goal_status_valid"),
        sa.UniqueConstraint("user_id", "name", name="goal_user_name_unique"),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])
    op.create_index("uq_goals_user_emergency_fund", "goals", ["user_id"], unique=True, postgresql_where=sa.text("system_role = 'emergency_fund'"), sqlite_where=sa.text("system_role = 'emergency_fund'"))

    op.create_table(
        "investment_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("symbol", sa.String(30), nullable=True),
        sa.Column("currency", sa.String(3), server_default="MAD", nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('active', 'sold', 'archived')", name="investment_asset_status_valid"),
        sa.UniqueConstraint("user_id", "name", name="investment_asset_user_name_unique"),
    )
    op.create_index("ix_investment_assets_user_id", "investment_assets", ["user_id"])

    event_id_type = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

    op.create_table(
        "money_events",
        sa.Column("id", event_id_type, primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("cash_delta_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("essentials_delta_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("lifestyle_delta_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("investments_delta_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("goal_id", sa.Integer(), sa.ForeignKey("goals.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("goal_delta_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("debt_id", sa.Integer(), sa.ForeignKey("debts.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("debt_delta_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("idempotency_key", sa.String(100), nullable=True),
        sa.Column("reverses_event_id", event_id_type, sa.ForeignKey("money_events.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("cash_delta_cents = essentials_delta_cents + lifestyle_delta_cents + investments_delta_cents + goal_delta_cents", name="money_event_balances"),
        sa.CheckConstraint("event_type IN ('opening_balance', 'income', 'expense', 'goal_reserve', 'goal_release', 'goal_spend', 'track_transfer', 'debt_payment', 'investment_buy', 'investment_sell', 'investment_income', 'investment_fee', 'balance_adjustment', 'reversal')", name="money_event_type_valid"),
        sa.CheckConstraint("goal_id IS NOT NULL OR goal_delta_cents = 0", name="money_event_goal_delta_linked"),
        sa.CheckConstraint("debt_id IS NOT NULL OR debt_delta_cents = 0", name="money_event_debt_delta_linked"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="money_event_user_idempotency_unique"),
        sa.UniqueConstraint("reverses_event_id", name="money_event_reversed_once"),
    )
    op.create_index("ix_money_events_user_id", "money_events", ["user_id"])
    op.create_index("ix_money_events_goal_id", "money_events", ["goal_id"])
    op.create_index("ix_money_events_debt_id", "money_events", ["debt_id"])
    op.create_index("ix_money_events_user_date", "money_events", ["user_id", "occurred_on"])

    record_id_type = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

    op.create_table(
        "investment_transactions",
        sa.Column("id", record_id_type, primary_key=True),
        sa.Column("investment_asset_id", sa.Integer(), sa.ForeignKey("investment_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("money_event_id", event_id_type, sa.ForeignKey("money_events.id", ondelete="RESTRICT"), unique=True, nullable=True),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("units_delta", sa.Numeric(24, 8), server_default="0", nullable=False),
        sa.Column("unit_price_cents", sa.BigInteger(), nullable=True),
        sa.Column("fees_cents", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("exchange_rate_to_profile", sa.Numeric(24, 8), nullable=True),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("action IN ('buy', 'sell', 'dividend', 'fee', 'split', 'adjustment')", name="investment_transaction_action_valid"),
        sa.CheckConstraint("fees_cents >= 0", name="investment_transaction_fees_non_negative"),
        sa.CheckConstraint("unit_price_cents IS NULL OR unit_price_cents >= 0", name="investment_transaction_unit_price_non_negative"),
        sa.CheckConstraint("exchange_rate_to_profile IS NULL OR exchange_rate_to_profile > 0", name="investment_transaction_exchange_rate_positive"),
    )
    op.create_index("ix_investment_transactions_investment_asset_id", "investment_transactions", ["investment_asset_id"])
    op.create_index("ix_investment_transactions_occurred_on", "investment_transactions", ["occurred_on"])

    op.create_table(
        "investment_valuations",
        sa.Column("id", record_id_type, primary_key=True),
        sa.Column("investment_asset_id", sa.Integer(), sa.ForeignKey("investment_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("price_per_unit_cents", sa.BigInteger(), nullable=True),
        sa.Column("total_value_cents", sa.BigInteger(), nullable=True),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(20), server_default="manual", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("(price_per_unit_cents IS NOT NULL AND total_value_cents IS NULL) OR (price_per_unit_cents IS NULL AND total_value_cents IS NOT NULL)", name="investment_valuation_exactly_one_value"),
        sa.CheckConstraint("price_per_unit_cents IS NULL OR price_per_unit_cents >= 0", name="investment_valuation_price_non_negative"),
        sa.CheckConstraint("total_value_cents IS NULL OR total_value_cents >= 0", name="investment_valuation_total_non_negative"),
        sa.CheckConstraint("source IN ('manual', 'market_api', 'estimated')", name="investment_valuation_source_valid"),
        sa.UniqueConstraint("investment_asset_id", "as_of_date", name="investment_valuation_asset_date_unique"),
    )
    op.create_index("ix_investment_valuations_investment_asset_id", "investment_valuations", ["investment_asset_id"])


def downgrade() -> None:
    raise RuntimeError("Revision 414ec26352fe is intentionally irreversible because it permanently removes the legacy financial schema")