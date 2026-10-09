from app.db.session import SessionLocal
from app.models.category import Category

DEFAULT_CATEGORIES = [
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


def main():
    db = SessionLocal()
    try:
        created = 0
        for name, track_kind in DEFAULT_CATEGORIES:
            if not db.query(Category).filter(Category.user_id.is_(None), Category.name == name).first():
                db.add(Category(name=name, track_kind=track_kind, is_system=True, active=True))
                created += 1
        db.commit()
        print(f"Seeded {created} new categories.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
