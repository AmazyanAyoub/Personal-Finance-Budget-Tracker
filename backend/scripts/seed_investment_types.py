from app.db.session import SessionLocal
from app.models.investment import InvestmentType

DEFAULT_TYPES = ["Casablanca Bourse"]


def main():
    db = SessionLocal()
    try:
        created = 0
        for name in DEFAULT_TYPES:
            if not db.query(InvestmentType).filter(InvestmentType.name == name).first():
                db.add(InvestmentType(name=name))
                created += 1
        db.commit()
        print(f"Seeded {created} new investment types.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
