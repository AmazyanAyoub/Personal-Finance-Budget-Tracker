from pydantic import BaseModel, field_validator


class FreedomFundsAllocationCreate(BaseModel):
    investments_pct: int
    debt_pct: int

    @field_validator("debt_pct")
    @classmethod
    def validate_sums_to_100(cls, v, info):
        total = info.data.get("investments_pct", 0) + v
        if total != 100:
            raise ValueError("investments_pct + debt_pct must sum to 100")
        return v


class FreedomFundsAllocationOut(BaseModel):
    investments_pct: int
    debt_pct: int

    class Config:
        from_attributes = True


class EFBalanceUpdate(BaseModel):
    current_balance_cents: int

    @field_validator("current_balance_cents")
    @classmethod
    def validate_non_negative(cls, v):
        if v < 0:
            raise ValueError("current_balance_cents cannot be negative")
        return v


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
    recommended_debt_cents: int
