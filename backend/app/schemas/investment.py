from datetime import date as date_entity, datetime

from pydantic import BaseModel, field_validator


class InvestmentTypeOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class InvestmentCreate(BaseModel):
    investment_type_id: int
    amount_cents: int
    date: date_entity
    note: str | None = None

    @field_validator("amount_cents")
    @classmethod
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError("amount_cents must be positive")
        return v


class InvestmentOut(BaseModel):
    id: int
    investment_type_id: int
    amount_cents: int
    date: date_entity
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class InvestmentTypeTotal(BaseModel):
    type: str
    amount_cents: int


class InvestmentSummary(BaseModel):
    total_invested_cents: int
    by_type: list[InvestmentTypeTotal]
