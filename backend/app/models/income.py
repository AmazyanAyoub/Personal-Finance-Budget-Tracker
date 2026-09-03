from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import IncomeMode, IncomeSource


class IncomeModeConfig(Base):
    __tablename__ = "income_mode_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mode: Mapped[IncomeMode] = mapped_column(Enum(IncomeMode, name="income_mode"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class IncomeEntry(Base):
    __tablename__ = "income_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[IncomeSource] = mapped_column(Enum(IncomeSource, name="income_source"), nullable=False)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
