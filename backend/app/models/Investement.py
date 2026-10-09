from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


RECORD_ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class InvestmentAsset(Base):
    __tablename__ = "investment_assets"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'sold', 'archived')", name="investment_asset_status_valid"),
        UniqueConstraint("user_id", "name", name="investment_asset_user_name_unique"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    symbol: Mapped[str | None] = mapped_column(String(30), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="MAD", server_default="MAD", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"
    __table_args__ = (
        CheckConstraint("action IN ('buy', 'sell', 'dividend', 'fee', 'split', 'adjustment')", name="investment_transaction_action_valid"),
        CheckConstraint("fees_cents >= 0", name="investment_transaction_fees_non_negative"),
        CheckConstraint("unit_price_cents IS NULL OR unit_price_cents >= 0", name="investment_transaction_unit_price_non_negative"),
        CheckConstraint("exchange_rate_to_profile IS NULL OR exchange_rate_to_profile > 0", name="investment_transaction_exchange_rate_positive"),
    )

    id: Mapped[int] = mapped_column(RECORD_ID_TYPE, primary_key=True)
    investment_asset_id: Mapped[int] = mapped_column(ForeignKey("investment_assets.id", ondelete="CASCADE"), index=True, nullable=False)
    money_event_id: Mapped[int | None] = mapped_column(ForeignKey("money_events.id", ondelete="RESTRICT"), unique=True, nullable=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    units_delta: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0, server_default="0", nullable=False)
    unit_price_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    fees_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    exchange_rate_to_profile: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    occurred_on: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InvestmentValuation(Base):
    __tablename__ = "investment_valuations"
    __table_args__ = (
        CheckConstraint(
            "(price_per_unit_cents IS NOT NULL AND total_value_cents IS NULL) OR "
            "(price_per_unit_cents IS NULL AND total_value_cents IS NOT NULL)",
            name="investment_valuation_exactly_one_value",
        ),
        CheckConstraint("price_per_unit_cents IS NULL OR price_per_unit_cents >= 0", name="investment_valuation_price_non_negative"),
        CheckConstraint("total_value_cents IS NULL OR total_value_cents >= 0", name="investment_valuation_total_non_negative"),
        CheckConstraint("source IN ('manual', 'market_api', 'estimated')", name="investment_valuation_source_valid"),
        UniqueConstraint("investment_asset_id", "as_of_date", name="investment_valuation_asset_date_unique"),
    )

    id: Mapped[int] = mapped_column(RECORD_ID_TYPE, primary_key=True)
    investment_asset_id: Mapped[int] = mapped_column(ForeignKey("investment_assets.id", ondelete="CASCADE"), index=True, nullable=False)
    price_per_unit_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_value_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="manual", server_default="manual", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)