# Finance Module deep audit — 2026-10-31

## Scope and evidence

Source review covered Finance navigation/pages, Finance API routes, invoice and
receipt lifecycle, voucher and ledger posting, year-end close, bank
reconciliation, AR/AP aging, and existing tests. This audit did not post to a
live database or execute an authenticated browser finance lifecycle. The Finance
test gate includes service-level tests and existing Project-Finance tests; its
passing count does not prove every Finance screen or posting integration.

## Fixed in this round

1. **Critical — year-end close could fail or misstate completion.** The route
   depended on a middleware-issued `x-user-id` header, accepted arbitrary year
   values, used legacy roles, and did not distinguish global from regional
   approvers. The service passed text `YEAREND-<year>` to a UUID journal reference,
   used reads and period locks outside its transaction, had no repeat-close
   guard, and created a pending journal while the UI claimed the year was
   closed. It now uses the authenticated API actor and `finance.approve`, accepts
   only completed years, checks for unapproved journals, posts net P&L with a
   unique idempotency key, and locks all periods in the posting transaction.
   The route requires global scope. The UI requires confirmation and displays
   balance/lock claims only after a successful close result.
2. **High — draft journals appeared in official reports.** Trial balance used
   `notIn: ['REVERSED', 'PENDING_APPROVAL']`, which also admitted `DRAFT`.
   Official account balances now include `POSTED` only.
3. **High — bank reconciliation could show false success.** The status page
   requested a hard-coded `default` bank-account ID and substituted zero,
   reconciled balances on API failure. It now loads active bank accounts,
   requires account selection, and displays explicit loading/error states.
   Summary status requires matching balances and no unmatched statement or GL
   lines, and reads only posted GL entries.
4. **High — contractor invoice scope.** The Finance invoice list queried all
   invoices for every finance reader. Scoped users now see only invoices linked
   to their assigned project OPMCs. Approval/rejection uses the authenticated
   actor and rejects a foreign project or an invoice without a project boundary
   for scoped users. Middleware strips client-supplied identity headers before
   setting its own; using API handler identity makes the actor contract explicit.
5. Added `pnpm run test:finance` to CI. Service tests cover the year-end posting
   boundary, posted-only reports, bank reconciliation status, and invoice scope.

## Open findings

1. **High — credit/debit notes still need a dedicated reversal/approval UI.**
   The route now validates the authenticated actor, amount precision, invoice
   scope, over-credit and settled-invoice rules; linked invoice totals and
   balances are adjusted together and the journal is posted atomically. The
   remaining gap is a separate note approval/reversal policy and browser flow.
   Treat direct API creation as a Finance approval action until that workflow is
   added.
2. **High — manual bank matching accepts arbitrary journal links.**
   `BankCashService.reconcileStatementLine` checks only existence before setting
   `isReconciled`: it does not verify bank account, posted GL status, direction,
   amount, or duplicate journal-line use. Add transaction locking and a unique
   relationship constraint before permitting production matching.
3. **High — bank accounts lack an OPMC association.** The current bank-account
   model is global. The reconciliation read/write route now requires global
   scope and the page uses the administrative capability. Regional Finance
   users cannot use this screen until bank-account ownership is modeled and
   enforced, or a distinct centrally managed Finance role is specified.
4. **High — Finance browser lifecycle is absent.** The configured production
   smoke suite covers health and optional login/profile; it does not test
   invoice approval, receipt settlement, payment voucher, bank reconciliation,
   or year-end close. Use a disposable QA database with role fixtures. Never
   execute a year-end close or financial mutation against production for QA.
5. **Medium — the AR aging page has a dead receipt handler.** It constructs a
   linked receipt without the bank reference required by the receipt service,
   and the handler is not attached to a rendered form. The page is a report,
   not a working collection screen. Project Finance has a separate receipt flow.
6. **Medium — two bank reconciliation products have different contracts.**
   `/finance/bank-reconciliation` matches uploaded CSV rows against recent GL
   data in memory; `/finance/bank/reconciliation` summarizes persisted bank
   statement links. The former searches only the past 90 days and does not
   persist matched bank statement lines. Label these distinctly or consolidate
   after defining the authoritative reconciliation workflow.
7. **Medium — many Finance pages/routes still use `ROLE_GROUPS`.** Canonical
   `finance.read/write/approve` guards and separate data scope remain uneven.
   Migrate by accounting domain with role-specific API and browser tests.

## Acceptance criteria still needed

Run tests against a disposable database with maker/checker identities and
foreign-OPMC records; verify journal and period rows after close, duplicate
requests, rejected/manual bank links, over-credit notes, and invoice approval
scope. Browser-test the corresponding screens and error states at desktop and
mobile sizes. A passing local suite or CI build alone is not financial sign-off.

## Validation in this audit

- `pnpm run test:finance`: 50 passed.
- `pnpm run test:types`: passed.
- Changed-file ESLint and `git diff --check`: passed.
- A production build passed before the final credit-note and reconciliation
  contract edits; rerun the build gate on the committed revision.
- No disposable Finance database or authenticated role fixture was available
  for an actual posting lifecycle. These checks remain local/source evidence.
