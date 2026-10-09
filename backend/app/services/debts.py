from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.debt import Debt
from app.schemas.debt import DebtCreate, DebtOut, DebtPaymentCreate, DebtUpdate
from app.schemas.money_event import MoneyEventCreate
from app.services.ledger import create_event, get_debt_balance, get_track_balances


class DebtError(Exception):
    """Base error for invalid debt operations."""


class DebtNotFoundError(DebtError):
    """Raised when a debt does not exist or belongs to another user."""


class DebtConflictError(DebtError):
    """Raised when a debt action conflicts with its balance or status."""


def _get_debt(db: Session, user_id: int, debt_id: int) -> Debt:
    """Loads one debt owned by the current user and blocks access to another user's debt."""
    debt = db.query(Debt).filter(Debt.id == debt_id, Debt.user_id == user_id).first()

    if debt is None:
        raise DebtNotFoundError("Debt was not found")

    return debt


def _sync_debt_status(debt: Debt, current_balance_cents: int) -> None:
    """Automatically marks a non-archived debt as paid when its remaining balance reaches zero."""
    if debt.status == "archived":
        return

    debt.status = "paid" if current_balance_cents == 0 else "active"


def _debt_output(debt: Debt, current_balance_cents: int) -> DebtOut:
    """Builds the debt response with its calculated payment amount and progress."""
    amount_paid = max(debt.starting_balance_cents - current_balance_cents, 0)
    progress = round(amount_paid * 100 / debt.starting_balance_cents, 2)

    return DebtOut(
        id=debt.id,
        user_id=debt.user_id,
        name=debt.name,
        starting_balance_cents=debt.starting_balance_cents,
        current_balance_cents=current_balance_cents,
        amount_paid_cents=amount_paid,
        progress_pct=min(progress, 100),
        planned_monthly_payment_cents=debt.planned_monthly_payment_cents,
        target_date=debt.target_date,
        status=debt.status,
        created_at=debt.created_at,
    )


def create_debt(db: Session, user_id: int, data: DebtCreate) -> DebtOut:
    """Creates a debt record while leaving its changing balance to the central money-event ledger."""
    duplicate = db.query(Debt.id).filter(Debt.user_id == user_id, func.lower(Debt.name) == data.name.lower()).first()

    if duplicate is not None:
        raise DebtConflictError("A debt with this name already exists")

    debt = Debt(
        user_id=user_id,
        name=data.name,
        starting_balance_cents=data.starting_balance_cents,
        planned_monthly_payment_cents=data.planned_monthly_payment_cents,
        target_date=data.target_date,
        status="active",
    )

    db.add(debt)
    db.flush()

    return _debt_output(debt, debt.starting_balance_cents)


def get_debt(db: Session, user_id: int, debt_id: int) -> DebtOut:
    """Returns one debt with its remaining balance calculated from payment events."""
    debt = _get_debt(db, user_id, debt_id)
    balance = max(get_debt_balance(db, user_id, debt.id), 0)
    _sync_debt_status(debt, balance)
    db.flush()

    return _debt_output(debt, balance)


def list_debts(db: Session, user_id: int, include_archived: bool = False) -> list[DebtOut]:
    """Lists the user's debts and calculates every remaining balance from the ledger."""
    query = db.query(Debt).filter(Debt.user_id == user_id)

    if not include_archived:
        query = query.filter(Debt.status != "archived")

    debts = query.order_by(Debt.created_at.desc()).all()
    results = []

    for debt in debts:
        balance = max(get_debt_balance(db, user_id, debt.id), 0)
        _sync_debt_status(debt, balance)
        results.append(_debt_output(debt, balance))

    db.flush()
    return results


def update_debt(db: Session, user_id: int, debt_id: int, data: DebtUpdate) -> DebtOut:
    """Updates debt details while preventing unpaid debt from being hidden through archiving."""
    debt = _get_debt(db, user_id, debt_id)
    balance = max(get_debt_balance(db, user_id, debt.id), 0)
    changes = data.model_dump(exclude_unset=True)

    if "name" in changes:
        duplicate = (
            db.query(Debt.id)
            .filter(
                Debt.user_id == user_id,
                Debt.id != debt.id,
                func.lower(Debt.name) == changes["name"].lower(),
            )
            .first()
        )

        if duplicate is not None:
            raise DebtConflictError("A debt with this name already exists")

    if changes.get("status") == "archived" and balance != 0:
        raise DebtConflictError("An unpaid debt cannot be archived")

    for field, value in changes.items():
        setattr(debt, field, value)

    _sync_debt_status(debt, balance)
    db.flush()

    return _debt_output(debt, balance)


def pay_debt(
    db: Session,
    user_id: int,
    debt_id: int,
    data: DebtPaymentCreate,
    idempotency_key: str | None = None,
) -> DebtOut:
    """Pays a debt from Essentials, reducing total money, the Essentials track and the debt balance together."""
    debt = _get_debt(db, user_id, debt_id)
    current_balance = max(get_debt_balance(db, user_id, debt.id), 0)

    if debt.status == "archived":
        raise DebtConflictError("An archived debt cannot receive payments")
    if current_balance == 0:
        raise DebtConflictError("This debt has already been paid")
    if data.amount_cents > current_balance:
        raise DebtConflictError("Payment cannot exceed the remaining debt balance")

    track_balances = get_track_balances(db, user_id)

    if track_balances["essentials"] < data.amount_cents:
        raise DebtConflictError("Not enough money is available in Essentials")

    event = MoneyEventCreate(
        event_type="debt_payment",
        cash_delta_cents=-data.amount_cents,
        essentials_delta_cents=-data.amount_cents,
        debt_id=debt.id,
        debt_delta_cents=-data.amount_cents,
        occurred_on=data.occurred_on,
        note=data.note or f"Payment for {debt.name}",
        idempotency_key=idempotency_key,
    )

    create_event(db, user_id, event)
    new_balance = max(get_debt_balance(db, user_id, debt.id), 0)
    _sync_debt_status(debt, new_balance)
    db.flush()

    return _debt_output(debt, new_balance)