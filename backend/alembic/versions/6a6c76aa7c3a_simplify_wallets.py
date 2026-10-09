"""simplify wallets

Revision ID: 6a6c76aa7c3a
Revises: d6fc74828db2
Create Date: 2026-09-29 13:11:01.090329
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6a6c76aa7c3a"
down_revision: Union[str, None] = "d6fc74828db2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("wallet_protection_level_valid", "wallets", type_="check")
    op.drop_constraint("wallet_purpose_valid", "wallets", type_="check")
    op.drop_constraint("wallet_priority_positive", "wallets", type_="check")
    op.drop_constraint("wallet_status_valid", "wallets", type_="check")

    op.execute("UPDATE wallets SET status = 'active' WHERE status = 'completed'")

    op.drop_column("wallets", "description")
    op.drop_column("wallets", "purpose")
    op.drop_column("wallets", "protection_level")
    op.drop_column("wallets", "priority")

    op.create_check_constraint("wallet_status_valid", "wallets", "status IN ('active', 'archived')")
    op.create_check_constraint("wallet_transaction_source_bucket_valid", "wallet_transactions", "source_bucket IS NULL OR source_bucket IN ('essentials', 'lifestyle', 'freedom_funds')")


def downgrade() -> None:
    op.drop_constraint("wallet_transaction_source_bucket_valid", "wallet_transactions", type_="check")
    op.drop_constraint("wallet_status_valid", "wallets", type_="check")

    op.add_column("wallets", sa.Column("description", sa.String(length=500), nullable=True))
    op.add_column("wallets", sa.Column("purpose", sa.String(length=20), server_default="custom", nullable=False))
    op.add_column("wallets", sa.Column("protection_level", sa.String(length=20), server_default="flexible", nullable=False))
    op.add_column("wallets", sa.Column("priority", sa.Integer(), server_default="100", nullable=False))

    op.alter_column("wallets", "purpose", server_default=None)
    op.alter_column("wallets", "protection_level", server_default=None)

    op.create_check_constraint("wallet_protection_level_valid", "wallets", "protection_level IN ('protected', 'flexible', 'buffer')")
    op.create_check_constraint("wallet_purpose_valid", "wallets", "purpose IN ('essentials', 'lifestyle', 'safety', 'debt', 'wealth', 'custom')")
    op.create_check_constraint("wallet_priority_positive", "wallets", "priority > 0")
    op.create_check_constraint("wallet_status_valid", "wallets", "status IN ('active', 'completed', 'archived')")