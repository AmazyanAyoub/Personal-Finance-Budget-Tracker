from datetime import date, datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MoneyEventType = Literal[
    "opening_balance",
    "income",
    "expense",
    "goal_reserve",
    "goal_release",
    "goal_spend",
    "track_transfer",
    "debt_payment",
    "investment_buy",
    "investment_sell",
    "investment_income",
    "investment_fee",
    "balance_adjustment",
    "reversal",
]


class MoneyEventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: MoneyEventType
    cash_delta_cents: int = 0
    essentials_delta_cents: int = 0
    lifestyle_delta_cents: int = 0
    investments_delta_cents: int = 0
    category_id: int | None = Field(default=None, gt=0)
    goal_id: int | None = Field(default=None, gt=0)
    goal_delta_cents: int = 0
    debt_id: int | None = Field(default=None, gt=0)
    debt_delta_cents: int = 0
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)
    idempotency_key: str | None = Field(default=None, max_length=100)
    reverses_event_id: int | None = Field(default=None, gt=0)

    @field_validator("note", "idempotency_key")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_event(self) -> Self:
        track_total = self.essentials_delta_cents + self.lifestyle_delta_cents + self.investments_delta_cents + self.goal_delta_cents

        if self.cash_delta_cents != track_total:
            raise ValueError("Cash change must equal the combined track and goal changes")
        if self.goal_delta_cents != 0 and self.goal_id is None:
            raise ValueError("A goal ID is required when changing a goal balance")
        if self.debt_delta_cents != 0 and self.debt_id is None:
            raise ValueError("A debt ID is required when changing a debt balance")
        if self.event_type == "income" and self.cash_delta_cents <= 0:
            raise ValueError("Income must increase your total money")

        if self.event_type == "expense":
            if self.cash_delta_cents >= 0:
                raise ValueError("An expense must decrease your total money")
            if self.category_id is None:
                raise ValueError("A category is required for an expense")
        if self.event_type in {"goal_reserve", "goal_release", "goal_spend"} and self.goal_id is None:
            raise ValueError("A goal ID is required for a goal event")
        if self.event_type == "debt_payment" and self.debt_id is None:
            raise ValueError("A debt ID is required for a debt payment")
        if self.event_type == "reversal" and self.reverses_event_id is None:
            raise ValueError("A reversed event ID is required for a reversal")
        if self.event_type != "reversal" and self.reverses_event_id is not None:
            raise ValueError("Only reversal events can reference a reversed event")
        return self


class MoneyEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    event_type: MoneyEventType
    cash_delta_cents: int
    essentials_delta_cents: int
    lifestyle_delta_cents: int
    investments_delta_cents: int
    category_id: int | None
    goal_id: int | None
    goal_delta_cents: int
    debt_id: int | None
    debt_delta_cents: int
    occurred_on: date
    note: str | None
    idempotency_key: str | None
    reverses_event_id: int | None
    created_at: datetime