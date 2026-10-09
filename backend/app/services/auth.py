from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import RegisterRequest


class AuthError(Exception):
    """Base error for authentication operations."""


class EmailAlreadyRegisteredError(AuthError):
    """Raised when registration uses an existing email."""


class InvalidCredentialsError(AuthError):
    """Raised when login credentials are incorrect."""


def register_user(db: Session, data: RegisterRequest) -> User:
    """Creates a user with a normalized email and securely hashed password."""
    existing = db.query(User.id).filter(func.lower(User.email) == data.email).first()

    if existing is not None:
        raise EmailAlreadyRegisteredError("An account with this email already exists")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
    )

    db.add(user)

    try:
        db.flush()
    except IntegrityError as exc:
        raise EmailAlreadyRegisteredError("An account with this email already exists") from exc

    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Validates an email and password while returning the same error for both invalid cases."""
    user = db.query(User).filter(func.lower(User.email) == email).first()

    if user is None or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError("Invalid email or password")

    return user