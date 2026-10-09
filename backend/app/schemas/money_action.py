from datetime import date
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.category import TrackKind


def clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class IncomeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    amount_cents: int = Field(gt=0)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str | None) -> str | None:
        return clean_optional_text(value)


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_cents: int = Field(gt=0)
    category_id: int = Field(gt=0)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str | None) -> str | None:
        return clean_optional_text(value)


class TrackTransferCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_track: TrackKind
    to_track: TrackKind
    amount_cents: int = Field(gt=0)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @model_validator(mode="after")
    def validate_tracks(self) -> Self:
        if self.from_track == self.to_track:
            raise ValueError("Source and destination tracks must be different")
        return self


class EventCorrectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    occurred_on: date
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: str) -> str:
        return value.strip()


class BalanceAdjustmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actual_total_money_cents: int = Field(ge=0)
    affected_track: TrackKind
    occurred_on: date
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: str) -> str:
        return value.strip()