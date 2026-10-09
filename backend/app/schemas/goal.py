from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.category import TrackKind


GoalStatus = Literal["active", "completed", "archived"]


def clean_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} cannot be empty")
    return cleaned


class GoalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=100)
    type_name: str = Field(max_length=100)
    linked_track_kind: TrackKind
    target_cents: int | None = Field(default=None, gt=0)
    target_date: date | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_text(value, "Goal name")

    @field_validator("type_name")
    @classmethod
    def validate_type_name(cls, value: str) -> str:
        return clean_text(value, "Goal type")


class GoalUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=100)
    type_name: str | None = Field(default=None, max_length=100)
    linked_track_kind: TrackKind | None = None
    target_cents: int | None = Field(default=None, gt=0)
    target_date: date | None = None
    status: GoalStatus | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return clean_text(value, "Goal name") if value is not None else None

    @field_validator("type_name")
    @classmethod
    def validate_type_name(cls, value: str | None) -> str | None:
        return clean_text(value, "Goal type") if value is not None else None


class GoalMoneyActionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_cents: int = Field(gt=0)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

class GoalOut(BaseModel):
    id: int
    user_id: int
    name: str
    type_name: str
    linked_track_kind: TrackKind
    system_role: str | None
    target_cents: int | None
    target_date: date | None
    status: GoalStatus
    current_balance_cents: int
    remaining_cents: int | None
    progress_pct: float | None
    created_at: datetime
    updated_at: datetime