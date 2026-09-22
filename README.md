# Nisba

Nisba is a personal finance and budgeting application designed around the realities of managing money in Morocco. It helps a user turn monthly income into a clear plan, track what actually happens, build an emergency fund, repay debt, and record investments—all in Moroccan dirhams.

The project was inspired by ideas from personal-finance and investing books. Its goal is not to copy one book or impose one universal strategy. Instead, Nisba turns established ideas and commonly used techniques into practical, understandable tools that can gradually be expanded with more guidance from respected financial literature.

> Nisba is an educational and organizational tool. It does not provide personalized financial, legal, tax, or investment advice.

## What Nisba helps you do

- Define the monthly income you normally expect.
- Divide income between Freedom Funds, Essentials, and Lifestyle.
- Calculate an emergency-fund target from essential monthly costs.
- Record the emergency fund you already have.
- Optionally disclose other available savings—or keep them private.
- Add extra income using any description, such as freelancing, bonuses, e-commerce, or trading.
- Record and categorize expenses.
- Track debts, balances, planned installments, and actual payments.
- Separate regular debt payments from exceptional advance payments.
- Record investments and review totals by investment type.
- Understand the current month through a visual dashboard and six-month trend.

## The financial model

Nisba organizes expected income into three user-controlled buckets:

- **Freedom Funds:** money directed first toward the emergency fund and later toward investing.
- **Essentials:** necessary costs such as housing, groceries, utilities, transport, health, and regular debt payments.
- **Lifestyle:** optional or flexible spending such as dining, entertainment, shopping, and subscriptions.

The three percentages must total 100%, but the user decides the percentages.

### Emergency-fund phases

The emergency-fund target is calculated as:

```text
monthly income × Essentials percentage × selected number of months
```

The user chooses between three and six months. While the current emergency fund is below the target, Nisba recommends directing Freedom Funds toward it. When the target is met, Nisba recommends considering investments. These are recommendations, not restrictions.

### Debt payments

Debt payments are separated into two types:

- **Regular payment:** the normal installment, counted as monthly Essentials spending.
- **Extra payment:** an advance or exceptional payoff that reduces the debt but is shown separately from normal monthly expenses.

For an extra payment, the user may optionally say whether it came from current income or existing savings. The funding source can also remain undisclosed. Nisba does not automatically reduce reported savings because the payment and savings snapshot may refer to different dates.

## How to use the application

1. Sign in using the account created by the backend setup script.
2. Complete onboarding:
   - enter expected monthly income;
   - choose the three budget percentages;
   - select an emergency-fund target of three to six months;
   - enter the current emergency-fund balance;
   - optionally enter other savings outside the emergency fund.
3. Open **Manage money** to reach the main financial actions.
4. Add extra income whenever it is received.
5. Record expenses with the appropriate Essentials or Lifestyle category.
6. Add each debt once, then record payments against it.
7. Record investments in the investment ledger.
8. Review the dashboard for monthly spending, budget progress, emergency-fund status, trends, and exceptional debt payoffs.

## Current scope

The current application is a verified single-user version. A public registration flow is intentionally not active yet. Multi-user ownership and isolation must be implemented before the application is opened to multiple people.

Planned major features include:

- private deployment;
- AI-assisted expense categorization;
- receipt OCR with user confirmation;
- multi-user accounts;
- educational books, courses, videos, and Morocco-relevant financial resources;
- financial and market information, including Casablanca Stock Exchange data where reliable sources are available.

See [ROADMAP.md](ROADMAP.md) for the detailed status and sequence.

## Technology stack

### Backend

- Python and FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic migrations
- JWT authentication
- Pydantic validation

### Frontend

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- TanStack Query
- Recharts

All monetary values are stored as integer cents to avoid floating-point errors and displayed in MAD.

## Project structure

```text
.
├── backend/
│   ├── alembic/            # Database migrations
│   ├── app/
│   │   ├── api/routes/     # FastAPI endpoints
│   │   ├── core/           # Security and shared business logic
│   │   ├── db/             # Database session and base model
│   │   ├── models/         # SQLAlchemy models
│   │   └── schemas/        # Pydantic request/response models
│   ├── scripts/            # User creation and seed scripts
│   └── tests/              # Backend unit tests
├── frontend/
│   ├── app/                # Next.js pages and layouts
│   ├── components/         # Shared UI components
│   └── lib/                # API client and authentication helpers
├── docs/                   # Detailed technical explanations
├── docker-compose.yml
└── ROADMAP.md
```

## Local setup

### Requirements

- Python 3.11 or newer
- `uv`
- Node.js 20 or newer
- npm
- PostgreSQL 16, or Docker for the provided database service

### 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d db
```

Alternatively, use an existing PostgreSQL instance and update `DATABASE_URL` accordingly.

### 2. Configure and start the backend

```bash
cd backend
cp .env.example .env
uv venv
uv pip install -r requirements.txt
uv run alembic upgrade head
```

Before using the application for the first time, create the single user and seed the default data:

```bash
uv run python -m scripts.create_user
uv run python -m scripts.seed_categories
uv run python -m scripts.seed_investment_types
```

Start the API:

```bash
uv run uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`. Its interactive API documentation is available at `http://localhost:8000/docs`.

### 3. Configure and start the frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Then run:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

Run backend verification from `backend/`:

```bash
uv run alembic current
uv run python -c "from app.main import app; print('Backend imports successfully')"
uv run -m tests.test_budget_engine
uv run -m tests.test_income
```

Run frontend verification from `frontend/`:

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build -- --webpack
```

## Database migrations

Never edit a migration that has already been applied to a shared or important database. Create a new migration for every schema change:

```bash
cd backend
uv run alembic revision -m "describe the change"
uv run alembic upgrade head
```

The current verified database head is:

```text
66b7c59bd3af
```

## Documentation

- [Product roadmap](ROADMAP.md)
- [Authentication implementation](docs/PHASE_1_AUTH.md)
- [Authentication flow](docs/AUTH_FLOW.md)
- [Core data-model notes](docs/PHASE_2_DATA_MODELS.md)
- [Core flow notes](docs/PHASE_2_FLOW.md)

Some older phase notes describe the system at the time that phase was originally built. The roadmap and this README represent the current product behavior.

## Privacy and security notes

- Never commit `.env` or `.env.local` files.
- Generate a strong production `SECRET_KEY`.
- Restrict backend CORS to the deployed frontend origin.
- Treat financial data, receipt images, and future AI requests as sensitive.
- Do not deploy the current single-user model as a public multi-user service.
- Establish database backups before relying on hosted financial records.

## Product direction

Nisba is intended to grow from a personal tracker into a thoughtful financial companion: one that explains the reasoning behind its guidance, respects what the user chooses not to disclose, and brings useful financial ideas into a practical Moroccan context.
