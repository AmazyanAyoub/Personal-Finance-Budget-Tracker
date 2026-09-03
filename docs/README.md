# Explanation Docs

Deep-dive write-ups for each build phase — what got built, why each piece exists, and how to trace it live. Build status/checklist lives in [../ROADMAP.md](../ROADMAP.md).

- [PHASE_1_AUTH.md](PHASE_1_AUTH.md) — JWT auth: password hashing, token issuance/verification, the protected-route dependency, every backend and frontend file involved.
- [AUTH_FLOW.md](AUTH_FLOW.md) — full auth flow as a Mermaid sequence diagram, every success/failure branch mapped to the code that decides it.
- [PHASE_2_DATA_MODELS.md](PHASE_2_DATA_MODELS.md) — onboarding logic (fill once, revise anytime), why each table/column exists, why `BudgetSplit` is versioned and the others aren't, the validation and route logic, frontend wiring.
- [PHASE_2_FLOW.md](PHASE_2_FLOW.md) — Mermaid diagrams: onboarding page-load/submit/resolve scenarios, and the `seed_categories.py` script flow.
