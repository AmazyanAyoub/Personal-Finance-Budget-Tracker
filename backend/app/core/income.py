from datetime import date

from sqlalchemy.orm import Session

from app.models.income import IncomeConfig, IncomeEntry


BASE_INCOME_NAME = "Base monthly income"


def sync_current_month_base_income(
    db: Session,
    year: int,
    month: int,
) -> bool:
    """
    Create or update the recurring base-income entry for the current
    month only.

    Returns True when the database session was changed.
    Historical months are never generated automatically.
    """
    target_date = date(year, month, 1)
    current_month = date.today().replace(day=1)

    if target_date != current_month:
        return False

    config = db.query(IncomeConfig).first()

    if not config:
        return False

    existing_entry = (
        db.query(IncomeEntry)
        .filter(IncomeEntry.is_recurring_base.is_(True))
        .filter(IncomeEntry.date == target_date)
        .first()
    )

    if existing_entry:
        changed = False

        if existing_entry.amount_cents != config.monthly_income_cents:
            existing_entry.amount_cents = config.monthly_income_cents
            changed = True

        if existing_entry.name != BASE_INCOME_NAME:
            existing_entry.name = BASE_INCOME_NAME
            changed = True

        return changed

    db.add(
        IncomeEntry(
            name=BASE_INCOME_NAME,
            amount_cents=config.monthly_income_cents,
            date=target_date,
            is_recurring_base=True,
            note="Automatically generated monthly income",
        )
    )

    return True