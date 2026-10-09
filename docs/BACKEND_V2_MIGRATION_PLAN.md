# Backend V2 Migration Plan

This is the progress checklist for migrating Nisba to the approved database design in [DATABASE_DESIGN_V2.md](./DATABASE_DESIGN_V2.md).

## Current status

```text
Current phase: 1 — Create the new V2 models
Current step: 1.1 — FinancialProfile model
```

## Rules

- Do not edit old Alembic migrations.
- Do not delete old tables before V2 is migrated and verified.
- Do not calculate balances in the frontend.
- Every financial action must use `money_events`.
- Every private record must belong to one user.
- Finish and verify the backend before changing the frontend.
- Update this file after every completed step.

## Phase 1 — Create new V2 models

- [ ] 1.1 Create `FinancialProfile` in `backend/app/models/profile.py`.
- [ ] 1.2 Create `AllocationPlan` in `backend/app/models/allocation.py`.
- [ ] 1.3 Create `Goal` in `backend/app/models/goal.py`.
- [ ] 1.4 Create `MoneyEvent` in `backend/app/models/money_event.py`.
- [ ] 1.5 Create `InvestmentAsset`, `InvestmentTransaction` and `InvestmentValuation` in `backend/app/models/investment_v2.py`.
- [ ] 1.6 Add the new models to `backend/app/models/__init__.py` without removing the old imports yet.
- [ ] 1.7 Verify that all model metadata loads without errors.

## Phase 2 — Update shared models

- [ ] 2.1 Update `Category` with `user_id`, `track_kind`, `is_system` and `active`.
- [ ] 2.2 Update `Debt` with `user_id`, V2 column names and `status`.
- [ ] 2.3 Add database constraints, indexes and ownership rules.
- [ ] 2.4 Keep the old columns temporarily when required for safe migration.
- [ ] 2.5 Verify models against SQLite tests and PostgreSQL-compatible types.

## Phase 3 — Migration A: introduce V2 safely

- [ ] 3.1 Generate a new Alembic revision from the current head.
- [ ] 3.2 Create the seven new V2 tables.
- [ ] 3.3 Add the new Category and Debt columns.
- [ ] 3.4 Backfill ownership using the existing single user.
- [ ] 3.5 Backfill Category track values and Debt metadata.
- [ ] 3.6 Keep all obsolete tables and their data.
- [ ] 3.7 Test upgrade and downgrade on a disposable database.
- [ ] 3.8 Apply Migration A locally and confirm `alembic current` is at head.

## Phase 4 — Central financial engine

- [ ] 4.1 Create `core/allocations.py` with exact percentage splitting and cent rounding.
- [ ] 4.2 Create `core/ledger.py` for balanced Money Events.
- [ ] 4.3 Create `core/balances.py` for Total Cash, Tracks, Goals and Debt balances.
- [ ] 4.4 Add idempotency and reversal logic.
- [ ] 4.5 Prevent negative Track and Goal balances.
- [ ] 4.6 Validate Category, Goal, Debt and Asset ownership.
- [ ] 4.7 Commit linked cash, Debt and Investment changes atomically.

## Phase 5 — Rewrite backend APIs

- [ ] 5.1 Rewrite onboarding to create the Profile, Plan, EF Goal and opening event.
- [ ] 5.2 Add Profile endpoints.
- [ ] 5.3 Replace Budget Split endpoints with Allocation Plan endpoints.
- [ ] 5.4 Rewrite Income endpoints to confirm actual received income.
- [ ] 5.5 Rewrite Expense endpoints using Money Events.
- [ ] 5.6 Add Goal create, update, reserve, release and spend endpoints.
- [ ] 5.7 Rewrite Debt endpoints and payments using Money Events.
- [ ] 5.8 Rewrite Investment endpoints for Assets, Transactions and Valuations.
- [ ] 5.9 Add custom Category endpoints.
- [ ] 5.10 Add Money Event history and reversal endpoints.
- [ ] 5.11 Rewrite Dashboard as backend-derived V2 balances.
- [ ] 5.12 Update `backend/app/main.py` router registration.

## Phase 6 — Backend tests

- [ ] 6.1 Test the Money Event balance equation.
- [ ] 6.2 Test allocation rounding so every cent is assigned.
- [ ] 6.3 Test Total Cash and all three Track balances.
- [ ] 6.4 Test Goal reserve, release and spend.
- [ ] 6.5 Test Debt payment, interest and overpayment protection.
- [ ] 6.6 Test Investment buy, sell, dividend, fees and valuation.
- [ ] 6.7 Test reversals and duplicate-request protection.
- [ ] 6.8 Test two-user ownership isolation.
- [ ] 6.9 Test onboarding and Dashboard reconciliation.
- [ ] 6.10 Run the complete backend test suite successfully.

## Phase 7 — Data reconciliation and cutover

- [ ] 7.1 Back up or branch the Neon production database.
- [ ] 7.2 Preserve old records as legacy history.
- [ ] 7.3 Confirm the user's current Total Cash.
- [ ] 7.4 Confirm EF and other Goal balances.
- [ ] 7.5 Confirm Debt remaining balances and Investment holdings.
- [ ] 7.6 Create the balanced V2 opening state.
- [ ] 7.7 Verify that Total Cash equals Tracks plus Goals.
- [ ] 7.8 Switch the backend completely to V2.

## Phase 8 — Migration B: remove obsolete backend

- [ ] 8.1 Remove old Wallet and monthly-close routes, schemas, core logic and models.
- [ ] 8.2 Remove automatic monthly-income generation.
- [ ] 8.3 Remove `ensure_month_is_open`.
- [ ] 8.4 Create a separate cleanup migration.
- [ ] 8.5 Drop obsolete tables only after production verification.
- [ ] 8.6 Remove obsolete columns and PostgreSQL enums.
- [ ] 8.7 Run migrations and all backend tests again.

## Phase 9 — Frontend migration

- [ ] 9.1 Update frontend API types and requests.
- [ ] 9.2 Replace Wallets with Goals.
- [ ] 9.3 Remove month-end and carryover UI.
- [ ] 9.4 Rewrite onboarding for the V2 opening state.
- [ ] 9.5 Rewrite Dashboard around Total Cash, Tracks, Goals, Debts and Net Worth.
- [ ] 9.6 Rewrite Income, Expenses, Debts and Investments pages.
- [ ] 9.7 Run lint, build and full user-flow testing.

## Phase 10 — Deployment

- [ ] 10.1 Deploy Migration A and the V2 backend.
- [ ] 10.2 Deploy the migrated frontend.
- [ ] 10.3 Complete production reconciliation and smoke testing.
- [ ] 10.4 Keep legacy tables during the stabilization period.
- [ ] 10.5 Apply Migration B only after final confirmation.

## Completion definition

The migration is complete when one backend ledger calculates every cash balance, the frontend performs no financial reconstruction, every test passes, production is reconciled and obsolete tables are safely removed.
