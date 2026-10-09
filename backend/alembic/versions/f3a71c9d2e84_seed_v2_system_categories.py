"""Seed V2 system categories.

Revision ID: f3a71c9d2e84
Revises: 414ec26352fe
Create Date: 2026-10-09
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "f3a71c9d2e84"
down_revision: str | None = "414ec26352fe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = [
    ("Rent", "essentials"),
    ("Groceries", "essentials"),
    ("Utilities", "essentials"),
    ("Transport", "essentials"),
    ("Health", "essentials"),
    ("Dining Out", "lifestyle"),
    ("Entertainment", "lifestyle"),
    ("Shopping", "lifestyle"),
    ("Subscriptions", "lifestyle"),
    ("Other", "lifestyle"),
]


def upgrade() -> None:
    categories = sa.table("categories", sa.column("name", sa.String()), sa.column("track_kind", sa.String()), sa.column("is_system", sa.Boolean()), sa.column("active", sa.Boolean()))
    op.bulk_insert(categories, [{"name": name, "track_kind": track, "is_system": True, "active": True} for name, track in CATEGORIES])


def downgrade() -> None:
    names = ", ".join(f"'{name.replace(chr(39), chr(39) * 2)}'" for name, _ in CATEGORIES)
    op.execute(sa.text(f"DELETE FROM categories WHERE user_id IS NULL AND is_system = true AND name IN ({names})"))
