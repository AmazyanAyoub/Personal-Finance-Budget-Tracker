from datetime import date, datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AllocationPlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    essentials_pct: int = Field(ge=0, le=100)
    lifestyle_pct: int = Field(ge=0, le=100)
    investments_pct: int = Field(ge=0, le=100)
    effective_from: date

    @model_validator(mode="after")
    def validate_total(self) -> Self:
        if self.essentials_pct + self.lifestyle_pct + self.investments_pct != 100:
            raise ValueError("Allocation percentages must total 100")
        return self


class AllocationPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    essentials_pct: int
    lifestyle_pct: int
    investments_pct: int
    effective_from: date
    created_at: datetime