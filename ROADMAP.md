# Personal Finance & Budget Tracker — Roadmap

Solo-use app. Built one phase at a time — each phase must be confirmed working before the next starts. This file tracks what each phase covers and current status.

**Stack:** FastAPI + PostgreSQL + SQLAlchemy + Alembic (backend, using `uv` for venv/deps) · Next.js (TS, App Router) + Tailwind + shadcn/ui + TanStack Query + Recharts (frontend) · simple JWT auth · money stored as integer cents · LLM-based expense auto-categorization (later phase).

---

### ✅ Phase 0 — Scaffolding
Backend (FastAPI + Postgres connection + SQLAlchemy + Alembic wired up) and frontend (Next.js + Tailwind + shadcn/ui + TanStack Query) skeletons, connected end to end via a `/health` check.
**Status: Done.**

### ✅ Phase 1 — Auth (single-user JWT)
`User` model + migration, password hashing (bcrypt via passlib), JWT issuance/verification (`python-jose`), protected `/auth/me` route, one-time seed script (`create_user.py`) instead of a public signup endpoint. Frontend: login page, token in `localStorage`, `AuthGuard` redirecting unauthenticated visits to `/login`.
**Status: Done.** Full explanation: [PHASE_1_AUTH.md](PHASE_1_AUTH.md). Live call-by-call trace tool: `backend/scripts/trace_auth_flow.py` → writes `backend/AUTH_TRACE.md`.

### ⬜ Phase 2 — Core data models & onboarding
Models: `IncomeModeConfig`, `BudgetSplit` (versioned by `effective_date`), `EmergencyFundConfig` (multiplier), `Debt`, `Category`, `IncomeEntry`, `Expense` + migrations. Onboarding flow: pick income mode, set budget split % (must sum to 100), set EF multiplier (3–6).
**Done when:** onboarding persists all config; changing the budget split later creates a new versioned row instead of overwriting, so past months still resolve to the split that was active then.

### ⬜ Phase 3 — Income CRUD
Log/edit/delete income entries (fixed and/or freelance, depending on chosen mode). Monthly aggregation = sum of entries falling in that calendar month.
**Done when:** all 3 income modes produce correct monthly totals; full CRUD from the UI.

### ⬜ Phase 4 — Expense CRUD (manual only)
Amount, note, date, manually-picked category. No AI yet. Filtering/listing by month.
**Done when:** full CRUD works end-to-end; expenses filter correctly by date range/month.

### ⬜ Phase 5 — Debt tracking
Debt entity: balance, monthly payment, payoff target date. Payment logging + progress view.
**Done when:** can create a debt, log payments, see accurate progress toward the target date.

### ⬜ Phase 6 — Budget engine & Emergency Fund phase logic *(critical logic)*
Server-side: EF target = Essentials × multiplier. Phase 1 (building) = 100% of Freedom Funds → EF. Phase 2 (unlocked) = Freedom Funds split Investments/Debt by a sub-ratio, once EF target is hit. Persisted allocation history so past months don't recompute differently later.
**Done when:** engine correctly reports phase, EF target/progress, and allocation split — including correctly flipping from Phase 1 to Phase 2 at the target boundary. Covered by unit tests on that transition.

### ⬜ Phase 7 — Dashboard
Savings, EF progress, this month's spendable (Lifestyle remaining), Investments (placeholder), Debt progress — clearly separated, no double-counting. Charts via Recharts.
**Done when:** dashboard numbers match a manual hand-calculation for a test month.

### ⬜ Phase 8 — AI categorization
LLM call (note text → suggested category) on expense creation, with accept/override and graceful fallback on API failure.
**Done when:** new expenses get a suggestion at acceptable latency; overrides persist; API failure doesn't block expense creation.

---

### Explicitly out of scope for now
- Casablanca Stock Exchange price integration
- OCR receipt scanning, chatbot input channel
- Multi-user support, OAuth, team features

### Working agreement
- One phase at a time — wait for explicit confirmation before starting the next.
- Claude never runs commands or writes/edits project files directly — always hands over commands + file contents for manual execution, unless explicitly told otherwise for a specific file (e.g. this doc).
