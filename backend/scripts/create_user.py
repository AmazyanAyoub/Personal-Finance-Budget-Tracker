import getpass

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def main():
    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            print("User already exists.")
            return
        db.add(User(email=email, hashed_password=hash_password(password)))
        db.commit()
        print(f"Created user {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
