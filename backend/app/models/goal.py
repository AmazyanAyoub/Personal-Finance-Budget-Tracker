from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("linked_track_kind IN ('essentials', 'lifestyle', 'investments')", name="goal_track_kind_valid"),
        CheckConstraint("system_role IS NULL OR system_role = 'emergency_fund'", name="goal_system_role_valid"),
        CheckConstraint("target_cents IS NULL OR target_cents > 0", name="goal_target_positive"),
        CheckConstraint("status IN ('active', 'completed', 'archived')", name="goal_status_valid"),
        UniqueConstraint("user_id", "name", name="goal_user_name_unique"),
        Index(
            "uq_goals_user_emergency_fund",
            "user_id",
            unique=True,
            postgresql_where=text("system_role = 'emergency_fund'"),
            sqlite_where=text("system_role = 'emergency_fund'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type_name: Mapped[str] = mapped_column(String(100), nullable=False)
    linked_track_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    system_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)