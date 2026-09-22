"""classify debt payments and add optional savings

Revision ID: 66b7c59bd3af
Revises: 1351d9c116d1
Create Date: 2026-09-21 14:31:52.625048

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '66b7c59bd3af'
down_revision: Union[str, None] = '1351d9c116d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Optional savings: NULL means the user keeps it private.
    op.add_column(
        "income_config",
        sa.Column(
            "available_savings_cents",
            sa.BigInteger(),
            nullable=True,
        ),
    )

    op.create_check_constraint(
        "income_config_available_savings_non_negative",
        "income_config",
        """
        available_savings_cents IS NULL
        OR available_savings_cents >= 0
        """,
    )

    # Existing debt payments are considered regular payments.
    op.add_column(
        "debt_payments",
        sa.Column(
            "payment_type",
            sa.String(length=20),
            server_default=sa.text("'regular'"),
            nullable=False,
        ),
    )

    op.add_column(
        "debt_payments",
        sa.Column(
            "funding_source",
            sa.String(length=30),
            nullable=True,
        ),
    )

    op.create_check_constraint(
        "debt_payment_type_valid",
        "debt_payments",
        "payment_type IN ('regular', 'extra')",
    )

    op.create_check_constraint(
        "debt_payment_funding_source_valid",
        "debt_payments",
        """
        funding_source IS NULL
        OR funding_source IN ('current_income', 'existing_savings')
        """,
    )


def downgrade() -> None:
    op.drop_constraint(
        "debt_payment_funding_source_valid",
        "debt_payments",
        type_="check",
    )

    op.drop_constraint(
        "debt_payment_type_valid",
        "debt_payments",
        type_="check",
    )

    op.drop_column(
        "debt_payments",
        "funding_source",
    )

    op.drop_column(
        "debt_payments",
        "payment_type",
    )

    op.drop_constraint(
        "income_config_available_savings_non_negative",
        "income_config",
        type_="check",
    )

    op.drop_column(
        "income_config",
        "available_savings_cents",
    )
