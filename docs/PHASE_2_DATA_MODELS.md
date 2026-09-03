# Phase 2 — Data Models & Onboarding (short version)

## Onboarding logic
`GET /onboarding/status` checks 3 things exist: `IncomeModeConfig` row, `EmergencyFundConfig` row, a `BudgetSplit` row. All 3 present → `is_onboarded: true`, else redirect to `/onboarding`. Re-submitting later: income mode + EF multiplier get **overwritten** (1 row each), budget split gets a **new row added** (history kept).

## Tables — why each one

| Table | Why | Versioned? |
|---|---|---|
| `IncomeModeConfig` | just a UI hint (which income fields to show) | No — 1 row, overwritten |
| `BudgetSplit` | your spec required history so past months stay accurate | **Yes** — insert-only, resolved by "latest `effective_date` ≤ today" |
| `EmergencyFundConfig` | EF multiplier (3–6) | No — 1 row, overwritten |
| `Debt` | own entity per spec, no CRUD yet (Phase 5) | — |
| `Category` | has a `bucket` (essentials/lifestyle) field now, even though CRUD is Phase 4 — added early so Phase 7's "Lifestyle remaining" dashboard doesn't need a backfill migration later | — |
| `IncomeEntry` | one table for fixed + freelance (`source` field), matches "sum whatever entries fall in the month" — no CRUD yet (Phase 3) | — |
| `Expense` | `category_id` required (not nullable) — every expense ends up categorized | — |

No `user_id` anywhere — single user forever, so every table is implicitly "yours."

## Validation
`OnboardingRequest` checks percentages sum to 100 and multiplier is 3–6, via Pydantic `field_validator`. Backend is the real enforcement; frontend just mirrors it for instant feedback.

## Routes
- `POST /onboarding` — upserts income mode + EF config, inserts new budget split row.
- `GET /onboarding/status` — read-only version of the same checks.
- `POST/GET /budget-splits`, `GET /budget-splits/current` — same insert/resolve logic, usable standalone later without redoing full onboarding.

## Frontend
`OnboardingForm` — controlled inputs, live "total: X" label. `page.tsx` — a `useQuery` for onboarding status + `useEffect` that redirects to `/onboarding` if not done yet; a loading guard stops the home page flashing before the redirect fires.
