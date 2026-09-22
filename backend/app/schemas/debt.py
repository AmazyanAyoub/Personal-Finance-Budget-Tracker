from datetime import date as date_entity, datetime
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator


PaymentType = Literal["regular", "extra"]
FundingSource = Literal["current_income", "existing_savings"]


class DebtCreate(BaseModel):
    name: str
    balance_cents: int
    monthly_payment_cents: int
    payoff_target_date: date_entity | None = None

    @field_validator("balance_cents", "monthly_payment_cents")
    @classmethod
    def validate_positive(cls, value: int):
        if value <= 0:
            raise ValueError("must be positive")

        return value


class DebtUpdate(BaseModel):
    name: str | None = None
    monthly_payment_cents: int | None = None
    payoff_target_date: date_entity | None = None

    @field_validator("monthly_payment_cents")
    @classmethod
    def validate_positive(cls, value: int | None):
        if value is not None and value <= 0:
            raise ValueError("must be positive")

        return value


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
    payment_type: PaymentType = "regular"
    funding_source: FundingSource | None = None
    note: str | None = None

    @field_validator("amount_cents")
    @classmethod
    def validate_positive(cls, value: int):
        if value <= 0:
            raise ValueError("amount_cents must be positive")

        return value

    @model_validator(mode="after")
    def validate_funding_source(self):
        if (
            self.payment_type == "regular"
            and self.funding_source is not None
        ):
            raise ValueError(
                "funding_source is only used for extra payments"
            )

        return self


class DebtPaymentOut(BaseModel):
    id: int
    debt_id: int
    amount_cents: int
    date: date_entity
    payment_type: PaymentType
    funding_source: FundingSource | None
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True