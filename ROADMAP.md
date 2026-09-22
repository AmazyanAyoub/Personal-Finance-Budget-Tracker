# Nisba — Product Roadmap

Nisba is a Morocco-focused personal finance and budgeting application. It is inspired by ideas from respected personal-finance and investing books, adapted into a practical workflow for income, spending, emergency funds, debt repayment, and investing in Moroccan dirhams.

The current version is a verified single-user application. The next milestone is a private deployment, followed by AI-assisted categorization and receipt OCR.

## Technology

- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL, JWT authentication
- Frontend: Next.js, React, TypeScript, Tailwind CSS, TanStack Query, Recharts
- Money: stored as integer cents and displayed in MAD
- Development: `uv` for Python commands and npm for the frontend

## Completed foundation

### Phase 0 — Project scaffolding

- FastAPI backend and Next.js frontend
- PostgreSQL connection and Alembic migrations
- Backend/frontend health connection
- Dockerfiles and Docker Compose configuration

**Status: Complete.**

### Phase 1 — Single-user authentication

- User model and password hashing
- JWT login and protected `/auth/me` endpoint
- One-time user creation script instead of public registration
- Frontend authentication guard validates the token with the backend
- Expired or invalid tokens are removed and redirected to login
- Connection errors show a retry state instead of incorrectly logging the user out

**Status: Complete and manually verified.**

See [docs/PHASE_1_AUTH.md](docs/PHASE_1_AUTH.md) and [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md).

### Phase 2 — Onboarding and financial plan

- Expected base monthly income
- Optional disclosure of available savings outside the emergency fund
- Freedom Funds, Essentials, and Lifestyle allocation percentages
- Emergency-fund target of 3–6 months of Essentials
- Current emergency-fund balance captured during onboarding
- Percentages validated to total 100%
- Base income automatically synchronized for the current month

Blank available savings means private; zero means the user explicitly reports no other savings.

**Status: Complete and manually verified.**

### Phase 3 — Income tracking

- One expected base-income entry for the current month
- Arbitrary additional income such as freelancing, bonuses, e-commerce, or trading
- Income create, read, update, and delete operations
- Monthly base/additional/total summaries
- Historical months are never populated using today’s income configuration
- Database uniqueness protection prevents duplicate automatic base-income entries
- Unit tests cover current-month synchronization and historical behavior

**Status: Complete and tested.**

### Phase 4 — Expense tracking

- Manual expense entry with date, amount, note, and category
- Essentials and Lifestyle categories
- Monthly filtering and summaries
- Category-level dashboard breakdown
- Loading, error, and empty states

**Status: Complete and manually verified.**

### Phase 5 — Debt tracking

- Debt creation with starting balance, planned monthly payment, and optional payoff date
- Remaining-balance and repayment-progress calculations
- Payment history
- Overpayment protection
- Regular payments classified as monthly Essentials
- Extra or advance payments reduce debt but remain separate from regular monthly expenses
- Optional funding source for extra payments: current income, existing savings, or undisclosed

Previously created payments are preserved and classified as regular by the migration because their original type cannot be inferred safely.

**Status: Complete and manually verified.**

### Phase 6 — Emergency-fund budget engine

- Emergency-fund target derived from monthly income, Essentials percentage, and selected multiplier
- Below the target, Freedom Funds are recommended for the emergency fund
- At or above the target, Freedom Funds are recommended for investing
- The recommendation guides the user but does not prevent investment actions
- Debts remain part of Essentials rather than Freedom Funds
- Boundary tests cover one cent below, exactly at, and above the target
- Obsolete Freedom Funds debt-allocation model, API logic, and database table removed

**Status: Complete and unit-tested.**

### Phase 7 — Dashboard, investments, and interface

- Responsive dashboard and shared authenticated application layout
- Monthly income versus regular-expense comparison
- Six-month trend chart
- Planned-versus-actual bucket comparison
- Essentials and Lifestyle category breakdown
- Emergency-fund status and guidance
- Investment ledger and investment-type summary
- Regular debt payments included under Essentials
- Extra debt payoff displayed separately as a financial move
- Optional available savings displayed only when disclosed
- Redesigned landing, login, onboarding, dashboard, management, income, expense, debt, investment, and emergency-fund pages
- Consistent loading, error, empty, spacing, and responsive states

**Status: Complete, manually verified, linted, type-checked, and production-built.**

## Current stabilization baseline

- Alembic database is at revision `66b7c59bd3af`
- Budget-engine tests pass
- Income synchronization tests pass
- Backend application imports successfully
- Frontend ESLint passes
- TypeScript checking passes
- Next.js production build passes using Webpack
- The onboarding, income, expense, debt, investment, emergency-fund, and dashboard flows have been manually exercised

## Next milestones

### Phase 8 — Private deployment

- Deploy PostgreSQL, FastAPI, and Next.js to a private staging environment
- Configure production environment variables and secrets
- Apply Alembic migrations during deployment
- Configure frontend API URL and backend CORS origins
- Verify authentication, persistence, refresh behavior, and all primary workflows remotely
- Add database backup and recovery procedures
- Review logs and deployment health checks

**Done when:** the verified local baseline works consistently in a private hosted environment.

### Phase 9 — AI-assisted expense categorization

- Suggest a category from an expense description
- Show the suggestion before saving
- Allow the user to accept or override it
- Remember explicit corrections where appropriate
- Fall back to manual selection if the AI service is unavailable
- Avoid sending unnecessary financial or personal information to the model

**Done when:** suggestions are useful, editable, privacy-conscious, and never block expense creation.

### Phase 10 — Receipt OCR

- Upload or photograph a receipt
- Extract merchant, date, total, and useful line-item text
- Present extracted fields for confirmation before saving
- Combine OCR output with category suggestions
- Reject unsupported files safely and handle low-confidence results
- Define retention and deletion rules for receipt images

**Done when:** a receipt can produce a reviewable draft expense without silently saving incorrect data.

### Phase 11 — Multi-user architecture

- Associate all financial records with a user
- Enforce user ownership in every query and mutation
- Add registration, password recovery, and account management
- Replace browser token storage with a production-grade authentication approach
- Add authorization and tenant-isolation tests
- Migrate existing single-user data safely

**Done when:** multiple users can use Nisba without accessing or affecting each other’s information.

### Phase 12 — Financial learning and market information

- Curated books, courses, and educational videos
- Practical explanations of budgeting and investment methods
- Morocco-relevant financial and economic resources
- Market and Casablanca Stock Exchange information where reliable data is available
- Clear separation between education, application guidance, and professional financial advice

## Product principles

- Guide rather than force the user’s financial decisions.
- Keep undisclosed information genuinely optional.
- Separate routine spending from exceptional financial moves.
- Never silently convert uncertain OCR or AI output into a real transaction.
- Store money as integer cents and protect financial calculations with tests.
- Prefer understandable recommendations over opaque automation.
- Adapt established financial ideas to the user’s context instead of presenting one method as universally correct.

## Working agreement

- Work on one verified step at a time.
- Explain the reason for a change before introducing it.
- The assistant provides code and commands for manual execution unless explicitly authorized to edit a particular file.
- Complete tests and documentation before creating each stable baseline commit.
