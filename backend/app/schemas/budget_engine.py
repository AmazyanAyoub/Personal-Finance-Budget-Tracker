from pydantic import BaseModel, field_validator


class EFBalanceUpdate(BaseModel):
    current_balance_cents: int

    @field_validator("current_balance_cents")
    @classmethod
    def validate_non_negative(cls, value):
        if value < 0:
            raise ValueError("current_balance_cents cannot be negative")
        return value


class BudgetEngineStatus(BaseModel):
    year: int
    month: int
    monthly_income_cents: int
    freedom_funds_cents: int
    essentials_cents: int
    lifestyle_cents: int
    ef_target_cents: int
    ef_current_balance_cents: int
    ef_gap_cents: int
    ef_is_met: bool
    projected_months_to_target: float | None
    recommended_ef_cents: int
    recommended_investments_cents: int