from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


DebtStatus = Literal["active", "paid", "archived"]
EditableDebtStatus = Literal["active", "archived"]


def clean_name(value: str) -> str:
    name = value.strip()
    if not name:
        raise ValueError("Debt name cannot be empty")
    return name


class DebtCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=255)
    starting_balance_cents: int = Field(gt=0)
    planned_monthly_payment_cents: int = Field(default=0, ge=0)
    target_date: date | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_name(value)


class DebtUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=255)
    planned_monthly_payment_cents: int | None = Field(default=None, ge=0)
    target_date: date | None = None
    status: EditableDebtStatus | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return clean_name(value) if value is not None else None


class DebtPaymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_cents: int = Field(gt=0)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class DebtOut(BaseModel):
    id: int
    user_id: int
    name: str
    starting_balance_cents: int
    current_balance_cents: int
    amount_paid_cents: int
    progress_pct: float
    planned_monthly_payment_cents: int
    target_date: date | None
    status: DebtStatus
    created_at: datetime