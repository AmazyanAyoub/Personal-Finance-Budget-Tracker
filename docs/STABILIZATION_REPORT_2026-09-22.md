# Nisba Stabilization Report

**Report date:** 22 September 2026  
**Baseline commit:** `721a0da` (`improved App logic.`)  
**Branch:** `main`  
**Remote status at report creation:** synchronized with `origin/main`  
**Database migration head:** `66b7c59bd3af`

## 1. Purpose

This report records the stabilization cycle that converted Nisba from a collection of completed feature phases into a coherent, tested single-user personal finance application.

The work focused on correcting financial logic, simplifying onboarding and income tracking, improving authentication behavior, redesigning the user interface, removing obsolete code, and verifying the main user workflows before deployment.

This is a historical snapshot. The current product direction remains in [ROADMAP.md](../ROADMAP.md), while general setup and usage are documented in [README.md](../README.md).

## 2. Baseline scope

The stabilized application supports:

- single-user JWT authentication;
- guided financial onboarding;
- expected monthly income and additional income tracking;
- Essentials and Lifestyle expense tracking;
- emergency-fund calculation and progress;
- debt creation, payment history, and payoff progress;
- regular versus exceptional debt-payment classification;
- investment tracking;
- a responsive financial dashboard;
- optional savings disclosure;
- loading, error, empty, and expired-token states.

The application stores money as integer cents and presents values in Moroccan dirhams.

## 3. Main problems addressed

### 3.1 Historical income generation

Reading an old month could previously create an income entry using the user’s current fixed salary. Deleting an automatically generated entry could also cause it to reappear with a new database ID.

This made historical reports unreliable and created a risk of duplicate income.

### 3.2 Overcomplicated income modes

The original onboarding model separated fixed-only, freelance-only, and fixed-plus-freelance users. This created unclear behavior:

- fixed salary was not always persisted correctly;
- freelance estimates did not consistently appear as income;
- mixed-income onboarding displayed confusing duplicate concepts;
- the data model tried to predict the source of income instead of recording what the user actually receives.

### 3.3 Emergency-fund boundary confidence

The transition from emergency-fund Phase 1 to Phase 2 required explicit tests. A one-cent boundary error could send all Freedom Funds to the wrong recommendation.

### 3.4 Debt allocation and dashboard accuracy

Debt was initially treated partly as a Freedom Funds concern even though regular debt payments belong under Essentials.

A larger issue appeared when an advance debt payment was logged. For example, a 100,000 MAD payment funded from existing savings was counted as a normal expense for that month. The dashboard then appeared to show spending far above monthly income without explaining that the payment came from previously accumulated money.

### 3.5 Obsolete Freedom Funds allocation

The earlier investment-versus-debt allocation model was no longer used by the budget engine but remained in the application and database, creating conflicting financial logic.

### 3.6 Authentication and application states

The frontend previously trusted the mere presence of a token in browser storage. Invalid or expired tokens could leave the application in an inconsistent state. Loading, connection-error, and empty states also needed a consistent treatment.

### 3.7 Interface structure

The first interface treated Income, Expenses, Debts, Investments, and Emergency Fund mainly as navigation destinations. The dashboard and action pages needed clearer hierarchy, more useful summaries, stronger visual consistency, and better mobile behavior.

## 4. Implemented changes

### 4.1 Income and onboarding simplification

- Replaced income modes with one expected base monthly income.
- Added arbitrary named additional income entries.
- Added `IncomeConfig.monthly_income_cents` as the income configuration source of truth.
- Added `IncomeEntry.name` and `IncomeEntry.is_recurring_base`.
- Removed the old fixed/freelance enums and duplicated emergency-fund income estimate.
- Added current-month base-income synchronization in `backend/app/core/income.py`.
- Prevented automatic income generation for historical months.
- Added a partial unique database index so only one recurring base entry can exist for a given month date.
- Updated onboarding to create the current month’s base-income entry.
- Updated the income page to distinguish base and additional income clearly.

### 4.2 Optional savings disclosure

- Added nullable `available_savings_cents` to the income configuration.
- Defined clear semantics:
  - `NULL`: the user keeps the amount private;
  - `0`: the user explicitly reports no other savings;
  - positive value: the disclosed amount outside the emergency fund.
- Added onboarding input and API endpoints for reading or updating the value.
- Displayed the amount on the dashboard only when disclosed.
- Avoided automatically reducing the savings snapshot after a debt payment because transaction dates and snapshot dates may differ.

### 4.3 Emergency-fund engine

- Extracted the recommendation calculation into testable logic.
- Below the target, the engine recommends directing Freedom Funds to the emergency fund.
- At or above the target, it recommends directing Freedom Funds to investments.
- The recommendation remains guidance rather than an enforced restriction.
- Debt is not allocated from Freedom Funds.

### 4.4 Debt-payment classification

- Added `regular` and `extra` payment types.
- Added optional extra-payment funding sources:
  - current income;
  - existing savings;
  - undisclosed.
- Added database constraints for valid classifications.
- Preserved older payment records by classifying them as regular during migration.
- Added validation preventing payments above the remaining balance.
- Added payment-type and funding-source controls to the debt interface.
- Added classification and funding context to payment history.

### 4.5 Dashboard corrections

- Included only regular debt payments in Essentials and normal monthly expenses.
- Excluded extra payments from the regular income-versus-expense chart.
- Continued applying all payments to debt-balance and progress calculations.
- Displayed extra debt payoff as a separate financial move.
- Added funding-source totals for exceptional payments.
- Corrected the six-month trend and planned-versus-actual calculations.
- Displayed optional available savings separately from the emergency fund.

### 4.6 Obsolete code removal

- Removed the old Freedom Funds investment/debt allocation model.
- Removed its route and schema logic.
- Removed its database table through a forward Alembic migration.
- Retained migration history instead of altering previously applied migrations.

### 4.7 Authentication behavior

- Updated the authentication guard to validate tokens through `/auth/me`.
- Invalid or expired tokens are removed and redirected to login.
- Backend connection problems show an error and retry state rather than pretending the token is invalid.
- Protected onboarding from unauthenticated access.

### 4.8 Frontend redesign and consistency

- Redesigned the landing, login, registration, onboarding, dashboard, income, expense, debt, investment, emergency-fund, and management experiences.
- Added a shared authenticated application layout and navigation.
- Added a central Manage Money destination for financial actions.
- Improved responsive layouts and chart containment.
- Added consistent buttons, spacing, cards, colors, progress indicators, and typography.
- Added loading, error, retry, and empty states.
- Improved explanations around debt creation, debt payments, emergency funds, and additional income.

## 5. Database migrations

### `1351d9c116d1_simplify_income_and_onboarding`

This migration:

- renamed `income_mode_config` to `income_config`;
- renamed fixed salary to monthly income;
- recovered compatible old onboarding data where possible;
- removed incomplete invalid configurations;
- converted old fixed/freelance entries into base/additional entries;
- added income validation and uniqueness protection;
- removed obsolete income enums;
- removed the duplicated emergency-fund income estimate.

### `66b7c59bd3af_classify_debt_payments_and_add_optional_savings`

This migration:

- added optional available savings;
- added non-negative savings validation;
- added debt-payment type;
- classified existing payments as regular;
- added optional funding source;
- added database checks for valid payment and funding values.

The database was confirmed at:

```text
66b7c59bd3af (head)
```

## 6. Automated verification

The following checks were run successfully during stabilization.

### Backend

```bash
uv run alembic current
uv run python -c "from app.main import app; print('Backend imports successfully')"
uv run -m tests.test_budget_engine
uv run -m tests.test_income
```

Budget-engine coverage includes:

- one cent below the emergency-fund target;
- exactly at the target;
- above the target.

Income coverage includes:

- current-month base income is generated once;
- changing expected monthly income updates the current entry without duplication;
- historical months do not receive automatically generated income.

### Frontend

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build -- --webpack
```

The ESLint check, TypeScript check, and production build completed successfully.

## 7. Manual verification

The primary application workflows were exercised locally:

- login with a valid account;
- rejection and cleanup of an invalid token;
- onboarding completion and dashboard redirect;
- base monthly income creation;
- additional income creation;
- expense creation and category reporting;
- emergency-fund balance and target behavior;
- debt creation and payoff progress;
- regular debt payment included under Essentials;
- extra debt payment excluded from regular monthly expenses;
- extra debt payment displayed separately with funding context;
- investment logging and dashboard totals;
- responsive and empty-state behavior across the main pages.

The representative debt scenario used for final verification was:

- starting debt: 150,000 MAD;
- regular payment: 3,000 MAD;
- extra payment: 100,000 MAD from existing savings;
- resulting balance: 47,000 MAD.

The dashboard correctly treated only 3,000 MAD as a regular monthly expense and displayed the 100,000 MAD payoff separately.

## 8. Documentation changes

- Replaced the empty root README with a full product, usage, setup, verification, and privacy guide.
- Updated the roadmap to reflect the actual stabilized application.
- Documented the Morocco-focused purpose and book-inspired product direction.
- Added deployment, AI categorization, OCR, multi-user, and education milestones.

## 9. Known limitations

- The data model is still single-user; financial records are not yet scoped by user ID.
- Public registration and password recovery are not production-ready.
- Authentication still requires a production security review before public use.
- AI categorization is not implemented.
- Receipt OCR is not implemented.
- Available savings is a user-provided snapshot, not a reconciled bank balance.
- Extra payments are not automatically deducted from reported savings.
- Historical documents under `docs/` may describe the older model as it existed during their original phase.
- Deployment, remote backups, monitoring, and restore procedures remain to be verified.

## 10. Deployment readiness decision

The stabilized baseline is suitable for a private staging deployment. It should not yet be presented as a public multi-user financial service.

Before public use, the project needs:

- per-user ownership on every financial table and query;
- stronger production authentication and session handling;
- secret and CORS configuration review;
- HTTPS-only deployment;
- backup and restore testing;
- privacy rules for future receipt images and AI requests;
- authorization and tenant-isolation tests.

## 11. Next recommended sequence

1. Deploy the current commit to a private staging environment.
2. Verify migrations, authentication, persistence, CORS, refresh behavior, and backups remotely.
3. Create a stable deployment tag after the hosted smoke test passes.
4. Design AI categorization as an optional suggestion workflow.
5. Add receipt OCR only after upload privacy, storage, confidence, review, and deletion rules are defined.
6. Complete multi-user isolation before opening registration publicly.

## 12. Conclusion

This stabilization cycle established a coherent financial model and a clean deployment baseline. Nisba now distinguishes expected income from additions, routine expenses from exceptional debt payoffs, emergency-fund money from optional savings, and automated guidance from user choice.

The next phase should preserve that clarity: deployment first, then AI and OCR as reviewable assistants rather than silent decision-makers.
