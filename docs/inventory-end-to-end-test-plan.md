# Inventory, procurement and contractor material: end to end test plan

Written 25 Nov 2026. Scope: receive 10 materials into the main store through procurement, pass the approval gates (including OSP Finance),
send stock to the sub stores, issue to registered contractors, use it on a sample service order (SOD), and prove that every balance agrees.
Nothing here needs production data: everything runs on `ZZTEST-` stores, items, vendor, contractor and users, which are retired at the end.

## 0. What already exists (reuse, do not rewrite)

| Asset | What it covers |
|---|---|
| `scripts/zz-p2p-flow.ts` | stock request, purchase order, approval, GRN (part, over-receipt refused, rest), supplier invoice and 3-way match, same person cannot approve, approval posting (GR/IR, input VAT, payable), return to supplier (MRN), debit note |
| `scripts/zz-inv-lifecycle.ts` | GRN, sub store request to main store, executive review, manager approval, release, receive, contractor issue, contractor return, MRN, wastage, stock take, ledger integrity |
| `scripts/zz-inv-gui*.ts`, `zz-inv-par*.ts`, `zz-inv-qa.ts` | browser pass, parallel users, QA setup and teardown |
| `tests/unit/procure-to-pay.test.ts`, `procurement.test.ts`, `inventory-*.test.ts`, `project-stock-return.test.ts` | rules in code: write validation, dashboard metrics, numeric guards, batch fixes |
| `docs/inventory-deep-gap-audit-2026-11-02.md` | the authoritative balance rules (on hand, allocated, available, reorder) |
| `docs/sod-material-reporting.md` | manual material entry is the truth for stock; SLT reported material is reference only |

**Gaps in that coverage (this plan adds them):** OSP Finance as a named gate in the chain; ten items in one run with unit conversions and
decimals; sub store to contractor to SOD in one continuous run with a balance proof after every step; contractor scope isolation;
concurrency; the SQL functions behind the dashboards; and a browser run of the whole chain by the real roles.

## 1. Before anything: facts the plan depends on (verify, do not assume)

1. **Dump the active process gates** (Admin > Process Gates, or `scripts/zz-gate-show.ts`): list, in order, every gate of the material
   request and of the purchase order (stage, level, who may approve). The plan below uses placeholders `GATE-1..n`. Confirm that the
   OSP Finance step exists as a gate and is positioned after procurement. If it does not, that is the first finding, not a test to skip.
2. Dump the roles that hold the capabilities: stock request create, ARM/stores manager approve, procurement, PO approve, GRN, finance
   approve, inventory write, contractor issue. One ZZTEST user per role (created through the user service, never by hand).
3. Money rules: PO approval limits (`approval-limit.service.ts`), VAT, unit conversion of each of the 10 items.
4. Which database: the disposable QA database if one exists; otherwise production with `ZZTEST-` data only (the ledger is immutable, so
   test rows stay; the teardown renames stores and items and locks users).

## 2. Fixtures

- 1 main store, 3 sub stores (A, B, C) in two OPMC areas (so area scope can be tested), all `ZZTEST-`.
- 10 inventory items covering: integer unit, decimal unit (cable in metres), a unit with conversion, a serialised or batch item (if the
  system has them), an item with a minimum level and one without, a high value item (approval limit), a low value item.
- 1 vendor with a price list; 3 contractors: C1 and C2 registered to sub store A, C3 registered to sub store B; 1 unregistered contractor.
- Users: store keeper (main), store keeper (sub A), executive, ARM, stores manager, procurement officer, PO approver, OSP Finance, a second
  approver (for the same-person rule), a contractor login (C1), an area user with NO access to store B.
- A sample SOD assigned to C1 in sub store A's area, with the materials the SOD will consume.

## 3. The chain, with the check after every step

Balance proof after EVERY step (the "balance check"): for each of the 10 items and each store,
`on hand = opening + sum(ledger movements)`, `available = on hand - allocated`, the sum over all stores and contractors equals what was
received minus what was consumed or wasted, and the latest `InventoryLedger` checksum chain verifies (SHA-256 of
`id + storeId + itemId + quantityAfter + createdAt`).

### A. Request and procurement
| # | Step | Expected |
|---|---|---|
| A1 | Main store raises a material request for the 10 items (quantities include decimals) | request created with an MRN reference, status PENDING, nothing reserved yet |
| A2 | Each configured gate approves in order, by the right role | the stage moves exactly one gate at a time; a user without the gate role is refused; a user from another area is refused |
| A3 | Procurement creates a PO per vendor from the approved request | PO references the request; totals, VAT and per-line quantity match the request; a PO above the approval limit goes to `PENDING_APPROVAL` |
| A4 | PO approver approves (and the maker cannot approve their own PO) | status APPROVED / sent; the same person is refused |
| A5 | **OSP Finance gate**: finance reviews the procurement | request/PO is visible in the OSP Finance queue ONLY after procurement passed; before that it is not; finance can approve and reject with a reason; rejection returns it with the reason |
| A6 | Procurement status moves PO_CREATED, PO_SENT, PO_CONFIRMED, COMPLETED | on COMPLETED the request becomes GRN pending and is shown as "awaiting GRN", not as a recorded receipt |

### B. Receiving into the main store (the 10 materials)
| # | Step | Expected |
|---|---|---|
| B1 | Part receipt: GRN for part of each line | on hand rises by exactly the received quantity; ledger entry per item; GRN number shown; PO line shows received vs ordered |
| B2 | Over receipt is refused | error, no stock change |
| B3 | Remaining receipt | PO closes; request COMPLETED |
| B4 | Receipt with a damaged or short item | recorded as a variance with a reason; stock only for the accepted quantity |
| B5 | Duplicate click and two users receiving the same line at once | one GRN only; no double stock (concurrency) |
| B6 | Supplier invoice and 3-way match (PO, GRN, invoice) | match passes; a price or quantity difference is flagged; posting clears GR/IR, input VAT, payable |

### C. Main store to sub stores
| # | Step | Expected |
|---|---|---|
| C1 | Each sub store raises a request to the main store | MRN number shown; the request goes through its gates |
| C2 | Main store releases (reserve, then dispatch) | `allocated` rises on reserve, `on hand` falls on dispatch; MIN number shown; available never negative; releasing more than available is refused |
| C3 | Sub store receives | sub store on hand rises; main falls by the same; in-transit is zero when done; a part receipt keeps the rest in transit |
| C4 | Reject and recall paths | reserved stock is returned; ledger shows the reversal, not a deletion |

### D. Sub store to registered contractors
| # | Step | Expected |
|---|---|---|
| D1 | Issue to C1 (registered to sub store A) | issue note number shown (also in the contractor app); `ContractorStock` rises; sub store A falls; ledger entry with checksum |
| D2 | Issue to C3 from sub store A (C3 is registered to store B), and to the unregistered contractor | refused (registration is the rule) |
| D3 | Issue more than the store holds, zero, negative, decimal on an integer item | refused with a clear message |
| D4 | Contractor accepts or rejects the issue in the app | `PENDING_ACCEPTANCE` to ACCEPTED/REJECTED; a rejection returns stock to the store |
| D5 | Contractor sees only their own stock and issues; C2 cannot see C1 | scope holds in the API, not only in the screen |

### E. Use on the sample SOD, and balances
| # | Step | Expected |
|---|---|---|
| E1 | C1 enters material used (USED, F1, G1) and wastage on the sample SOD | `ContractorStock` falls by used + wastage; consumption posted to the ledger; wastage shown beside the line and not counted as used |
| E2 | Use more than C1 holds | refused |
| E3 | Edit or remove a used line | stock is corrected by a reversing entry, never silently |
| E4 | SLT reported material differs | stored as reference only; deviation report shows QTY_MISMATCH / NOT_ENTERED / NOT_REPORTED / UNMAPPED; stock does not move |
| E5 | Return unused material from C1 to sub store A | contractor falls, store rises, return note number shown |
| E6 | Final reconciliation of all 10 items | received = in main + in sub stores + with contractors + consumed + wasted + returned to supplier; difference is exactly zero |

### F. Inventory functions and reports (the part most often forgotten)
Compare the screens with the database, for the same 10 items: Store dashboard (on hand, allocated, available, minimum, reorder), executive
dashboard, Project Logistics, material balance report, SOD material summary, valuation, low stock alert, ABC and reorder point, cycle count
and stock take (variance posts an adjustment with the adjust capability), wastage report, material audit report. Each number must equal
the ledger sum. The SQL functions (`fn_bulk_stock_initialize`, low stock, material balance, dashboard summary, valuation) must agree with the
service rules, including the case `allocated > on hand`, which must surface as an exception, not as a healthy store.

### G. Access, scope and audit (every step above, from the other side)
- Each action is refused for a user without the capability, and for a user with the capability but without the area or store.
- The user menu shows only what the role may use; the first page after sign-in is the right one (`landingPath`).
- Every approval, issue, receipt and adjustment has an audit row with actor, time, before and after; MIN/MRN/GRN numbers are visible on
  the store screens and in the contractor app.
- Notifications: the next approver is told; the contractor is told of an issue; no one outside the rule receives it.
- Immutability: an update or delete of a ledger row is refused.

## 4. Things easy to forget (check each one)

1. Unit conversion and decimals (metres, rounding to the unit's precision); quantities typed with a comma or as text.
2. Cancelling a PO after part receipt; a PO with two vendors; a closed PO receiving again.
3. A request edited after approval (it must restart the gates or be refused).
4. Back dated receipt and issue; dates in the future; month end and the period lock in finance.
5. The same item in two stores with different minimum levels; a store with minimum 0.
6. Contractor deactivated or de-registered while holding stock (what happens to the balance and to further issues).
7. A sub store closed or merged while stock is in transit.
8. Refresh, double submit, browser back, and a session that ends in the middle of an approval (the new 30 minute idle rule).
9. Mobile screens for the contractor app (issue note number, accept, reject, material entry).
10. Reports exported to Excel: the same numbers as the screen.
11. Performance with realistic volume (the real catalogue has thousands of items): the dashboards still answer in seconds.
12. Rollback of a failed step: a failure in the middle of a dispatch leaves no half movement (transactions).
13. Emails and notifications use the database templates and never the contractor's data of another contractor.
14. Cleanup: stores renamed and made SUB, items renamed, users and contractor locked, vendor renamed; nothing `ZZTEST` left active or counted in a dashboard.

## 5. How to run it (cheap on tokens, real in coverage)

1. **Rules and numbers** (no browser): extend `zz-p2p-flow.ts` and `zz-inv-lifecycle.ts` into one run with 10 items and the balance check after
   every step (sections A to E, F by SQL, G by calls with the wrong user). Output is PASS/FAIL lines only.
2. **Unit tests** for any rule found wrong, added to `test:unit`.
3. **Browser, by the real roles, once:** the chain A to E through the screens (a Playwright script so it can be repeated at no cost), because
   screen gaps (a missing button, a hidden menu, a modal that blocks) are invisible to the API run. Screenshots only on failure.
4. **Evidence** for each step: command output, the ledger rows, the screen, the role used. A step passes only with persisted read-back.
5. **Pass criteria:** all steps pass; the final reconciliation difference is zero for all 10 items; no cross-scope read or write; the ledger
   checksum chain verifies; cleanup leaves nothing active.

## 6. Result of the first run (25 Nov 2026, production, `ZZTEST-` data)

Owner's answers: OSP Finance is the supplier invoice approval; ten materials; production with `ZZTEST-` data is allowed.

| Section | Script | Result |
|---|---|---|
| A-B procurement, PO, GRN, supplier invoice 3-way match, approval and posting, return, debit note | `zz-p2p-flow` | 31 of 31 pass |
| Roles, sub store request, review, approval, release, receive, contractor issue and return, MRN, wastage, stock take, ledger | `zz-inv-lifecycle` | 42 of 42 pass (after the transaction time fix) |
| Ten materials, GRN, transfer, issue, sample SOD usage, edit, return, reconciliation, ledger | `zz-inv-chain10` | 27 of 27 pass (after the quantity fix) |

Defects found and fixed: zero or negative quantity accepted by contractor issue, returns and material requests; the 5 second transaction limit.

Second run (`zz-inv-phase2`): concurrency of receipts, issues, double receipt and double release held; two orders using the same contractor stock at the same moment both succeeded and left a negative quantity (fixed by a row lock in `fn_fifo_pick_contractor_batches`, migration `20261221000000`); a request could be raised in the name of another sub store (fixed); the store dashboard valued stock at the selling price while the material balance used cost (fixed, one rule: cost). Area scope between two sub stores, the SQL report functions against their tables (balance, low stock, store summary, stock card, contractor summary, ledger) all agree. One check (the same request released by two people at the same moment) passed once and was inconclusive twice because of database connection errors of the test tunnel; stock was never taken twice.

Third run, the browser pass by the real roles (`pnpm run test:inventory:browser`): manager approve, executive release with the MIN reference, officer receive, the contractor app (issue note, dual custody sign-off, stock) all pass; it found the requests page crash, the wrong unit and the invisible Cancel buttons (see the change log).

Not yet run: the browser pass for the procurement part (purchase order, supplier invoice), the project and the SOD material screens of the contractor app, and a repeat of the concurrency check on a fast connection.

## 7. Open questions for the owner (answer before the next run)

1. (Answered) OSP Finance is the supplier invoice approval. 2. (Answered) ten materials. 3. (Answered) production with `ZZTEST-` data.
4. Should contractors be allowed to receive from a sub store they are not registered to in an emergency (petty purchase fast track)?
