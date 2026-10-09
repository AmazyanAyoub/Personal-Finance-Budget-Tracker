from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate


class CategoryError(Exception):
    """Base error for invalid category operations."""


class CategoryNotFoundError(CategoryError):
    """Raised when a category does not exist or is unavailable to the current user."""


class CategoryConflictError(CategoryError):
    """Raised when a category name conflicts with an existing visible category."""


def _available_category_filter(user_id: int):
    """Allows categories created by the current user and shared system categories."""
    return or_(
        Category.user_id == user_id,
        and_(Category.user_id.is_(None), Category.is_system.is_(True)),
    )


def _get_available_category(db: Session, user_id: int, category_id: int) -> Category:
    """Loads a user-owned or shared system category."""
    category = (
        db.query(Category)
        .filter(Category.id == category_id, _available_category_filter(user_id))
        .first()
    )

    if category is None:
        raise CategoryNotFoundError("Category was not found")

    return category


def _get_owned_category(db: Session, user_id: int, category_id: int) -> Category:
    """Loads a custom category owned by the user; system categories cannot be edited."""
    category = (
        db.query(Category)
        .filter(
            Category.id == category_id,
            Category.user_id == user_id,
            Category.is_system.is_(False),
        )
        .first()
    )

    if category is None:
        raise CategoryNotFoundError("Editable category was not found")

    return category


def _name_exists(db: Session, user_id: int, name: str, excluded_id: int | None = None) -> bool:
    """Checks visible system and personal categories to prevent confusing duplicate names."""
    query = db.query(Category.id).filter(
        func.lower(Category.name) == name.lower(),
        _available_category_filter(user_id),
    )

    if excluded_id is not None:
        query = query.filter(Category.id != excluded_id)

    return query.first() is not None


def create_category(db: Session, user_id: int, data: CategoryCreate) -> CategoryOut:
    """Creates an active personal category connected to one financial track."""
    if _name_exists(db, user_id, data.name):
        raise CategoryConflictError("A category with this name already exists")

    category = Category(
        user_id=user_id,
        name=data.name,
        track_kind=data.track_kind,
        is_system=False,
        active=True,
    )

    db.add(category)
    db.flush()

    return CategoryOut.model_validate(category)


def get_category(db: Session, user_id: int, category_id: int) -> CategoryOut:
    """Returns one system or personal category available to the user."""
    return CategoryOut.model_validate(
        _get_available_category(db, user_id, category_id)
    )


def list_categories(
    db: Session,
    user_id: int,
    include_inactive: bool = False,
) -> list[CategoryOut]:
    """Lists shared system categories and the user's personal categories."""
    query = db.query(Category).filter(_available_category_filter(user_id))

    if not include_inactive:
        query = query.filter(Category.active.is_(True))

    categories = query.order_by(
        Category.track_kind,
        Category.is_system.desc(),
        Category.name,
    ).all()

    return [CategoryOut.model_validate(category) for category in categories]


def update_category(
    db: Session,
    user_id: int,
    category_id: int,
    data: CategoryUpdate,
) -> CategoryOut:
    """Updates or deactivates a personal category while protecting system categories."""
    category = _get_owned_category(db, user_id, category_id)
    changes = data.model_dump(exclude_unset=True)

    if "name" in changes and _name_exists(db, user_id, changes["name"], category.id):
        raise CategoryConflictError("A category with this name already exists")

    for field, value in changes.items():
        setattr(category, field, value)

    db.flush()

    return CategoryOut.model_validate(category)