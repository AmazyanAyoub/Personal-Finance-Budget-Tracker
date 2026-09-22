from datetime import date as date_type, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Integer,
    String,
    Index,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IncomeConfig(Base):
    __tablename__ = "income_config"
    __table_args__ = (
        CheckConstraint(
            "monthly_income_cents > 0",
            name="income_config_monthly_income_positive",
        ),
        CheckConstraint(
            """
            available_savings_cents IS NULL
            OR available_savings_cents >= 0
            """,
            name="income_config_available_savings_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    monthly_income_cents: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    available_savings_cents: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )


class IncomeEntry(Base):
    __tablename__ = "income_entries"
    __table_args__ = (
        CheckConstraint(
            "amount_cents > 0",
            name="income_entry_amount_positive",
        ),
        Index(
            "uq_income_entries_recurring_base_date",
            "date",
            unique=True,
            postgresql_where=text(
                "is_recurring_base = true"
            ),
            sqlite_where=text(
                "is_recurring_base = 1"
            ),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    is_recurring_base: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )