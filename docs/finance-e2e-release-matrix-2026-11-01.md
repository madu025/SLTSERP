# Finance E2E Release Matrix — 2026-11-01

This matrix is the source of truth for the December 12 production-readiness
run. Each chain is executed once per release candidate with read, write,
approval, persistence, and UI evidence. A route-only smoke check does not mark
the chain complete.

## Chain ledger

| Chain | Read | Write | Browser UI | Persistence | Status |
| --- | --- | --- | --- | --- | --- |
| Project → Procurement → Inventory → Invoice → Payment → Bank → GL/Reports | 9/9 | pending QA DB | 9/9 live read-only | pending | partial |
| SOD → Issue → Contractor Custody → Return → PAT → WIP → Billing → VAT/WHT | 9/9 | pending QA DB | 9/9 live read-only | pending | partial |
| OSP IOU → Approval → OSP Ledger | service path | 1/1 | browser pending | in-memory only | partial |
| Petty Cash → Approval → Reimbursement → Replenishment | service path | 1/1 | browser pending | in-memory only | partial |
| Contractor Billing → Invoice Approval → Payment Voucher → Bank/Cash → GL | 10/10 | 10/10 service batches | browser pending | in-memory only | partial |
| Fixed Asset → Depreciation → GL → Period Close | 10/10 | 10/10 service batches | browser pending | in-memory only | partial |
| Payroll Allocation → Payment Voucher → Bank/Cash → GL | pending | pending | pending | pending | not started |

## Completion rule

A chain becomes **complete** only when the same synthetic QA records are:

1. created through the browser by the maker role;
2. approved through the browser by a different checker role;
3. reloaded and verified in the next module;
4. verified in the persisted ledger/reporting rows; and
5. checked for UI errors, permission boundaries, duplicate submission, and
   mobile/desktop readability.

## Environment gate

Real browser writes must run against a disposable QA database with seeded
maker/checker/reader fixtures and reset capability. The current checkout has
no local PostgreSQL service or Docker runtime; its configured database is
remote. Therefore production mutations are not a valid substitute for QA
evidence, and the current local browser storage state cannot be treated as a
valid write fixture.

Required non-secret inputs for the next run are:

- `QA_BASE_URL` for the disposable deployment;
- separate Playwright storage states for maker and checker roles;
- deterministic fixture identifiers for project, contractor, bank account, and
  chart-of-accounts records; and
- a reset command that is restricted to that QA database.

The repository now enforces this boundary with
`pnpm run qa:real-preflight`. It fails when the disposable environment marker,
QA database URL, QA base URL, reset script, fixture manifest, or maker/checker
browser storage states are missing. It also rejects reusing the configured
application database or application origin. A passing service adapter test
never satisfies this preflight.

## No-mocked-input rule

The real chain suite must use records returned by the system's source modules;
it must not invent IDs, hard-code business amounts, or seed an in-memory
replacement for a source record. The discovery step must query the disposable
QA database through the application/API and write a manifest of the discovered
IDs. If a source module has no eligible record, the chain is recorded as an
environment/data issue and stops at that boundary instead of fabricating an
input.

Examples:

- Billing starts from an eligible completed SOD and its contractor.
- Payment Voucher starts from the invoice produced by that billing action.
- Depreciation starts from an asset returned by the Fixed Asset Register.
- Period Close starts from the posted GL rows produced by the preceding steps.

The existing `tests/unit/finance-*-batch-10.test.ts` files are deliberately
labelled service-adapter tests. They protect transition logic but do not satisfy
this real-data browser/database rule.

The legacy CSV auto-match route remains available by URL, but it is excluded
from the primary navigation. `Bank Reconciliation` is the official persisted
workflow for the release candidate. Customer receipts belong to the separate
client-invoice chain; contractor invoices settle through an approved payment
voucher.

The contractor chain's deterministic service batch test is
`tests/unit/finance-contractor-chain-batch-10.test.ts`. It verifies ten unique
invoice/voucher/statement/journal identities, maker-checker transitions, paid
voucher ledger events, and reconciled bank summaries. It is not a substitute
for the browser + disposable-database gate above.

The fixed-asset chain's deterministic service batch test is
`tests/unit/finance-fixed-asset-close-batch-10.test.ts`. It verifies ten unique
asset/depreciation/year-close identities, monthly depreciation GL postings,
year-end retained-earnings postings, and 120 locked fiscal periods. It is not a
substitute for the browser + disposable-database gate above.

