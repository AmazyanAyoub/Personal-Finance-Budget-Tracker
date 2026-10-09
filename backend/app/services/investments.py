from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.Investement import InvestmentAsset, InvestmentTransaction, InvestmentValuation
from app.models.money_event import MoneyEvent
from app.models.profile import FinancialProfile
from app.schemas.investment import InvestmentAssetCreate, InvestmentAssetOut, InvestmentAssetUpdate, InvestmentFeeCreate, InvestmentIncomeCreate, InvestmentTradeCreate, InvestmentTransactionOut, InvestmentUnitsChangeCreate, InvestmentValuationCreate, InvestmentValuationOut
from app.schemas.money_action import EventCorrectionCreate
from app.schemas.money_event import MoneyEventCreate
from app.services.ledger import create_event, get_event, get_track_balances


class InvestmentError(Exception):
    """Base error for invalid investment operations."""


class InvestmentNotFoundError(InvestmentError):
    """Raised when an investment record does not exist or belongs to another user."""


class InvestmentConflictError(InvestmentError):
    """Raised when an investment action conflicts with the current portfolio state."""


def _get_asset(db: Session, user_id: int, asset_id: int) -> InvestmentAsset:
    """Loads one investment asset owned by the current user."""
    asset = db.query(InvestmentAsset).filter(InvestmentAsset.id == asset_id, InvestmentAsset.user_id == user_id).first()

    if asset is None:
        raise InvestmentNotFoundError("Investment asset was not found")

    return asset


def _get_transaction(db: Session, user_id: int, transaction_id: int) -> tuple[InvestmentTransaction, InvestmentAsset]:
    """Loads one transaction through its asset so another user's transaction cannot be accessed."""
    result = (
        db.query(InvestmentTransaction, InvestmentAsset)
        .join(InvestmentAsset, InvestmentAsset.id == InvestmentTransaction.investment_asset_id)
        .filter(InvestmentTransaction.id == transaction_id, InvestmentAsset.user_id == user_id)
        .first()
    )

    if result is None:
        raise InvestmentNotFoundError("Investment transaction was not found")

    return result


def _get_profile_currency(db: Session, user_id: int) -> str:
    """Loads the currency used for the user's total money and investment track."""
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == user_id).first()

    if profile is None:
        raise InvestmentConflictError("Complete onboarding before recording investments")

    return profile.currency


def _current_units(db: Session, asset_id: int, through_date: date | None = None) -> Decimal:
    """Calculates owned units by adding every unit change instead of storing a duplicated total."""
    query = db.query(func.coalesce(func.sum(InvestmentTransaction.units_delta), 0)).filter(
        InvestmentTransaction.investment_asset_id == asset_id
    )

    if through_date is not None:
        query = query.filter(InvestmentTransaction.occurred_on <= through_date)

    return Decimal(query.scalar() or 0)


def _latest_valuation(db: Session, asset_id: int, as_of_date: date) -> InvestmentValuation | None:
    """Returns the newest valuation available on or before the requested date."""
    return (
        db.query(InvestmentValuation)
        .filter(
            InvestmentValuation.investment_asset_id == asset_id,
            InvestmentValuation.as_of_date <= as_of_date,
        )
        .order_by(InvestmentValuation.as_of_date.desc(), InvestmentValuation.id.desc())
        .first()
    )


def _current_value(db: Session, asset: InvestmentAsset, units: Decimal, as_of_date: date) -> int | None:
    """Calculates current value from the latest manually recorded valuation."""
    if asset.status == "sold":
        return 0

    valuation = _latest_valuation(db, asset.id, as_of_date)

    if valuation is None:
        return None
    if valuation.total_value_cents is not None:
        return int(valuation.total_value_cents)

    value = units * Decimal(valuation.price_per_unit_cents or 0)
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _asset_output(db: Session, asset: InvestmentAsset, as_of_date: date) -> InvestmentAssetOut:
    """Builds an asset response with calculated units and its latest value."""
    units = _current_units(db, asset.id, as_of_date)

    return InvestmentAssetOut(
        id=asset.id,
        user_id=asset.user_id,
        asset_type=asset.asset_type,
        name=asset.name,
        symbol=asset.symbol,
        currency=asset.currency,
        status=asset.status,
        current_units=units,
        current_value_cents=_current_value(db, asset, units, as_of_date),
        created_at=asset.created_at,
    )


def _transaction_output(transaction: InvestmentTransaction) -> InvestmentTransactionOut:
    """Converts the model's units_delta field into the API schema's units_change field."""
    return InvestmentTransactionOut(
        id=transaction.id,
        investment_asset_id=transaction.investment_asset_id,
        money_event_id=transaction.money_event_id,
        action=transaction.action,
        units_change=transaction.units_delta,
        unit_price_cents=transaction.unit_price_cents,
        fees_cents=transaction.fees_cents,
        exchange_rate_to_profile=transaction.exchange_rate_to_profile,
        occurred_on=transaction.occurred_on,
        created_at=transaction.created_at,
    )


def _valuation_output(valuation: InvestmentValuation) -> InvestmentValuationOut:
    """Converts a stored valuation into its API response."""
    return InvestmentValuationOut.model_validate(valuation)


def _conversion_rate(asset: InvestmentAsset, profile_currency: str, supplied_rate: Decimal | None) -> Decimal:
    """Returns one for matching currencies and requires an exchange rate for foreign-currency trades."""
    if asset.currency == profile_currency:
        if supplied_rate is not None and supplied_rate != Decimal("1"):
            raise InvestmentConflictError("Exchange rate must be 1 when the currencies match")
        return Decimal("1")

    if supplied_rate is None:
        raise InvestmentConflictError(f"An exchange rate from {asset.currency} to {profile_currency} is required")

    return supplied_rate


def _trade_value_cents(units: Decimal, unit_price_cents: int, exchange_rate: Decimal) -> int:
    """Converts a trade's units and price into whole cents in the profile currency."""
    value = units * Decimal(unit_price_cents) * exchange_rate
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _sync_asset_status(asset: InvestmentAsset, current_units: Decimal) -> None:
    """Marks a non-archived asset as active when units remain or sold when they reach zero."""
    if asset.status == "archived":
        return

    asset.status = "sold" if current_units == 0 else "active"


def _existing_transaction(db: Session, user_id: int, asset_id: int, idempotency_key: str | None, expected_action: str) -> InvestmentTransaction | None:
    """Returns an already-created transaction when the same frontend request is safely retried."""
    if idempotency_key is None:
        return None

    event = db.query(MoneyEvent).filter(MoneyEvent.user_id == user_id, MoneyEvent.idempotency_key == idempotency_key).first()

    if event is None:
        return None

    transaction = db.query(InvestmentTransaction).filter(InvestmentTransaction.money_event_id == event.id).first()

    if transaction is None or transaction.investment_asset_id != asset_id or transaction.action != expected_action:
        raise InvestmentConflictError("This request key was already used for another action")

    return transaction


def create_asset(db: Session, user_id: int, data: InvestmentAssetCreate, as_of_date: date) -> InvestmentAssetOut:
    """Creates an empty investment asset that can later receive trades and valuations."""
    duplicate = (
        db.query(InvestmentAsset.id)
        .filter(InvestmentAsset.user_id == user_id, func.lower(InvestmentAsset.name) == data.name.lower())
        .first()
    )

    if duplicate is not None:
        raise InvestmentConflictError("An investment asset with this name already exists")

    asset = InvestmentAsset(
        user_id=user_id,
        asset_type=data.asset_type,
        name=data.name,
        symbol=data.symbol,
        currency=data.currency,
        status="active",
    )

    db.add(asset)
    db.flush()

    return _asset_output(db, asset, as_of_date)


def get_asset(db: Session, user_id: int, asset_id: int, as_of_date: date) -> InvestmentAssetOut:
    """Returns one investment asset with calculated units and current value."""
    return _asset_output(db, _get_asset(db, user_id, asset_id), as_of_date)


def list_assets(db: Session, user_id: int, as_of_date: date, include_archived: bool = False) -> list[InvestmentAssetOut]:
    """Lists the user's investments while calculating each position from transactions and valuations."""
    query = db.query(InvestmentAsset).filter(InvestmentAsset.user_id == user_id)

    if not include_archived:
        query = query.filter(InvestmentAsset.status != "archived")

    assets = query.order_by(InvestmentAsset.created_at.desc()).all()
    return [_asset_output(db, asset, as_of_date) for asset in assets]


def update_asset(db: Session, user_id: int, asset_id: int, data: InvestmentAssetUpdate, as_of_date: date) -> InvestmentAssetOut:
    """Updates asset details while preventing an investment containing units from being archived."""
    asset = _get_asset(db, user_id, asset_id)
    units = _current_units(db, asset.id)
    changes = data.model_dump(exclude_unset=True)

    if "name" in changes:
        duplicate = (
            db.query(InvestmentAsset.id)
            .filter(
                InvestmentAsset.user_id == user_id,
                InvestmentAsset.id != asset.id,
                func.lower(InvestmentAsset.name) == changes["name"].lower(),
            )
            .first()
        )

        if duplicate is not None:
            raise InvestmentConflictError("An investment asset with this name already exists")

    if changes.get("status") == "archived" and units != 0:
        raise InvestmentConflictError("An investment containing units cannot be archived")

    for field, value in changes.items():
        setattr(asset, field, value)

    db.flush()
    return _asset_output(db, asset, as_of_date)


def record_trade(db: Session, user_id: int, asset_id: int, data: InvestmentTradeCreate, idempotency_key: str | None = None) -> InvestmentTransactionOut:
    """Records a buy or sell, updates owned units and creates the matching cash event."""
    asset = _get_asset(db, user_id, asset_id)
    existing = _existing_transaction(db, user_id, asset.id, idempotency_key, data.action)

    if existing is not None:
        return _transaction_output(existing)
    if asset.status == "archived":
        raise InvestmentConflictError("An archived investment cannot receive trades")

    profile_currency = _get_profile_currency(db, user_id)
    rate = _conversion_rate(asset, profile_currency, data.exchange_rate_to_profile)
    gross_value = _trade_value_cents(data.units, data.unit_price_cents, rate)
    current_units = _current_units(db, asset.id)

    if data.action == "buy":
        cash_change = -(gross_value + data.fees_cents)
        units_change = data.units
        event_type = "investment_buy"

        if get_track_balances(db, user_id)["investments"] < -cash_change:
            raise InvestmentConflictError("Not enough money is available in Investments")
    else:
        if current_units < data.units:
            raise InvestmentConflictError("You cannot sell more units than you own")
        if data.fees_cents >= gross_value:
            raise InvestmentConflictError("Selling fees must be lower than the sale value")

        cash_change = gross_value - data.fees_cents
        units_change = -data.units
        event_type = "investment_sell"

    money_event = create_event(
        db,
        user_id,
        MoneyEventCreate(
            event_type=event_type,
            cash_delta_cents=cash_change,
            investments_delta_cents=cash_change,
            occurred_on=data.occurred_on,
            note=data.note or f"{data.action.title()} {asset.name}",
            idempotency_key=idempotency_key,
        ),
    )

    transaction = InvestmentTransaction(
        investment_asset_id=asset.id,
        money_event_id=money_event.id,
        action=data.action,
        units_delta=units_change,
        unit_price_cents=data.unit_price_cents,
        fees_cents=data.fees_cents,
        exchange_rate_to_profile=data.exchange_rate_to_profile,
        occurred_on=data.occurred_on,
    )

    db.add(transaction)
    db.flush()
    _sync_asset_status(asset, current_units + units_change)
    db.flush()

    return _transaction_output(transaction)


def record_income(db: Session, user_id: int, asset_id: int, data: InvestmentIncomeCreate, idempotency_key: str | None = None) -> InvestmentTransactionOut:
    """Records dividends or other investment income and adds the money to the Investments track."""
    asset = _get_asset(db, user_id, asset_id)
    existing = _existing_transaction(db, user_id, asset.id, idempotency_key, "dividend")

    if existing is not None:
        return _transaction_output(existing)
    if asset.status == "archived":
        raise InvestmentConflictError("An archived investment cannot receive income")

    money_event = create_event(
        db,
        user_id,
        MoneyEventCreate(
            event_type="investment_income",
            cash_delta_cents=data.amount_cents,
            investments_delta_cents=data.amount_cents,
            occurred_on=data.occurred_on,
            note=data.note or f"Income from {asset.name}",
            idempotency_key=idempotency_key,
        ),
    )

    transaction = InvestmentTransaction(
        investment_asset_id=asset.id,
        money_event_id=money_event.id,
        action="dividend",
        units_delta=0,
        fees_cents=0,
        occurred_on=data.occurred_on,
    )

    db.add(transaction)
    db.flush()

    return _transaction_output(transaction)


def record_fee(db: Session, user_id: int, asset_id: int, data: InvestmentFeeCreate, idempotency_key: str | None = None) -> InvestmentTransactionOut:
    """Records an investment fee and removes it from total money and the Investments track."""
    asset = _get_asset(db, user_id, asset_id)
    existing = _existing_transaction(db, user_id, asset.id, idempotency_key, "fee")

    if existing is not None:
        return _transaction_output(existing)
    if asset.status == "archived":
        raise InvestmentConflictError("An archived investment cannot receive fees")
    if get_track_balances(db, user_id)["investments"] < data.amount_cents:
        raise InvestmentConflictError("Not enough money is available in Investments")

    money_event = create_event(
        db,
        user_id,
        MoneyEventCreate(
            event_type="investment_fee",
            cash_delta_cents=-data.amount_cents,
            investments_delta_cents=-data.amount_cents,
            occurred_on=data.occurred_on,
            note=data.note or f"Fee for {asset.name}",
            idempotency_key=idempotency_key,
        ),
    )

    transaction = InvestmentTransaction(
        investment_asset_id=asset.id,
        money_event_id=money_event.id,
        action="fee",
        units_delta=0,
        fees_cents=data.amount_cents,
        occurred_on=data.occurred_on,
    )

    db.add(transaction)
    db.flush()

    return _transaction_output(transaction)


def record_units_change(db: Session, user_id: int, asset_id: int, data: InvestmentUnitsChangeCreate) -> InvestmentTransactionOut:
    """Records a split or manual unit correction without changing the user's money."""
    asset = _get_asset(db, user_id, asset_id)

    if asset.status == "archived":
        raise InvestmentConflictError("An archived investment cannot receive unit changes")

    current_units = _current_units(db, asset.id)
    new_units = current_units + data.units_change

    if new_units < 0:
        raise InvestmentConflictError("The unit change cannot make owned units negative")

    transaction = InvestmentTransaction(
        investment_asset_id=asset.id,
        action=data.action,
        units_delta=data.units_change,
        fees_cents=0,
        occurred_on=data.occurred_on,
    )

    db.add(transaction)
    db.flush()
    _sync_asset_status(asset, new_units)
    db.flush()

    return _transaction_output(transaction)


def add_valuation(db: Session, user_id: int, asset_id: int, data: InvestmentValuationCreate) -> InvestmentValuationOut:
    """Records a manual value for an asset; values must be entered in the user's profile currency."""
    asset = _get_asset(db, user_id, asset_id)

    if asset.status == "archived":
        raise InvestmentConflictError("An archived investment cannot receive valuations")

    duplicate = (
        db.query(InvestmentValuation.id)
        .filter(
            InvestmentValuation.investment_asset_id == asset.id,
            InvestmentValuation.as_of_date == data.as_of_date,
        )
        .first()
    )

    if duplicate is not None:
        raise InvestmentConflictError("A valuation already exists for this asset and date")

    valuation = InvestmentValuation(
        investment_asset_id=asset.id,
        price_per_unit_cents=data.price_per_unit_cents,
        total_value_cents=data.total_value_cents,
        as_of_date=data.as_of_date,
        source="manual",
    )

    db.add(valuation)
    db.flush()

    return _valuation_output(valuation)


def list_transactions(db: Session, user_id: int, asset_id: int) -> list[InvestmentTransactionOut]:
    """Lists the complete transaction history for one owned investment asset."""
    asset = _get_asset(db, user_id, asset_id)
    transactions = (
        db.query(InvestmentTransaction)
        .filter(InvestmentTransaction.investment_asset_id == asset.id)
        .order_by(InvestmentTransaction.occurred_on.desc(), InvestmentTransaction.id.desc())
        .all()
    )

    return [_transaction_output(transaction) for transaction in transactions]


def list_valuations(db: Session, user_id: int, asset_id: int) -> list[InvestmentValuationOut]:
    """Lists every recorded valuation for one owned investment asset."""
    asset = _get_asset(db, user_id, asset_id)
    valuations = (
        db.query(InvestmentValuation)
        .filter(InvestmentValuation.investment_asset_id == asset.id)
        .order_by(InvestmentValuation.as_of_date.desc(), InvestmentValuation.id.desc())
        .all()
    )

    return [_valuation_output(valuation) for valuation in valuations]


def reverse_transaction(db: Session, user_id: int, transaction_id: int, data: EventCorrectionCreate, idempotency_key: str | None = None) -> InvestmentTransactionOut:
    """Cancels a mistaken cash-changing investment transaction and creates the opposite unit change."""
    transaction, asset = _get_transaction(db, user_id, transaction_id)

    if transaction.money_event_id is None:
        raise InvestmentConflictError("Correct a units-only transaction by recording an opposite unit adjustment")

    existing = _existing_transaction(db, user_id, asset.id, idempotency_key, "adjustment")

    if existing is not None:
        return _transaction_output(existing)

    original_event = get_event(db, user_id, transaction.money_event_id)

    if original_event.event_type == "reversal":
        raise InvestmentConflictError("A correction cannot be corrected again")

    already_reversed = db.query(MoneyEvent.id).filter(MoneyEvent.reverses_event_id == original_event.id).first()

    if already_reversed is not None:
        raise InvestmentConflictError("This investment transaction has already been cancelled")

    units_before = _current_units(db, asset.id)
    reversed_units = -transaction.units_delta

    if units_before + reversed_units < 0:
        raise InvestmentConflictError("Later transactions must be corrected before cancelling this transaction")

    money_removed = max(original_event.investments_delta_cents, 0)

    if money_removed > get_track_balances(db, user_id)["investments"]:
        raise InvestmentConflictError("Not enough money remains in Investments to cancel this transaction")

    reversal_event = create_event(
        db,
        user_id,
        MoneyEventCreate(
            event_type="reversal",
            cash_delta_cents=-original_event.cash_delta_cents,
            essentials_delta_cents=-original_event.essentials_delta_cents,
            lifestyle_delta_cents=-original_event.lifestyle_delta_cents,
            investments_delta_cents=-original_event.investments_delta_cents,
            occurred_on=data.occurred_on,
            note=f"Correction for investment transaction #{transaction.id}: {data.reason}"[:500],
            idempotency_key=idempotency_key,
            reverses_event_id=original_event.id,
        ),
    )

    correction = InvestmentTransaction(
        investment_asset_id=asset.id,
        money_event_id=reversal_event.id,
        action="adjustment",
        units_delta=reversed_units,
        unit_price_cents=transaction.unit_price_cents,
        fees_cents=0,
        exchange_rate_to_profile=transaction.exchange_rate_to_profile,
        occurred_on=data.occurred_on,
    )

    db.add(correction)
    db.flush()
    _sync_asset_status(asset, units_before + reversed_units)
    db.flush()

    return _transaction_output(correction)