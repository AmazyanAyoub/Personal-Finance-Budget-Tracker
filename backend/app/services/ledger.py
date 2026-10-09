from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.allocation import AllocationPlan
from app.models.category import Category
from app.models.debt import Debt
from app.models.goal import Goal
from app.models.money_event import MoneyEvent
from app.schemas.money_action import BalanceAdjustmentCreate, EventCorrectionCreate, ExpenseCreate, IncomeCreate, TrackTransferCreate
from app.schemas.money_event import MoneyEventCreate


class LedgerError(Exception):
    """Base error for invalid ledger operations."""


class LedgerNotFoundError(LedgerError):
    """Raised when a requested financial record does not exist or belongs to another user."""


class LedgerConflictError(LedgerError):
    """Raised when an action conflicts with the current financial state."""


def _track_changes(track_kind: str, amount_cents: int) -> dict[str, int]:
    """Builds the three track changes while changing only one track. This avoids repeating track-selection logic across income, expenses and adjustments."""
    changes = {"essentials_delta_cents": 0, "lifestyle_delta_cents": 0, "investments_delta_cents": 0}
    changes[f"{track_kind}_delta_cents"] = amount_cents
    return changes


def _get_category(db: Session, user_id: int, category_id: int, require_active: bool = True) -> Category:
    """Returns a system category or one owned by the current user. This prevents a user from using another user's category."""
    query = db.query(Category).filter(
        Category.id == category_id,
        or_(Category.user_id == user_id, Category.is_system.is_(True)),
    )

    if require_active:
        query = query.filter(Category.active.is_(True))

    category = query.first()

    if category is None:
        raise LedgerNotFoundError("Category was not found")

    return category


def _get_goal(db: Session, user_id: int, goal_id: int) -> Goal:
    """Returns a goal owned by the user. Every goal-related money event must be connected to the correct owner."""
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()

    if goal is None:
        raise LedgerNotFoundError("Goal was not found")

    return goal


def _get_debt(db: Session, user_id: int, debt_id: int) -> Debt:
    """Returns a debt owned by the user. This protects debt balances from cross-user changes."""
    debt = db.query(Debt).filter(Debt.id == debt_id, Debt.user_id == user_id).first()

    if debt is None:
        raise LedgerNotFoundError("Debt was not found")

    return debt


def get_event(db: Session, user_id: int, event_id: int) -> MoneyEvent:
    """Returns one money event owned by the user. This is used before showing or correcting an event."""
    event = db.query(MoneyEvent).filter(MoneyEvent.id == event_id, MoneyEvent.user_id == user_id).first()

    if event is None:
        raise LedgerNotFoundError("Money event was not found")

    return event


def get_current_allocation_plan(db: Session, user_id: int, on_date: date) -> AllocationPlan:
    """Returns the newest allocation plan active on a given date. Income uses this plan so historical income keeps the percentages that applied at that time."""
    plan = (
        db.query(AllocationPlan)
        .filter(AllocationPlan.user_id == user_id, AllocationPlan.effective_from <= on_date)
        .order_by(AllocationPlan.effective_from.desc(), AllocationPlan.id.desc())
        .first()
    )

    if plan is None:
        raise LedgerNotFoundError("No allocation plan exists for this date")

    return plan


def split_income(amount_cents: int, plan: AllocationPlan) -> dict[str, int]:
    """Divides income between Essentials, Lifestyle and Investments. Investments receives any final rounding cents so the three amounts always equal the original income."""
    essentials = amount_cents * plan.essentials_pct // 100
    lifestyle = amount_cents * plan.lifestyle_pct // 100
    investments = amount_cents - essentials - lifestyle

    return {
        "essentials_delta_cents": essentials,
        "lifestyle_delta_cents": lifestyle,
        "investments_delta_cents": investments,
    }


def _validate_event_links(db: Session, user_id: int, data: MoneyEventCreate) -> None:
    """Checks ownership of every category, goal, debt or corrected event before saving. Database foreign keys prove that records exist, but this function also proves they belong to the current user."""
    if data.category_id is not None:
        _get_category(db, user_id, data.category_id, require_active=data.event_type != "reversal")

    if data.goal_id is not None:
        _get_goal(db, user_id, data.goal_id)

    if data.debt_id is not None:
        _get_debt(db, user_id, data.debt_id)

    if data.reverses_event_id is not None:
        original = get_event(db, user_id, data.reverses_event_id)
        already_reversed = db.query(MoneyEvent.id).filter(MoneyEvent.reverses_event_id == original.id).first()

        if original.event_type == "reversal":
            raise LedgerConflictError("A reversal cannot reverse another reversal")

        if already_reversed is not None:
            raise LedgerConflictError("This money event has already been reversed")


def create_event(db: Session, user_id: int, data: MoneyEventCreate) -> MoneyEvent:
    """Creates the central financial record after checking ownership and duplicate protection. It flushes but does not commit so larger operations can remain atomic."""
    if data.idempotency_key is not None:
        existing = (
            db.query(MoneyEvent)
            .filter(MoneyEvent.user_id == user_id, MoneyEvent.idempotency_key == data.idempotency_key)
            .first()
        )

        if existing is not None:
            return existing

    _validate_event_links(db, user_id, data)

    event = MoneyEvent(user_id=user_id, **data.model_dump())
    db.add(event)
    db.flush()

    return event


def record_income(db: Session, user_id: int, data: IncomeCreate, idempotency_key: str | None = None) -> MoneyEvent:
    """Records received income and automatically divides it using the allocation plan active on that date. The user enters only the income amount; the backend handles the tracks."""
    plan = get_current_allocation_plan(db, user_id, data.occurred_on)
    track_changes = split_income(data.amount_cents, plan)
    description = data.name if data.note is None else f"{data.name}: {data.note}"

    event_data = MoneyEventCreate(
        event_type="income",
        cash_delta_cents=data.amount_cents,
        occurred_on=data.occurred_on,
        note=description[:500],
        idempotency_key=idempotency_key,
        **track_changes,
    )

    return create_event(db, user_id, event_data)


def record_expense(db: Session, user_id: int, data: ExpenseCreate, idempotency_key: str | None = None) -> MoneyEvent:
    """Records spending and removes it from the category's track. Categories decide whether an expense belongs to Essentials, Lifestyle or Investments."""
    category = _get_category(db, user_id, data.category_id)
    track_changes = _track_changes(category.track_kind, -data.amount_cents)

    event_data = MoneyEventCreate(
        event_type="expense",
        cash_delta_cents=-data.amount_cents,
        category_id=category.id,
        occurred_on=data.occurred_on,
        note=data.note,
        idempotency_key=idempotency_key,
        **track_changes,
    )

    return create_event(db, user_id, event_data)


def transfer_between_tracks(db: Session, user_id: int, data: TrackTransferCreate, idempotency_key: str | None = None) -> MoneyEvent:
    """Moves planned money between two tracks without changing total cash. It prevents moving more money than the source track currently contains."""
    balances = get_track_balances(db, user_id, data.occurred_on)

    if balances[data.from_track] < data.amount_cents:
        raise LedgerConflictError(f"Not enough money is available in the {data.from_track} track")

    changes = {"essentials_delta_cents": 0, "lifestyle_delta_cents": 0, "investments_delta_cents": 0}
    changes[f"{data.from_track}_delta_cents"] = -data.amount_cents
    changes[f"{data.to_track}_delta_cents"] = data.amount_cents

    event_data = MoneyEventCreate(
        event_type="track_transfer",
        cash_delta_cents=0,
        occurred_on=data.occurred_on,
        note=data.note,
        idempotency_key=idempotency_key,
        **changes,
    )

    return create_event(db, user_id, event_data)


def adjust_total_balance(db: Session, user_id: int, data: BalanceAdjustmentCreate, idempotency_key: str | None = None) -> MoneyEvent:
    """Reconciles Nisba's total with the money the user actually has. The difference is assigned to the selected track so the ledger remains balanced."""
    current_total = get_total_money(db, user_id, data.occurred_on)
    difference = data.actual_total_money_cents - current_total

    if difference == 0:
        raise LedgerConflictError("The entered balance already matches the ledger")

    track_changes = _track_changes(data.affected_track, difference)

    event_data = MoneyEventCreate(
        event_type="balance_adjustment",
        cash_delta_cents=difference,
        occurred_on=data.occurred_on,
        note=data.reason,
        idempotency_key=idempotency_key,
        **track_changes,
    )

    return create_event(db, user_id, event_data)


def reverse_event(db: Session, user_id: int, event_id: int, data: EventCorrectionCreate, idempotency_key: str | None = None) -> MoneyEvent:
    """Cancels an incorrect event by creating an exact opposite event. The original record remains visible, preserving a complete audit trail."""
    original = get_event(db, user_id, event_id)

    if original.event_type == "opening_balance":
        raise LedgerConflictError("The opening balance must be corrected with a balance adjustment")

    if original.event_type in {"investment_buy", "investment_sell", "investment_income", "investment_fee"}:
        raise LedgerConflictError("Investment events must be corrected through the investment service")

    note = f"Correction for event #{original.id}: {data.reason}"

    reversal_data = MoneyEventCreate(
        event_type="reversal",
        cash_delta_cents=-original.cash_delta_cents,
        essentials_delta_cents=-original.essentials_delta_cents,
        lifestyle_delta_cents=-original.lifestyle_delta_cents,
        investments_delta_cents=-original.investments_delta_cents,
        category_id=original.category_id,
        goal_id=original.goal_id,
        goal_delta_cents=-original.goal_delta_cents,
        debt_id=original.debt_id,
        debt_delta_cents=-original.debt_delta_cents,
        occurred_on=data.occurred_on,
        note=note[:500],
        idempotency_key=idempotency_key,
        reverses_event_id=original.id,
    )

    return create_event(db, user_id, reversal_data)


def get_total_money(db: Session, user_id: int, through_date: date | None = None) -> int:
    """Calculates the user's total declared money by adding every cash change. Nothing stores a second total, so this remains the single source of truth."""
    query = db.query(func.coalesce(func.sum(MoneyEvent.cash_delta_cents), 0)).filter(MoneyEvent.user_id == user_id)

    if through_date is not None:
        query = query.filter(MoneyEvent.occurred_on <= through_date)

    return int(query.scalar() or 0)


def get_track_balances(db: Session, user_id: int, through_date: date | None = None) -> dict[str, int]:
    """Calculates the current balance of all three tracks from event history. This replaces stored or duplicated track-balance columns."""
    query = db.query(
        func.coalesce(func.sum(MoneyEvent.essentials_delta_cents), 0),
        func.coalesce(func.sum(MoneyEvent.lifestyle_delta_cents), 0),
        func.coalesce(func.sum(MoneyEvent.investments_delta_cents), 0),
    ).filter(MoneyEvent.user_id == user_id)

    if through_date is not None:
        query = query.filter(MoneyEvent.occurred_on <= through_date)

    essentials, lifestyle, investments = query.one()

    return {
        "essentials": int(essentials),
        "lifestyle": int(lifestyle),
        "investments": int(investments),
    }


def get_goal_balance(db: Session, user_id: int, goal_id: int, through_date: date | None = None) -> int:
    """Calculates one goal's saved amount from its event changes. The goal table stores its identity and target, not a duplicated balance."""
    _get_goal(db, user_id, goal_id)

    query = db.query(func.coalesce(func.sum(MoneyEvent.goal_delta_cents), 0)).filter(
        MoneyEvent.user_id == user_id,
        MoneyEvent.goal_id == goal_id,
    )

    if through_date is not None:
        query = query.filter(MoneyEvent.occurred_on <= through_date)

    return int(query.scalar() or 0)


def get_debt_balance(db: Session, user_id: int, debt_id: int, through_date: date | None = None) -> int:
    """Calculates a debt's remaining balance from its starting balance and payment changes. This removes the need to update a second stored balance after every payment."""
    debt = _get_debt(db, user_id, debt_id)

    query = db.query(func.coalesce(func.sum(MoneyEvent.debt_delta_cents), 0)).filter(
        MoneyEvent.user_id == user_id,
        MoneyEvent.debt_id == debt_id,
    )

    if through_date is not None:
        query = query.filter(MoneyEvent.occurred_on <= through_date)

    return debt.starting_balance_cents + int(query.scalar() or 0)


def list_events(db: Session, user_id: int, start_date: date | None = None, end_date: date | None = None, limit: int = 100) -> list[MoneyEvent]:
    """Lists a user's event history for dashboards and activity pages. Optional dates support monthly reports without creating monthly snapshot tables."""
    if start_date is not None and end_date is not None and start_date > end_date:
        raise LedgerConflictError("Start date cannot be after end date")

    safe_limit = min(max(limit, 1), 500)
    query = db.query(MoneyEvent).filter(MoneyEvent.user_id == user_id)

    if start_date is not None:
        query = query.filter(MoneyEvent.occurred_on >= start_date)

    if end_date is not None:
        query = query.filter(MoneyEvent.occurred_on <= end_date)

    return query.order_by(MoneyEvent.occurred_on.desc(), MoneyEvent.id.desc()).limit(safe_limit).all()