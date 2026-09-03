# Phase 2 — Flow Diagrams

## Onboarding (page load + submit)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant BE as Backend
    participant DB as Postgres

    Note over FE: Page load
    FE->>BE: GET /onboarding/status
    BE->>DB: check IncomeModeConfig, EmergencyFundConfig, BudgetSplit
    alt any missing
        BE-->>FE: is_onboarded = false
        FE->>FE: redirect to /onboarding
    else all 3 exist
        BE-->>FE: is_onboarded = true
        FE->>FE: render home page
    end

    Note over FE,DB: SUBMIT
    FE->>BE: POST /onboarding

    alt pcts don't sum to 100, or multiplier not 3-6
        BE-->>FE: 422 validation error
    else valid
        BE->>DB: upsert IncomeModeConfig
        BE->>DB: upsert EmergencyFundConfig
        BE->>DB: INSERT new BudgetSplit row (effective_date = today)
        alt DB CheckConstraint fails (bad data slipped through)
            DB-->>BE: constraint violation
            BE-->>FE: 500
        else ok
            DB-->>BE: commit
            BE-->>FE: 200, is_onboarded = true
        end
    end

    Note over FE,DB: RESOLVING "current" split later
    FE->>BE: GET /budget-splits/current
    BE->>DB: latest BudgetSplit WHERE effective_date <= today
    alt no split yet
        DB-->>BE: none
        BE-->>FE: 404
    else found
        DB-->>BE: row (could be an old one if newest is future-dated)
        BE-->>FE: 200, that split
    end
```

## `seed_categories.py`

```mermaid
sequenceDiagram
    autonumber
    participant S as seed_categories.py
    participant DB as Postgres

    loop each default category
        S->>DB: SELECT Category WHERE name = ?
        alt already exists
            DB-->>S: found
            S->>S: skip
        else new
            DB-->>S: none
            S->>DB: INSERT Category(name, bucket)
        end
    end
    S->>DB: COMMIT
    S->>S: print count created
```

## Scenario reference

| Scenario | Result |
|---|---|
| Config incomplete on page load | Redirect to `/onboarding` |
| Percentages ≠ 100 or multiplier outside 3-6 | `422`, nothing written |
| First submit | 3 inserts |
| Re-submit | mode/EF **updated**, new `BudgetSplit` row **added** |
| Query split for a past date, split changed since | Returns the row that was active *then*, not today's |
| No split exists yet | `/budget-splits/current` → `404` |
| Re-running seed script | Existing categories skipped, only new ones inserted |
