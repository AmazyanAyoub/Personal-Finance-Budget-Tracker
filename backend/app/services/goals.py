from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalMoneyActionCreate, GoalOut, GoalUpdate
from app.schemas.money_event import MoneyEventCreate
from app.services.ledger import create_event, get_goal_balance, get_track_balances


class GoalError(Exception):
    """Base error for invalid goal operations."""


class GoalNotFoundError(GoalError):
    """Raised when the requested goal does not exist or belongs to another user."""


class GoalConflictError(GoalError):
    """Raised when a goal action conflicts with its current balance or protected role."""


def _get_goal(db: Session, user_id: int, goal_id: int) -> Goal:
    """Loads one goal belonging to the current user and prevents access to another user's goal."""
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()

    if goal is None:
        raise GoalNotFoundError("Goal was not found")

    return goal


def _track_change(track_kind: str, amount_cents: int) -> dict[str, int]:
    """Creates the three track changes while changing only the track linked to the goal."""
    changes = {"essentials_delta_cents": 0, "lifestyle_delta_cents": 0, "investments_delta_cents": 0}
    changes[f"{track_kind}_delta_cents"] = amount_cents
    return changes


def _sync_goal_status(goal: Goal, current_balance_cents: int) -> None:
    """Automatically keeps a non-archived goal active or completed according to its current balance and target."""
    if goal.status == "archived":
        return

    goal.status = "completed" if goal.target_cents is not None and current_balance_cents >= goal.target_cents else "active"


def _goal_output(goal: Goal, current_balance_cents: int) -> GoalOut:
    """Builds the goal response with its calculated balance, remaining amount and progress."""
    remaining = max(goal.target_cents - current_balance_cents, 0) if goal.target_cents is not None else None
    progress = round(current_balance_cents * 100 / goal.target_cents, 2) if goal.target_cents is not None else None

    return GoalOut(
        id=goal.id,
        user_id=goal.user_id,
        name=goal.name,
        type_name=goal.type_name,
        linked_track_kind=goal.linked_track_kind,
        system_role=goal.system_role,
        target_cents=goal.target_cents,
        target_date=goal.target_date,
        status=goal.status,
        current_balance_cents=current_balance_cents,
        remaining_cents=remaining,
        progress_pct=progress,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


def create_goal(db: Session, user_id: int, data: GoalCreate) -> GoalOut:
    """Creates a personal saving goal without storing a duplicated balance."""
    duplicate = db.query(Goal.id).filter(Goal.user_id == user_id, func.lower(Goal.name) == data.name.lower()).first()

    if duplicate is not None:
        raise GoalConflictError("A goal with this name already exists")

    goal = Goal(
        user_id=user_id,
        name=data.name,
        type_name=data.type_name,
        linked_track_kind=data.linked_track_kind,
        target_cents=data.target_cents,
        target_date=data.target_date,
        status="active",
    )

    db.add(goal)
    db.flush()

    return _goal_output(goal, 0)


def get_goal(db: Session, user_id: int, goal_id: int) -> GoalOut:
    """Returns one goal with its balance calculated from money events."""
    goal = _get_goal(db, user_id, goal_id)
    balance = get_goal_balance(db, user_id, goal.id)
    _sync_goal_status(goal, balance)
    db.flush()

    return _goal_output(goal, balance)


def list_goals(db: Session, user_id: int, include_archived: bool = False) -> list[GoalOut]:
    """Lists the user's goals and calculates each balance from the ledger."""
    query = db.query(Goal).filter(Goal.user_id == user_id)

    if not include_archived:
        query = query.filter(Goal.status != "archived")

    goals = query.order_by(Goal.created_at.desc()).all()
    results = []

    for goal in goals:
        balance = get_goal_balance(db, user_id, goal.id)
        _sync_goal_status(goal, balance)
        results.append(_goal_output(goal, balance))

    db.flush()
    return results


def update_goal(db: Session, user_id: int, goal_id: int, data: GoalUpdate) -> GoalOut:
    """Updates goal details while protecting emergency-fund identity and existing reserved money."""
    goal = _get_goal(db, user_id, goal_id)
    balance = get_goal_balance(db, user_id, goal.id)
    changes = data.model_dump(exclude_unset=True)

    if "name" in changes:
        duplicate = (
            db.query(Goal.id)
            .filter(
                Goal.user_id == user_id,
                Goal.id != goal.id,
                func.lower(Goal.name) == changes["name"].lower(),
            )
            .first()
        )

        if duplicate is not None:
            raise GoalConflictError("A goal with this name already exists")

    if goal.system_role == "emergency_fund":
        if changes.get("linked_track_kind", "essentials") != "essentials":
            raise GoalConflictError("The emergency fund must remain linked to Essentials")
        if changes.get("status") == "archived":
            raise GoalConflictError("The emergency fund cannot be archived")

    if "linked_track_kind" in changes and changes["linked_track_kind"] != goal.linked_track_kind and balance != 0:
        raise GoalConflictError("Release or spend the saved money before changing the linked track")

    if changes.get("status") == "archived" and balance != 0:
        raise GoalConflictError("A goal containing money cannot be archived")

    for field, value in changes.items():
        setattr(goal, field, value)

    _sync_goal_status(goal, balance)
    db.flush()

    return _goal_output(goal, balance)


def reserve_for_goal(
    db: Session,
    user_id: int,
    goal_id: int,
    data: GoalMoneyActionCreate,
    idempotency_key: str | None = None,
) -> GoalOut:
    """Moves money from the goal's linked track into the goal without changing the user's total money."""
    goal = _get_goal(db, user_id, goal_id)

    if goal.status == "archived":
        raise GoalConflictError("Money cannot be added to an archived goal")

    track_balances = get_track_balances(db, user_id)

    if track_balances[goal.linked_track_kind] < data.amount_cents:
        raise GoalConflictError(f"Not enough money is available in the {goal.linked_track_kind} track")

    track_changes = _track_change(goal.linked_track_kind, -data.amount_cents)

    event = MoneyEventCreate(
        event_type="goal_reserve",
        cash_delta_cents=0,
        goal_id=goal.id,
        goal_delta_cents=data.amount_cents,
        occurred_on=data.occurred_on,
        note=data.note or f"Money reserved for {goal.name}",
        idempotency_key=idempotency_key,
        **track_changes,
    )

    create_event(db, user_id, event)
    balance = get_goal_balance(db, user_id, goal.id)
    _sync_goal_status(goal, balance)
    db.flush()

    return _goal_output(goal, balance)


def release_from_goal(
    db: Session,
    user_id: int,
    goal_id: int,
    data: GoalMoneyActionCreate,
    idempotency_key: str | None = None,
) -> GoalOut:
    """Moves reserved money from the goal back into its linked track without changing total money."""
    goal = _get_goal(db, user_id, goal_id)
    balance = get_goal_balance(db, user_id, goal.id)

    if goal.status == "archived":
        raise GoalConflictError("Money cannot be released from an archived goal")
    if balance < data.amount_cents:
        raise GoalConflictError("The goal does not contain enough money")

    track_changes = _track_change(goal.linked_track_kind, data.amount_cents)

    event = MoneyEventCreate(
        event_type="goal_release",
        cash_delta_cents=0,
        goal_id=goal.id,
        goal_delta_cents=-data.amount_cents,
        occurred_on=data.occurred_on,
        note=data.note or f"Money released from {goal.name}",
        idempotency_key=idempotency_key,
        **track_changes,
    )

    create_event(db, user_id, event)
    new_balance = get_goal_balance(db, user_id, goal.id)
    _sync_goal_status(goal, new_balance)
    db.flush()

    return _goal_output(goal, new_balance)


def spend_from_goal(
    db: Session,
    user_id: int,
    goal_id: int,
    data: GoalMoneyActionCreate,
    idempotency_key: str | None = None,
) -> GoalOut:
    """Records actual spending from a goal, decreasing both total money and the goal balance."""
    goal = _get_goal(db, user_id, goal_id)
    balance = get_goal_balance(db, user_id, goal.id)

    if goal.status == "archived":
        raise GoalConflictError("Money cannot be spent from an archived goal")
    if balance < data.amount_cents:
        raise GoalConflictError("The goal does not contain enough money")

    event = MoneyEventCreate(
        event_type="goal_spend",
        cash_delta_cents=-data.amount_cents,
        goal_id=goal.id,
        goal_delta_cents=-data.amount_cents,
        occurred_on=data.occurred_on,
        note=data.note or f"Money spent from {goal.name}",
        idempotency_key=idempotency_key,
    )

    create_event(db, user_id, event)
    new_balance = get_goal_balance(db, user_id, goal.id)
    _sync_goal_status(goal, new_balance)
    db.flush()

    return _goal_output(goal, new_balance)