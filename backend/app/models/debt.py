from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    starting_balance_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    planned_monthly_payment_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0", nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("starting_balance_cents > 0", name="debt_starting_balance_positive"),
        CheckConstraint("planned_monthly_payment_cents >= 0", name="debt_monthly_payment_non_negative"),
        CheckConstraint("status IN ('active', 'paid', 'archived')", name="debt_status_valid"),
        Index("uq_debts_user_name", "user_id", func.lower(name), unique=True),
    )