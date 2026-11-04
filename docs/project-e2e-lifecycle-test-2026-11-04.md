# Project lifecycle end-to-end test, 2026-11-04

Project `QA-E2E-1793726468687` (Building Fiber, OPMC R-AD) ran from creation to `COMPLETED` against the
real database as nine role accounts. Fixtures are labelled `QA-E2E` / `e2e_*`; accounts are now inactive.

## Covered
Project create, 17 workflow stages with 2-3 level approvals, document upload and approval (CAD, as-built),
BOQ items and the 3-level BOQ approval, task plan (40 items, 39 assignments), plan approval generating 43
tasks, contractor assignment, PR from BOQ, vendor, PO (approve, issue), GRN (approve), stock issue (approve),
in-house and SLT PAT (80% pass rate), contractor invoice, payment voucher, client invoice, SLT submission,
customer receipt, retention-free closure, notifications at each hand-off, `/projects/my-tasks`.

## Defects found and fixed
| Area | Defect | Fix |
|---|---|---|
| Project routes | Strict Zod 4 `z.string().uuid()` rejects most database ids (`uuid_generate_v7`), so task updates, LD penalties, retentions, IR ledger, reservations and review routes returned 422 | `databaseUuidSchema`, plus a guard test |
| Task routes | An assignee without `project.plan.write` got 403 on their own task although the service allows progress updates | route admits any project reader; `assertTaskActor` still decides |
| Plan approval | A project with no start date always failed with `INVALID_TASK_DATE_RANGE` (500); 44 serial writes also outran Prisma's 5 s transaction limit | calendar-day comparison; explicit transaction timeout |
| Project GRN | Approval wrote the GRN number into a UUID column (always failed) and never created batches, so received goods could not be issued | use `grn.id`; create batch and batch stock like the inventory GRN |
| Invoices | Any invoice numbered outside `PINV-` (for example `QA-INV-...`) made every later number collide at `PINV-00001` | counter reads only the `PINV-` series |
| Notifications | Recipient lookup capped 100 holders of a role before applying the OPMC scope, so most real recipients were missed | scope is part of the query |

## Open findings (not fixed)
- Document approval broadcasts "Approval Completed" to the whole ADMINISTRATORS audience (about 250 users) per
  document. BOQ 3-level approvals notify nobody.
- Plan-generated project tasks stay PENDING after their workflow stage completes, so closure waits for them.
- Completing the last stage closes the project, and `POST /close` then answers `PROJECT_ALREADY_CLOSED`.
- Header shows "Contractor: Not Assigned" although a contractor assignment exists (reads `project.contractorId`).
- `cycle-count.service.ts` and `wastage.service.ts` also write non-UUID values to `InventoryTransaction.referenceId`.
- Invoice number generation is not concurrency-safe (read max, add one).

## Real-data footprint
Permanent records: 2 ledger journal entries (invoice issuance), 1 GL accrual for GRN-00001 (LKR 1,380), stock
ledger rows for the receipt and issue (store stock back to its original quantity), 1 vendor, 1 PO, 1 GRN,
1 stock issue, 2 invoices, 1 payment voucher, the completed project, and audit logs.
