from app.db.session import SessionLocal
from app.models.category import Category
from app.models.enums import BudgetBucket

DEFAULT_CATEGORIES = [
    ("Rent", BudgetBucket.ESSENTIALS),
    ("Groceries", BudgetBucket.ESSENTIALS),
    ("Utilities", BudgetBucket.ESSENTIALS),
    ("Transport", BudgetBucket.ESSENTIALS),
    ("Health", BudgetBucket.ESSENTIALS),
    ("Dining Out", BudgetBucket.LIFESTYLE),
    ("Entertainment", BudgetBucket.LIFESTYLE),
    ("Shopping", BudgetBucket.LIFESTYLE),
    ("Subscriptions", BudgetBucket.LIFESTYLE),
    ("Other", BudgetBucket.LIFESTYLE),
]


def main():
    db = SessionLocal()
    try:
        created = 0
        for name, bucket in DEFAULT_CATEGORIES:
            if not db.query(Category).filter(Category.name == name).first():
                db.add(Category(name=name, bucket=bucket))
                created += 1
        db.commit()
        print(f"Seeded {created} new categories.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
