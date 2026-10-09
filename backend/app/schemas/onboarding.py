from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.allocation import AllocationPlanOut
from app.schemas.goal import GoalOut
from app.schemas.profile import FinancialProfileOut, normalize_currency


class OnboardingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: str = "MAD"
    expected_monthly_income_cents: int = Field(gt=0)
    essentials_pct: int = Field(ge=0, le=100)
    lifestyle_pct: int = Field(ge=0, le=100)
    investments_pct: int = Field(ge=0, le=100)
    emergency_fund_months: int = Field(ge=3, le=6)
    current_total_money_cents: int = Field(default=0, ge=0)
    current_emergency_fund_cents: int = Field(default=0, ge=0)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)

    @model_validator(mode="after")
    def validate_onboarding(self) -> Self:
        if self.essentials_pct + self.lifestyle_pct + self.investments_pct != 100:
            raise ValueError("Allocation percentages must total 100")
        if self.current_emergency_fund_cents > self.current_total_money_cents:
            raise ValueError("Emergency-fund money cannot exceed total declared money")
        return self


class OnboardingStatusOut(BaseModel):
    completed: bool
    completed_at: datetime | None


class OnboardingResultOut(BaseModel):
    profile: FinancialProfileOut
    allocation_plan: AllocationPlanOut
    emergency_fund_goal: GoalOut
    current_total_money_cents: int