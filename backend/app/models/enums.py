import enum


class BudgetBucket(str, enum.Enum):
    ESSENTIALS = "essentials"
    LIFESTYLE = "lifestyle"