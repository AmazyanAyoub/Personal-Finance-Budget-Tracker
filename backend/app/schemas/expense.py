from datetime import date as date_type, datetime

from pydantic import BaseModel, field_validator


class ExpenseCreate(BaseModel):
    amount_cents: int
    note: str
    date: date_type
    category_id: int

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_positive(cls, v):
        if v <= 0:
            raise ValueError("amount_cents must be positive")
        return v


class ExpenseUpdate(BaseModel):
    amount_cents: int | None = None
    note: str | None = None
    date: date_type | None = None
    category_id: int | None = None

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("amount_cents must be positive")
        return v


class ExpenseOut(BaseModel):
    id: int
    amount_cents: int
    note: str
    date: date_type
    category_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlyExpenseSummary(BaseModel):
    year: int
    month: int
    total_cents: int
    essentials_cents: int
    lifestyle_cents: int
    entry_count: int
