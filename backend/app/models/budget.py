from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class BudgetSplit(Base):
    __tablename__ = "budget_splits"
    __table_args__ = (
        CheckConstraint(
            "freedom_funds_pct + essentials_pct + lifestyle_pct = 100",
            name="budget_split_sums_to_100",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    freedom_funds_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    essentials_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    lifestyle_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class EmergencyFundConfig(Base):
    __tablename__ = "emergency_fund_config"
    __table_args__ = (
        CheckConstraint("multiplier >= 3 AND multiplier <= 6", name="ef_multiplier_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    multiplier: Mapped[int] = mapped_column(Integer, nullable=False)
    # one-time estimate, used only to compute target_cents — not tracked ongoing
    estimated_monthly_income_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    # frozen at onboarding time — NEVER recomputed automatically from monthly income
    target_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    # the only field you update yourself, whenever you check your real balance
    current_balance_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class FreedomFundsAllocation(Base):
    __tablename__ = "freedom_funds_allocation"
    __table_args__ = (
        CheckConstraint("investments_pct + debt_pct = 100", name="ff_allocation_sums_to_100"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    investments_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    debt_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
