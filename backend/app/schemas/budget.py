from datetime import date

from pydantic import BaseModel, field_validator


class BudgetSplitCreate(BaseModel):
    freedom_funds_pct: int
    essentials_pct: int
    lifestyle_pct: int
    effective_date: date | None = None

    @field_validator("lifestyle_pct")
    @classmethod
    def validate_sums_to_100(cls, v, info):
        total = info.data.get("freedom_funds_pct", 0) + info.data.get("essentials_pct", 0) + v
        if total != 100:
            raise ValueError("percentages must sum to 100")
        return v


class BudgetSplitOut(BaseModel):
    id: int
    freedom_funds_pct: int
    essentials_pct: int
    lifestyle_pct: int
    effective_date: date

    class Config:
        from_attributes = True
