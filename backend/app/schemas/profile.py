from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_currency(value: str) -> str:
    currency = value.strip().upper()
    if len(currency) != 3 or not currency.isalpha():
        raise ValueError("Currency must be a three-letter code")
    return currency


class FinancialProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: str = "MAD"
    expected_monthly_income_cents: int = Field(gt=0)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)


class FinancialProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: str | None = None
    expected_monthly_income_cents: int | None = Field(default=None, gt=0)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value) if value is not None else None


class FinancialProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    currency: str
    expected_monthly_income_cents: int
    onboarding_completed_at: datetime | None
    created_at: datetime
    updated_at: datetime