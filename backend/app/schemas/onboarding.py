from pydantic import BaseModel, field_validator, model_validator

from app.models.enums import IncomeMode
from app.schemas.budget import BudgetSplitOut

class OnboardingRequest(BaseModel):
    income_mode: IncomeMode
    freedom_funds_pct: int
    essentials_pct: int
    lifestyle_pct: int
    ef_multiplier: int
    fixed_salary_cents: int | None = None
    estimated_monthly_income_cents: int

    @field_validator("lifestyle_pct")
    @classmethod
    def validate_split_sums_to_100(cls, v, info):
        total = info.data.get("freedom_funds_pct", 0) + info.data.get("essentials_pct", 0) + v
        if total != 100:
            raise ValueError("freedom_funds_pct + essentials_pct + lifestyle_pct must sum to 100")
        return v

    @field_validator("ef_multiplier")
    @classmethod
    def validate_multiplier_range(cls, v):
        if not (3 <= v <= 6):
            raise ValueError("ef_multiplier must be between 3 and 6")
        return v

    @field_validator("estimated_monthly_income_cents")
    @classmethod
    def validate_income_positive(cls, v):
        if v <= 0:
            raise ValueError("estimated_monthly_income_cents must be positive")
        return v

    @model_validator(mode="after")
    def validate_fixed_salary(self):
        has_fixed_income = self.income_mode in {
            IncomeMode.FIXED_ONLY,
            IncomeMode.FIXED_PLUS_FREELANCE,
        }

        if has_fixed_income:
            if self.fixed_salary_cents is None or self.fixed_salary_cents <= 0:
                raise ValueError(
                    "A positive fixed salary is required for this income mode"
                )

            if self.fixed_salary_cents > self.estimated_monthly_income_cents:
                raise ValueError(
                    "Fixed salary cannot exceed estimated monthly income"
                )

        return self

class OnboardingStatus(BaseModel):
    is_onboarded: bool
    income_mode: IncomeMode | None = None
    ef_multiplier: int | None = None
    ef_target_cents: int | None = None
    current_budget_split: BudgetSplitOut | None = None
