# Nexus assistant: accuracy rules

What a figure shown by the assistant is guaranteed to be, and how that is enforced.

## Rules

1. **The database computes, the model never does.** Totals, groups and averages come from SQL over every matching row. There is no in-memory or sampled aggregation.
2. **Totals reconcile before they are shown.** Each grouped report runs a second query over the same rows (same snapshot); the groups must add up to it and every average must equal sum / count, otherwise the report is withheld. A passing answer shows "totals reconciled".
3. **One definition of "completed".** Completed = status in `SOD_FINANCIAL_COMPLETION_STATUSES` (COMPLETED, INSTALL_CLOSED, PROV_CLOSED, PAT_OPMC_PASSED, PAT_CORRECTED) with a completed date in the period, on the dashboards and in the assistant.
4. **Sri Lanka time.** Days, weeks and months are Colombo (UTC+5:30) calendar periods (`src/lib/sl-time.ts`). A date written without a time means that Colombo day.
5. **Bounded and read-only.** Report SQL runs in one read-only RepeatableRead transaction with a 15 s statement timeout.
6. **Every tool call is audited** (`NEXUS_TOOL`: user, tool, arguments, duration, row count, refused or not; never the rows). Users can flag an answer ("Looks wrong?", `NEXUS_FLAG_WRONG`), which keeps the question, the searched line and the answer for replay.

## Verification

`pnpm run verify:nexus` compares the assistant with independent raw SQL on the real database (read-only): single-table, joined, three-table, filtered, OPMC-scoped reports, a group-by sweep over every queryable field, hostile input, the executive metrics, and dashboard-versus-assistant agreement. It exits non-zero on any mismatch. Run it after any change to the report engine, metrics or entities, and against production data before a release.

## Known limits

- A question can still be understood differently from what was meant (for example which revenue). The "Searched" line states exactly what was queried so the reader can check.
- The verification suite needs database access, so it runs by hand (or from a scheduled job on the server), not in CI.
