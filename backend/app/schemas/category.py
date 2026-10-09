from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


TrackKind = Literal["essentials", "lifestyle", "investments"]


def clean_name(value: str) -> str:
    name = value.strip()
    if not name:
        raise ValueError("Category name cannot be empty")
    return name


class CategoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=100)
    track_kind: TrackKind

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_name(value)


class CategoryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=100)
    track_kind: TrackKind | None = None
    active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return clean_name(value) if value is not None else None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    name: str
    track_kind: TrackKind
    is_system: bool
    active: bool