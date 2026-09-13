from datetime import date as date_entity, datetime

from pydantic import BaseModel, field_validator

from app.models.enums import IncomeSource


class IncomeEntryCreate(BaseModel):
    source: IncomeSource
    amount_cents: int
    date: date_entity
    note: str | None = None

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_positive(cls, v):
        if v <= 0:
            raise ValueError("amount_cents must be positive")
        return v


class IncomeEntryUpdate(BaseModel):
    source: IncomeSource | None = None
    amount_cents: int | None = None
    date: date_entity | None = None
    note: str | None = None

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("amount_cents must be positive")
        return v


class IncomeEntryOut(BaseModel):
    id: int
    source: IncomeSource
    amount_cents: int
    date:  date_entity
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlyIncomeSummary(BaseModel):
    year: int
    month: int
    total_cents: int
    fixed_cents: int
    freelance_cents: int
    entry_count: int


class FixedSalaryUpdate(BaseModel):
    fixed_salary_cents: int | None = None

    @field_validator("fixed_salary_cents")
    @classmethod
    def validate_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("fixed_salary_cents must be positive")
        return v


class FixedSalaryOut(BaseModel):
    fixed_salary_cents: int | None
