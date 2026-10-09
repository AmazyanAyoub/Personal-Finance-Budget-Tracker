from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


EVENT_ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class MoneyEvent(Base):
    __tablename__ = "money_events"
    __table_args__ = (
        CheckConstraint(
            "cash_delta_cents = essentials_delta_cents + lifestyle_delta_cents + investments_delta_cents + goal_delta_cents",
            name="money_event_balances",
        ),
        CheckConstraint(
            "event_type IN ('opening_balance', 'income', 'expense', 'goal_reserve', 'goal_release', 'goal_spend', 'track_transfer', 'debt_payment', 'investment_buy', 'investment_sell', 'investment_income', 'investment_fee', 'balance_adjustment', 'reversal')",
            name="money_event_type_valid",
        ),
        CheckConstraint("goal_id IS NOT NULL OR goal_delta_cents = 0", name="money_event_goal_delta_linked"),
        CheckConstraint("debt_id IS NOT NULL OR debt_delta_cents = 0", name="money_event_debt_delta_linked"),
        UniqueConstraint("user_id", "idempotency_key", name="money_event_user_idempotency_unique"),
        UniqueConstraint("reverses_event_id", name="money_event_reversed_once"),
        Index("ix_money_events_user_date", "user_id", "occurred_on"),
    )

    id: Mapped[int] = mapped_column(EVENT_ID_TYPE, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)

    cash_delta_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    essentials_delta_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    lifestyle_delta_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    investments_delta_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)

    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), nullable=True)
    goal_id: Mapped[int | None] = mapped_column(ForeignKey("goals.id", ondelete="RESTRICT"), index=True, nullable=True)
    goal_delta_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    debt_id: Mapped[int | None] = mapped_column(ForeignKey("debts.id", ondelete="RESTRICT"), index=True, nullable=True)
    debt_delta_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)

    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reverses_event_id: Mapped[int | None] = mapped_column(EVENT_ID_TYPE, ForeignKey("money_events.id", ondelete="RESTRICT"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)