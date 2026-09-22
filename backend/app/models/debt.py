from datetime import date as date_entity, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    balance_cents: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    monthly_payment_cents: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    payoff_target_date: Mapped[date_entity | None] = mapped_column(
        Date,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    payments: Mapped[list["DebtPayment"]] = relationship(
        back_populates="debt",
        cascade="all, delete-orphan",
    )


class DebtPayment(Base):
    __tablename__ = "debt_payments"
    __table_args__ = (
        CheckConstraint(
            "payment_type IN ('regular', 'extra')",
            name="debt_payment_type_valid",
        ),
        CheckConstraint(
            """
            funding_source IS NULL
            OR funding_source IN ('current_income', 'existing_savings')
            """,
            name="debt_payment_funding_source_valid",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    debt_id: Mapped[int] = mapped_column(
        ForeignKey("debts.id"),
        nullable=False,
    )
    amount_cents: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    date: Mapped[date_entity] = mapped_column(
        Date,
        nullable=False,
    )
    payment_type: Mapped[str] = mapped_column(
        String(20),
        default="regular",
        server_default="regular",
        nullable=False,
    )
    funding_source: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
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

    debt: Mapped["Debt"] = relationship(back_populates="payments")