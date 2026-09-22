"""simplify income and onboarding

Revision ID: 1351d9c116d1
Revises: dc3a4b774095
Create Date: 2026-09-21 11:59:13.220328

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '1351d9c116d1'
down_revision: Union[str, None] = 'dc3a4b774095'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename the old configuration instead of deleting it.
    op.rename_table(
        "income_mode_config",
        "income_config",
    )

    op.alter_column(
        "income_config",
        "fixed_salary_cents",
        new_column_name="monthly_income_cents",
    )

    # For old freelance configurations, recover the onboarding estimate.
    op.execute(
        """
        UPDATE income_config
        SET monthly_income_cents = (
            SELECT estimated_monthly_income_cents
            FROM emergency_fund_config
            ORDER BY id
            LIMIT 1
        )
        WHERE monthly_income_cents IS NULL
        """
    )

    # Invalid incomplete configurations should repeat onboarding.
    op.execute(
        """
        DELETE FROM income_config
        WHERE monthly_income_cents IS NULL
           OR monthly_income_cents <= 0
        """
    )

    op.alter_column(
        "income_config",
        "monthly_income_cents",
        existing_type=sa.BigInteger(),
        nullable=False,
    )

    op.drop_column(
        "income_config",
        "mode",
    )

    op.create_check_constraint(
        "income_config_monthly_income_positive",
        "income_config",
        "monthly_income_cents > 0",
    )

    # Convert income entries to base/additional income.
    op.add_column(
        "income_entries",
        sa.Column(
            "name",
            sa.String(length=100),
            nullable=True,
        ),
    )

    op.add_column(
        "income_entries",
        sa.Column(
            "is_recurring_base",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )

    op.execute(
        """
        UPDATE income_entries
        SET
            is_recurring_base = CASE
                WHEN source::text = 'FIXED' THEN true
                ELSE false
            END,
            name = CASE
                WHEN source::text = 'FIXED'
                    THEN 'Base monthly income'
                ELSE LEFT(
                    COALESCE(
                        NULLIF(BTRIM(note), ''),
                        'Additional income'
                    ),
                    100
                )
            END
        """
    )

    op.alter_column(
        "income_entries",
        "name",
        existing_type=sa.String(length=100),
        nullable=False,
    )

    op.drop_column(
        "income_entries",
        "source",
    )

    op.create_check_constraint(
        "income_entry_amount_positive",
        "income_entries",
        "amount_cents > 0",
    )

    # Only one automatically generated base entry per month.
    op.create_index(
        "uq_income_entries_recurring_base_date",
        "income_entries",
        ["date"],
        unique=True,
        postgresql_where=sa.text(
            "is_recurring_base = true"
        ),
    )

    # The income configuration is now the single source for this value.
    op.drop_column(
        "emergency_fund_config",
        "estimated_monthly_income_cents",
    )

    # Remove the obsolete PostgreSQL enums after their columns are gone.
    op.execute("DROP TYPE IF EXISTS income_source")
    op.execute("DROP TYPE IF EXISTS income_mode")


def downgrade() -> None:
    op.add_column(
        "emergency_fund_config",
        sa.Column(
            "estimated_monthly_income_cents",
            sa.BigInteger(),
            server_default="0",
            nullable=False,
        ),
    )

    op.drop_index(
        "uq_income_entries_recurring_base_date",
        table_name="income_entries",
    )

    op.drop_constraint(
        "income_entry_amount_positive",
        "income_entries",
        type_="check",
    )

    income_source = postgresql.ENUM(
        "FIXED",
        "FREELANCE",
        name="income_source",
    )
    income_source.create(
        op.get_bind(),
        checkfirst=True,
    )

    op.add_column(
        "income_entries",
        sa.Column(
            "source",
            income_source,
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE income_entries
        SET source = CASE
            WHEN is_recurring_base
                THEN 'FIXED'::income_source
            ELSE 'FREELANCE'::income_source
        END
        """
    )

    op.alter_column(
        "income_entries",
        "source",
        existing_type=income_source,
        nullable=False,
    )

    op.drop_column(
        "income_entries",
        "is_recurring_base",
    )

    op.drop_column(
        "income_entries",
        "name",
    )

    op.drop_constraint(
        "income_config_monthly_income_positive",
        "income_config",
        type_="check",
    )

    income_mode = postgresql.ENUM(
        "FIXED_ONLY",
        "FIXED_PLUS_FREELANCE",
        "FREELANCE_ONLY",
        name="income_mode",
    )
    income_mode.create(
        op.get_bind(),
        checkfirst=True,
    )

    op.add_column(
        "income_config",
        sa.Column(
            "mode",
            income_mode,
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE income_config
        SET mode = 'FIXED_ONLY'::income_mode
        """
    )

    op.alter_column(
        "income_config",
        "mode",
        existing_type=income_mode,
        nullable=False,
    )

    op.alter_column(
        "income_config",
        "monthly_income_cents",
        new_column_name="fixed_salary_cents",
    )

    op.rename_table(
        "income_config",
        "income_mode_config",
    )