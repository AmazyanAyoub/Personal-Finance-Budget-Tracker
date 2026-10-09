from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


AssetStatus = Literal["active", "sold", "archived"]
EditableAssetStatus = Literal["active", "archived"]
TradeAction = Literal["buy", "sell"]
UnitsAction = Literal["split", "adjustment"]
TransactionAction = Literal["buy", "sell", "dividend", "fee", "split", "adjustment"]
ValuationSource = Literal["manual", "market_api", "estimated"]


def clean_required_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} cannot be empty")
    return cleaned


def normalize_currency(value: str) -> str:
    currency = value.strip().upper()
    if len(currency) != 3 or not currency.isalpha():
        raise ValueError("Currency must be a three-letter code")
    return currency


class InvestmentAssetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_type: str = Field(max_length=50)
    name: str = Field(max_length=150)
    symbol: str | None = Field(default=None, max_length=30)
    currency: str = "MAD"

    @field_validator("asset_type")
    @classmethod
    def validate_asset_type(cls, value: str) -> str:
        return clean_required_text(value, "Asset type")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_required_text(value, "Asset name")

    @field_validator("symbol")
    @classmethod
    def clean_symbol(cls, value: str | None) -> str | None:
        return value.strip().upper() or None if value is not None else None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)


class InvestmentAssetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_type: str | None = Field(default=None, max_length=50)
    name: str | None = Field(default=None, max_length=150)
    symbol: str | None = Field(default=None, max_length=30)
    status: EditableAssetStatus | None = None

    @field_validator("asset_type", "name")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return clean_required_text(value, "Value") if value is not None else None

    @field_validator("symbol")
    @classmethod
    def clean_symbol(cls, value: str | None) -> str | None:
        return value.strip().upper() or None if value is not None else None


class InvestmentTradeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: TradeAction
    units: Decimal = Field(gt=0, max_digits=24, decimal_places=8)
    unit_price_cents: int = Field(gt=0)
    fees_cents: int = Field(default=0, ge=0)
    exchange_rate_to_profile: Decimal | None = Field(default=None, gt=0, max_digits=24, decimal_places=8)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)


class InvestmentIncomeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_cents: int = Field(gt=0)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)


class InvestmentFeeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_cents: int = Field(gt=0)
    occurred_on: date
    note: str | None = Field(default=None, max_length=500)


class InvestmentUnitsChangeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: UnitsAction
    units_change: Decimal = Field(max_digits=24, decimal_places=8)
    occurred_on: date

    @field_validator("units_change")
    @classmethod
    def validate_units_change(cls, value: Decimal) -> Decimal:
        if value == 0:
            raise ValueError("Units change cannot be zero")
        return value


class InvestmentValuationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_per_unit_cents: int | None = Field(default=None, ge=0)
    total_value_cents: int | None = Field(default=None, ge=0)
    as_of_date: date

    @model_validator(mode="after")
    def validate_value(self) -> Self:
        if (self.price_per_unit_cents is None) == (self.total_value_cents is None):
            raise ValueError("Provide either price per unit or total value, but not both")
        return self


class InvestmentAssetOut(BaseModel):
    id: int
    user_id: int
    asset_type: str
    name: str
    symbol: str | None
    currency: str
    status: AssetStatus
    current_units: Decimal
    current_value_cents: int | None
    created_at: datetime


class InvestmentTransactionOut(BaseModel):
    id: int
    investment_asset_id: int
    money_event_id: int | None
    action: TransactionAction
    units_change: Decimal
    unit_price_cents: int | None
    fees_cents: int
    exchange_rate_to_profile: Decimal | None
    occurred_on: date
    created_at: datetime


class InvestmentValuationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    investment_asset_id: int
    price_per_unit_cents: int | None
    total_value_cents: int | None
    as_of_date: date
    source: ValuationSource
    created_at: datetime