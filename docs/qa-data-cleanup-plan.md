# Plan: remove QA / test data from the production database

Status: PLAN ONLY. Nothing has been deleted. Findings come from read-only SELECT queries on 2026-11-18.

## What is there

Rows that look like test fixtures (name, code or reference contains QA, UI QA, QA-E2E or E2E, or usernames starting e2e/qa):

| Table | Fixture rows | Notes |
|---|---|---|
| Project | 139 of 140 | 14 have odd names (blank, "AAAA...") and need a human look |
| User | 158 | 2 do not look like QA: "Del Probe", "Production Smoke Test" |
| Staff | 26 | |
| SystemRole | 24 | e.g. QA11 coord 163403 |
| Vendor / Contractor | 21 / 7 | |
| ServiceOrder | 8 | soNum QA-SOD-... |
| Invoice | 6 of 6 | INV-2026-0001/0002 are children of QA contractors with amount 0 |
| PurchaseOrder / GRN / StockRequest | 21 / 23 / 27 | |
| JournalEntry / PaymentVoucher | 66 / 46 | posted ledger entries |
| InventoryLedger | 48 | immutable audit ledger (SHA-256 checksum) |
| Notification | about 1.28 million | sent to the 158 test users, so they go with the users |

Dependent rows (what must be removed together): about 1.29 million rows in 120 tables, of which Notification is 1.28 million.

Not test data, keep: workflow templates named QA (QA stage, QA_COMMISSIONING, QA_QC team key) are the real quality-assurance workflow. The scan treats them as false positives.

## Risks

1. The accounting ledger (JournalEntry and JournalLine) and the InventoryLedger are audit records. The project rules say they are immutable. Deleting posted entries should be a conscious finance decision, not a side effect.
2. Some fixtures are not clearly labelled (14 projects, 2 users, 2 invoices). They must be reviewed by a person before anything is deleted.
3. Foreign keys are mostly RESTRICT, so deletes must run children first or the database refuses.
4. Dashboards and the P&L will change: Company health currently shows a loss and negative cash that are caused by these fixtures.

## Steps

1. **Backup first.** Full `pg_dump` of the production database on the server, copied off the server, restore-tested on a scratch database.
2. **Freeze the list.** Run the closure query (read-only) and export the exact ids per table to a file. The person who owns the data reviews: the 14 odd projects, the 2 odd users, the 2 invoices, and the 66 journal entries.
3. **Decide the ledger rule** (finance owner): delete the QA journal entries and ledger rows with the rest, or keep them and only hide them. Recommendation: delete them, because they are all test postings (period September and November 2026), after the backup and with the audit log entry below.
4. **Rehearse on a copy.** Restore the backup to a scratch database and run the delete there. Check: no foreign key errors, row counts equal the frozen list, application starts, dashboards and P&L load.
5. **Production run in one transaction** in a quiet period: delete children first by foreign-key order (generated from the catalogue, not hand written), `DELETE ... WHERE id = ANY(frozen ids)`, check the counts inside the transaction, and only then commit. Roll back on any difference.
6. **Audit.** Write one audit entry: who approved, backup name, row counts per table.
7. **Verify.** Run `pnpm run verify:nexus` and the dashboard checks; confirm Company health, P&L and the Projects tab show only real data; confirm the 1.28 million notifications are gone and the table is vacuumed.
8. **Stop it happening again.** Test and QA runs must use a separate database. Add a rule: QA scripts refuse to run against the production `DATABASE_URL`.

## Decisions so far

- Ledger deletion (step 3) is approved by the **Finance owner**. Their approval has NOT been given yet; until it is, no ledger row may be touched.

## What I need from you

- The Finance owner's written approval for the ledger deletion (step 3).
- A person to review the unclear rows (step 2).
- A quiet time window for step 5.
