# Nisba — Personal Finance & Budget Tracker Roadmap

Current scope is a solo-use app. This file distinguishes features present in code from features verified end-to-end; a fresh-database walkthrough is still pending.

**Stack:** FastAPI + PostgreSQL + SQLAlchemy + Alembic (backend, using `uv` for venv/deps) · Next.js (TS, App Router) + Tailwind + shadcn/ui + TanStack Query + Recharts (frontend) · simple JWT auth · money stored as integer cents · LLM-based expense auto-categorization (later phase).

---

### ✅ Phase 0 — Scaffolding
Backend (FastAPI + Postgres connection + SQLAlchemy + Alembic wired up) and frontend (Next.js + Tailwind + shadcn/ui + TanStack Query) skeletons, connected end to end via a `/health` check.
**Status: Done.**

### ✅ Phase 1 — Auth (single-user JWT)
`User` model + migration, password hashing (bcrypt via passlib), JWT issuance/verification (`python-jose`), protected `/auth/me` route, one-time seed script (`create_user.py`) instead of a public signup endpoint. Frontend: login page, token in `localStorage`, `AuthGuard` redirecting unauthenticated visits to `/login`.
**Status: Done.** Full explanation: [docs/PHASE_1_AUTH.md](docs/PHASE_1_AUTH.md), diagram: [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md). Live call-by-call trace tool: `backend/scripts/trace_auth_flow.py` → writes `backend/AUTH_TRACE.md`.

### ✅ Phase 2 — Core data models & onboarding
Models: `IncomeModeConfig`, `BudgetSplit` (versioned by `effective_date`), `EmergencyFundConfig` (multiplier), `Debt`, `Category`, `IncomeEntry`, `Expense` + migrations. Onboarding flow: pick income mode, set budget split % (must sum to 100), set EF multiplier (3–6).
**Status: Done.** Full explanation: [docs/PHASE_2_DATA_MODELS.md](docs/PHASE_2_DATA_MODELS.md).

### 🟡 Phase 3 — Income CRUD
Income entry CRUD and monthly summaries are implemented. Fixed salary can be configured and an entry is generated when the current month is read; historical months are no longer auto-filled from today's salary.
**Status: Implemented; end-to-end verification pending.** Current-month generation still happens during GET requests and lacks a database uniqueness guard, so concurrent reads can create duplicates.

### 🟡 Phase 4 — Expense CRUD (manual only)
Expense CRUD, manual category selection, and monthly filtering/summaries are implemented. No AI categorization yet.
**Status: Implemented; fresh-database verification pending.**

### 🟡 Phase 5 — Debt tracking
Debt CRUD, payment logging/history, remaining-balance calculation, and progress view are implemented.
**Status: Implemented; fresh-database verification pending.** Debt payments belong in Essentials, but the dashboard still counts them under Freedom Funds in its planned-vs-actual comparison.

### 🟡 Phase 6 — Budget engine & Emergency Fund phase logic *(critical logic)*
The EF target is calculated from the onboarding income estimate and Essentials percentage, then stored. Below the target, the engine recommends 100% of Freedom Funds to the EF; at or above the target, it recommends 100% to investments. Debt is not recommended from Freedom Funds. Three unit tests cover one cent below, exactly at, and above the target.
**Status: Core recommendation implemented and unit-tested; integration and historical behavior pending.** The old Investments/Debt allocation model and endpoints still exist but are no longer used by the recommendation. Persisted monthly allocation history has not been implemented.

### 🟡 Phase 7 — Dashboard and investments
The dashboard shows EF progress, Lifestyle remaining, investment totals, debt remaining, spending by category, a six-month income/expense chart, and planned-vs-actual budget bars. An investment ledger and per-type summary are implemented.
**Status: Implemented; manual calculation against a test month and fresh-database verification pending.** The dashboard's debt-payment bucket needs correction before its comparison can be trusted.

### ⬜ Phase 8 — AI categorization
LLM call (note text → suggested category) on expense creation, with accept/override and graceful fallback on API failure.
**Done when:** new expenses get a suggestion at acceptable latency; overrides persist; API failure doesn't block expense creation.

### Current stabilization work
- Protected app layout redirects to login when onboarding-status returns 401 and shows a retry state for other failures. Other API calls still need consistent expired-token and loading/error handling.
- Docker Compose and Dockerfiles exist; first-run user/category/investment-type setup and a fresh-database walkthrough are not yet verified.
- Next priorities: correct debt payments in dashboard Essentials, prevent current-month fixed-salary duplicates, verify the full flow on a disposable database, and finish frontend loading/error handling.

---

### Explicitly out of scope for now
- Casablanca Stock Exchange price integration
- OCR receipt scanning, chatbot input channel
- Multi-user support, OAuth, team features

### Working agreement
- One phase at a time — wait for explicit confirmation before starting the next.
- The assistant provides code and commands for manual execution unless explicitly authorized to make a particular change.
