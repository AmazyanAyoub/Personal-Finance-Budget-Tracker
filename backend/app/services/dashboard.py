from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, aliased

from app.models.Investement import InvestmentAsset, InvestmentTransaction, InvestmentValuation
from app.models.category import Category
from app.models.debt import Debt
from app.models.goal import Goal
from app.models.money_event import MoneyEvent
from app.models.profile import FinancialProfile
from app.schemas.dashboard import DashboardDebtOut, DashboardGoalOut, DashboardInvestmentOut, DashboardOut, DashboardTrackOut, MonthlyActivityOut, MonthlyTrendPointOut, SpendingCategoryOut
from app.schemas.money_event import MoneyEventOut
from app.services.ledger import get_current_allocation_plan, get_total_money, get_track_balances, list_events


class DashboardNotReadyError(Exception):
    """Raised when the user has not completed the financial setup required by the dashboard."""


def _month_start(value: date) -> date:
    """Returns the first day of the month containing the supplied date."""
    return date(value.year, value.month, 1)


def _shift_month(value: date, months: int) -> date:
    """Moves a first-of-month date backward or forward by a number of months."""
    month_index = value.year * 12 + value.month - 1 + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def _non_reversed_events(db: Session, user_id: int, as_of_date: date):
    """Returns valid financial events while hiding corrections and the original events they cancelled."""
    reversal = aliased(MoneyEvent)
    reversed_ids = select(reversal.reverses_event_id).where(
        reversal.user_id == user_id,
        reversal.event_type == "reversal",
        reversal.reverses_event_id.is_not(None),
        reversal.occurred_on <= as_of_date,
    )
    return db.query(MoneyEvent).filter(
        MoneyEvent.user_id == user_id,
        MoneyEvent.occurred_on <= as_of_date,
        MoneyEvent.event_type != "reversal",
        ~MoneyEvent.id.in_(reversed_ids),
    )


def _get_profile(db: Session, user_id: int) -> FinancialProfile:
    """Loads the user's currency and expected income needed by the dashboard."""
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == user_id).first()
    if profile is None or profile.onboarding_completed_at is None:
        raise DashboardNotReadyError("Complete onboarding before opening the dashboard")
    return profile


def _get_total_goal_money(db: Session, user_id: int, as_of_date: date) -> int:
    """Calculates all money currently reserved inside goals."""
    value = db.query(func.coalesce(func.sum(MoneyEvent.goal_delta_cents), 0)).filter(
        MoneyEvent.user_id == user_id,
        MoneyEvent.occurred_on <= as_of_date,
    ).scalar()
    return int(value or 0)


def _build_goal_cards(db: Session, user_id: int, as_of_date: date) -> list[DashboardGoalOut]:
    """Builds goal cards by calculating each goal balance from its money events."""
    rows = (
        db.query(Goal, func.coalesce(func.sum(MoneyEvent.goal_delta_cents), 0))
        .outerjoin(
            MoneyEvent,
            and_(
                MoneyEvent.goal_id == Goal.id,
                MoneyEvent.user_id == user_id,
                MoneyEvent.occurred_on <= as_of_date,
            ),
        )
        .filter(Goal.user_id == user_id, Goal.status != "archived")
        .group_by(Goal.id)
        .order_by(Goal.created_at.desc())
        .all()
    )

    cards = []

    for goal, balance in rows:
        current = int(balance or 0)
        remaining = max(goal.target_cents - current, 0) if goal.target_cents is not None else None
        progress = round(current * 100 / goal.target_cents, 2) if goal.target_cents is not None else None
        status = "completed" if goal.status == "active" and goal.target_cents is not None and current >= goal.target_cents else goal.status

        cards.append(
            DashboardGoalOut(
                id=goal.id,
                name=goal.name,
                current_balance_cents=current,
                target_cents=goal.target_cents,
                progress_pct=progress,
                status=status,
            )
        )

    return cards


def _build_debt_cards(db: Session, user_id: int, as_of_date: date) -> list[DashboardDebtOut]:
    """Builds debt cards by subtracting recorded payments from each starting balance."""
    rows = (
        db.query(Debt, func.coalesce(func.sum(MoneyEvent.debt_delta_cents), 0))
        .outerjoin(
            MoneyEvent,
            and_(
                MoneyEvent.debt_id == Debt.id,
                MoneyEvent.user_id == user_id,
                MoneyEvent.occurred_on <= as_of_date,
            ),
        )
        .filter(Debt.user_id == user_id, Debt.status != "archived")
        .group_by(Debt.id)
        .order_by(Debt.created_at.desc())
        .all()
    )

    cards = []

    for debt, balance_change in rows:
        current = max(debt.starting_balance_cents + int(balance_change or 0), 0)
        amount_paid = debt.starting_balance_cents - current
        progress = round(max(amount_paid, 0) * 100 / debt.starting_balance_cents, 2)
        status = "paid" if debt.status == "active" and current == 0 else debt.status

        cards.append(
            DashboardDebtOut(
                id=debt.id,
                name=debt.name,
                current_balance_cents=current,
                planned_monthly_payment_cents=debt.planned_monthly_payment_cents,
                progress_pct=min(progress, 100),
                status=status,
            )
        )

    return cards


def _calculate_investment_value(db: Session, asset_id: int, units: Decimal, as_of_date: date) -> int | None:
    """Calculates an asset's current value using its latest available valuation."""
    valuation = (
        db.query(InvestmentValuation)
        .filter(
            InvestmentValuation.investment_asset_id == asset_id,
            InvestmentValuation.as_of_date <= as_of_date,
        )
        .order_by(InvestmentValuation.as_of_date.desc(), InvestmentValuation.id.desc())
        .first()
    )

    if valuation is None:
        return None
    if valuation.total_value_cents is not None:
        return int(valuation.total_value_cents)

    value = units * Decimal(valuation.price_per_unit_cents or 0)
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _build_investment_cards(db: Session, user_id: int, as_of_date: date) -> list[DashboardInvestmentOut]:
    """Builds investment cards from owned units and the latest recorded valuation."""
    rows = (
        db.query(InvestmentAsset, func.coalesce(func.sum(InvestmentTransaction.units_delta), 0))
        .outerjoin(
            InvestmentTransaction,
            and_(
                InvestmentTransaction.investment_asset_id == InvestmentAsset.id,
                InvestmentTransaction.occurred_on <= as_of_date,
            ),
        )
        .filter(InvestmentAsset.user_id == user_id, InvestmentAsset.status != "archived")
        .group_by(InvestmentAsset.id)
        .order_by(InvestmentAsset.created_at.desc())
        .all()
    )

    cards = []

    for asset, units_value in rows:
        units = Decimal(units_value or 0)
        current_value = 0 if asset.status == "sold" else _calculate_investment_value(db, asset.id, units, as_of_date)

        cards.append(
            DashboardInvestmentOut(
                id=asset.id,
                name=asset.name,
                asset_type=asset.asset_type,
                current_units=units,
                current_value_cents=current_value,
                status=asset.status,
            )
        )

    return cards


def _build_monthly_activity(db: Session, user_id: int, as_of_date: date) -> MonthlyActivityOut:
    """Summarizes the current month's income, spending, debt payments and investment activity."""
    start_date = _month_start(as_of_date)
    events = (
        _non_reversed_events(db, user_id, as_of_date)
        .filter(MoneyEvent.occurred_on >= start_date)
        .with_entities(MoneyEvent.event_type, MoneyEvent.cash_delta_cents)
        .all()
    )

    income = sum(event.cash_delta_cents for event in events if event.event_type == "income")
    expenses = sum(-event.cash_delta_cents for event in events if event.event_type == "expense")
    debt_payments = sum(-event.cash_delta_cents for event in events if event.event_type == "debt_payment")
    investment_purchases = sum(-event.cash_delta_cents for event in events if event.event_type == "investment_buy")
    investment_income = sum(event.cash_delta_cents for event in events if event.event_type == "investment_income")
    net_change = sum(event.cash_delta_cents for event in events)

    return MonthlyActivityOut(
        year=as_of_date.year,
        month=as_of_date.month,
        income_cents=max(income, 0),
        expenses_cents=max(expenses, 0),
        debt_payments_cents=max(debt_payments, 0),
        investment_purchases_cents=max(investment_purchases, 0),
        investment_income_cents=max(investment_income, 0),
        net_money_change_cents=net_change,
    )


def _build_spending_categories(db: Session, user_id: int, as_of_date: date) -> list[SpendingCategoryOut]:
    """Groups the current month's expenses by category for the spending chart."""
    start_date = _month_start(as_of_date)
    rows = (
        _non_reversed_events(db, user_id, as_of_date)
        .join(Category, Category.id == MoneyEvent.category_id)
        .with_entities(
            Category.id,
            Category.name,
            Category.track_kind,
            func.coalesce(func.sum(MoneyEvent.cash_delta_cents), 0),
        )
        .filter(MoneyEvent.event_type == "expense", MoneyEvent.occurred_on >= start_date)
        .group_by(Category.id, Category.name, Category.track_kind)
        .order_by(func.sum(MoneyEvent.cash_delta_cents))
        .all()
    )

    return [
        SpendingCategoryOut(
            category_id=category_id,
            category_name=name,
            track_kind=track_kind,
            amount_cents=max(-int(cash_change), 0),
        )
        for category_id, name, track_kind, cash_change in rows
        if int(cash_change) < 0
    ]


def _build_monthly_trend(db: Session, user_id: int, as_of_date: date, months: int = 6) -> list[MonthlyTrendPointOut]:
    """Builds a monthly money-in, money-out and closing-balance trend without storing monthly snapshots."""
    current_month = _month_start(as_of_date)
    month_starts = [_shift_month(current_month, offset) for offset in range(-(months - 1), 1)]
    trend_start = month_starts[0]

    opening_money = (
        _non_reversed_events(db, user_id, as_of_date)
        .filter(MoneyEvent.occurred_on < trend_start)
        .with_entities(func.coalesce(func.sum(MoneyEvent.cash_delta_cents), 0))
        .scalar()
    )

    events = (
        _non_reversed_events(db, user_id, as_of_date)
        .filter(MoneyEvent.occurred_on >= trend_start)
        .with_entities(MoneyEvent.occurred_on, MoneyEvent.cash_delta_cents)
        .all()
    )

    buckets = {(month.year, month.month): {"money_in": 0, "money_out": 0} for month in month_starts}

    for occurred_on, cash_change in events:
        bucket = buckets[(occurred_on.year, occurred_on.month)]

        if cash_change >= 0:
            bucket["money_in"] += cash_change
        else:
            bucket["money_out"] += -cash_change

    closing_money = int(opening_money or 0)
    trend = []

    for month in month_starts:
        bucket = buckets[(month.year, month.month)]
        closing_money += bucket["money_in"] - bucket["money_out"]

        trend.append(
            MonthlyTrendPointOut(
                year=month.year,
                month=month.month,
                money_in_cents=bucket["money_in"],
                money_out_cents=bucket["money_out"],
                closing_money_cents=closing_money,
            )
        )

    return trend


def get_dashboard(db: Session, user_id: int, as_of_date: date) -> DashboardOut:
    """Builds the complete dashboard from the ledger, goals, debts and investments without storing duplicated totals."""
    profile = _get_profile(db, user_id)
    allocation = get_current_allocation_plan(db, user_id, as_of_date)
    total_money = get_total_money(db, user_id, as_of_date)
    track_balances = get_track_balances(db, user_id, as_of_date)
    goal_money = _get_total_goal_money(db, user_id, as_of_date)
    goals = _build_goal_cards(db, user_id, as_of_date)
    debts = _build_debt_cards(db, user_id, as_of_date)
    investments = _build_investment_cards(db, user_id, as_of_date)
    total_debt = sum(debt.current_balance_cents for debt in debts)
    total_investment_value = sum(investment.current_value_cents or 0 for investment in investments)

    tracks = [
        DashboardTrackOut(track_kind="essentials", percentage=allocation.essentials_pct, balance_cents=track_balances["essentials"]),
        DashboardTrackOut(track_kind="lifestyle", percentage=allocation.lifestyle_pct, balance_cents=track_balances["lifestyle"]),
        DashboardTrackOut(track_kind="investments", percentage=allocation.investments_pct, balance_cents=track_balances["investments"]),
    ]

    recent_events = [
        MoneyEventOut.model_validate(event)
        for event in list_events(db, user_id, end_date=as_of_date, limit=10)
    ]

    return DashboardOut(
        as_of_date=as_of_date,
        currency=profile.currency,
        expected_monthly_income_cents=profile.expected_monthly_income_cents,
        total_money_cents=total_money,
        money_in_tracks_cents=sum(track_balances.values()),
        money_in_goals_cents=goal_money,
        total_debt_cents=total_debt,
        total_investment_value_cents=total_investment_value,
        estimated_net_worth_cents=total_money + total_investment_value - total_debt,
        tracks=tracks,
        monthly_activity=_build_monthly_activity(db, user_id, as_of_date),
        goals=goals,
        debts=debts,
        investments=investments,
        spending_by_category=_build_spending_categories(db, user_id, as_of_date),
        monthly_trend=_build_monthly_trend(db, user_id, as_of_date),
        recent_events=recent_events,
    )