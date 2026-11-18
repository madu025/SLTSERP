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

## Tables the assistant and the Report Center can read

The five original entities (service orders, material usage, contractor stock, wastage, journal entries) plus the tables in `src/services/reports/entity-registry.ts`: projects, project tasks, contractors, contractor invoices, supplier invoices, purchase orders, goods received notes, inventory items, store stock and helpdesk tickets.

- **Nothing is exposed unless it is listed in the registry.** Each entry names the capability that opens it, the exact fields (and many-to-one relations) that may be read, the fields that need a second capability (for example project budget needs `project.finance.read`), and the path to its OPMC. A table with no OPMC path is company-wide only and is refused for users limited to specific OPMCs. Personal and secret fields (NIC, bank, e-mail, passwords) are never listed; a unit test enforces that.
- **Mechanics come from the Prisma schema** (table and column names, joins, number/date/enum types, enum values), so they cannot drift from the database. A renamed column makes `tests/unit/report-registry.test.ts` fail.
- **To add a table**: add an entry to `EXTRA_ENTITIES`, add oracle cases to `scripts/verify-nexus-accuracy.ts` (the group-by sweep covers every new field automatically), run `pnpm run verify:nexus`.

## Self-correction (no data goes to the model)

When the planning model asks for a table, field or operator that does not exist, the system answers with the error and the list of valid names (never rows) and lets the model plan again, at most twice (`src/services/ai/nexus-repair.ts`). Rules sent with the error: keep every condition the user asked for, change only the table, field, operator or value format, never drop a condition. A refused request (no access) is never retried. The evidence line shows "request corrected automatically (n retries)" when it happened. Values that do not exist (a status, an RTOM) are not retried: the user is told the allowed values or asked which one was meant.
## Known limits

- A question can still be understood differently from what was meant (for example which revenue). The "Searched" line states exactly what was queried so the reader can check.
- The verification suite needs database access, so it runs by hand (or from a scheduled job on the server), not in CI.
