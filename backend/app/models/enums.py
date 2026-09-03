import enum


class IncomeMode(str, enum.Enum):
    FIXED_ONLY = "fixed_only"
    FIXED_PLUS_FREELANCE = "fixed_plus_freelance"
    FREELANCE_ONLY = "freelance_only"


class IncomeSource(str, enum.Enum):
    FIXED = "fixed"
    FREELANCE = "freelance"


class BudgetBucket(str, enum.Enum):
    ESSENTIALS = "essentials"
    LIFESTYLE = "lifestyle"
