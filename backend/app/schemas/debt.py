from datetime import date as date_entity, datetime

from pydantic import BaseModel, field_validator


class DebtCreate(BaseModel):
    name: str
    balance_cents: int
    monthly_payment_cents: int
    payoff_target_date: date_entity | None = None

    @field_validator("balance_cents", "monthly_payment_cents")
    @classmethod
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError("must be positive")
        return v


class DebtUpdate(BaseModel):
    name: str | None = None
    monthly_payment_cents: int | None = None
    payoff_target_date: date_entity | None = None

    @field_validator("monthly_payment_cents")
    @classmethod
    def validate_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("must be positive")
        return v


class DebtOut(BaseModel):
    id: int
    name: str
    starting_balance_cents: int
    current_balance_cents: int
    monthly_payment_cents: int
    payoff_target_date: date_entity | None
    total_paid_cents: int
    progress_pct: float
    is_paid_off: bool
    created_at: datetime


class DebtPaymentCreate(BaseModel):
    amount_cents: int
    date: date_entity
    note: str | None = None

    @field_validator("amount_cents")
    @classmethod
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError("amount_cents must be positive")
        return v


class DebtPaymentOut(BaseModel):
    id: int
    debt_id: int
    amount_cents: int
    date: date_entity
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True
