from pydantic import BaseModel, field_validator

from app.schemas.budget import BudgetSplitOut


class OnboardingRequest(BaseModel):
    monthly_income_cents: int
    available_savings_cents: int | None = None
    freedom_funds_pct: int
    essentials_pct: int
    lifestyle_pct: int
    ef_multiplier: int
    current_ef_balance_cents: int

    @field_validator("monthly_income_cents")
    @classmethod
    def validate_monthly_income(cls, value: int):
        if value <= 0:
            raise ValueError(
                "monthly_income_cents must be positive"
            )

        return value

    @field_validator("available_savings_cents")
    @classmethod
    def validate_available_savings(cls, value: int | None):
        if value is not None and value < 0:
            raise ValueError(
                "available_savings_cents cannot be negative"
            )

        return value

    @field_validator("lifestyle_pct")
    @classmethod
    def validate_split_sums_to_100(cls, value, info):
        total = (
            info.data.get("freedom_funds_pct", 0)
            + info.data.get("essentials_pct", 0)
            + value
        )

        if total != 100:
            raise ValueError(
                "freedom_funds_pct + essentials_pct + "
                "lifestyle_pct must sum to 100"
            )

        return value

    @field_validator("ef_multiplier")
    @classmethod
    def validate_multiplier_range(cls, value: int):
        if not 3 <= value <= 6:
            raise ValueError(
                "ef_multiplier must be between 3 and 6"
            )

        return value

    @field_validator("current_ef_balance_cents")
    @classmethod
    def validate_current_ef_balance(cls, value: int):
        if value < 0:
            raise ValueError(
                "current_ef_balance_cents cannot be negative"
            )

        return value


class OnboardingStatus(BaseModel):
    is_onboarded: bool
    monthly_income_cents: int | None = None
    available_savings_cents: int | None = None
    ef_multiplier: int | None = None
    ef_target_cents: int | None = None
    current_ef_balance_cents: int | None = None
    current_budget_split: BudgetSplitOut | None = None