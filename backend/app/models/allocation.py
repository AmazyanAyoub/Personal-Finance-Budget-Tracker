from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AllocationPlan(Base):
    __tablename__ = "allocation_plans"
    __table_args__ = (
        CheckConstraint("essentials_pct BETWEEN 0 AND 100", name="allocation_essentials_range"),
        CheckConstraint("lifestyle_pct BETWEEN 0 AND 100", name="allocation_lifestyle_range"),
        CheckConstraint("investments_pct BETWEEN 0 AND 100", name="allocation_investments_range"),
        CheckConstraint("essentials_pct + lifestyle_pct + investments_pct = 100", name="allocation_sums_to_100"),
        UniqueConstraint("user_id", "effective_from", name="allocation_user_effective_unique"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    essentials_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    lifestyle_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    investments_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)