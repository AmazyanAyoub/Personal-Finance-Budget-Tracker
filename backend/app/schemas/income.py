from datetime import date as date_entity, datetime

from pydantic import BaseModel, field_validator


class IncomeEntryCreate(BaseModel):
    name: str
    amount_cents: int
    date: date_entity
    note: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Income name is required")

        if len(cleaned) > 100:
            raise ValueError("Income name cannot exceed 100 characters")

        return cleaned

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_positive(cls, value: int):
        if value <= 0:
            raise ValueError("amount_cents must be positive")

        return value


class IncomeEntryUpdate(BaseModel):
    name: str | None = None
    amount_cents: int | None = None
    date: date_entity | None = None
    note: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None):
        if value is None:
            return value

        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Income name is required")

        if len(cleaned) > 100:
            raise ValueError("Income name cannot exceed 100 characters")

        return cleaned

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_positive(cls, value: int | None):
        if value is not None and value <= 0:
            raise ValueError("amount_cents must be positive")

        return value


class IncomeEntryOut(BaseModel):
    id: int
    name: str
    amount_cents: int
    date: date_entity
    is_recurring_base: bool
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlyIncomeSummary(BaseModel):
    year: int
    month: int
    total_cents: int
    base_income_cents: int
    additional_income_cents: int
    entry_count: int


class MonthlyIncomeUpdate(BaseModel):
    monthly_income_cents: int

    @field_validator("monthly_income_cents")
    @classmethod
    def validate_positive(cls, value: int):
        if value <= 0:
            raise ValueError("monthly_income_cents must be positive")

        return value


class MonthlyIncomeOut(BaseModel):
    monthly_income_cents: int


class AvailableSavingsUpdate(BaseModel):
    available_savings_cents: int | None = None

    @field_validator("available_savings_cents")
    @classmethod
    def validate_non_negative(cls, value: int | None):
        if value is not None and value < 0:
            raise ValueError(
                "available_savings_cents cannot be negative"
            )

        return value


class AvailableSavingsOut(BaseModel):
    available_savings_cents: int | None