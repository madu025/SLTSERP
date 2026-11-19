# Plan: the SOD-to-invoice flow, as the business described it

Status: PLAN ONLY. No code has been changed for this. It needs the owner's approval before phase 1 starts.
Written 2026-11-19 from the owner's answers and from what the QA on real data (4 real contractors, 94 real SODs) showed.

## 1. The flow (agreed)

| # | Step | Who | Where | Level |
|---|---|---|---|---|
| 1 | The service order is completed | field / system | existing | SOD |
| 2 | Pass the completed orders (once or several times in the month, in bulk) | **Area Coordinator**, then **QC Officer** of the order's own area | new queue page | **SOD** |
| 3 | Month end: see all orders passed by both, in my area (any contractor, any RTOM) with the payment shown, and press **Invoiceable** | **Engineer** of the area | new screen | SOD -> invoice |
| 4 | One invoice per **contractor x RTOM x billing month** is created from those orders | system | - | **Invoice** |
| 5 | The contractor reviews the invoice in the portal and accepts it (or disputes it with a reason) | **Contractor** | existing portal | Invoice |
| 6 | Review inside the invoice, approve or reject | **Area Manager** of the area | invoice queue (exists) | Invoice |
| 7 | Audit (OSP Quality) verifies | OSP Quality | exists | Invoice |
| 8 | Finance sends, OSP managers approve, Head Office pays | exists | exists | Invoice |

Steps 7 and 8 do not change. The contractor accepts **after** the engineer creates the invoice (the owner's choice, and the safest one: the contractor sees the final amounts, and the Area Manager only reviews invoices the contractor already agreed to).

### Rules
1. An invoice belongs to one contractor, one RTOM (area) and one billing month.
2. The billing month is the month of the order's **completed date**, even if the order is approved late.
3. Exception: an order that was held back because of a problem is billed in the month in which it **is made invoiceable**.
4. An order is never "half in" an invoice: it is either passed to the engineer's list or not; once invoiced it is locked to that invoice.
5. Every order shows who passed it, who put it on which invoice, and the invoice's own approvals (a log on the order and on the invoice).
6. The same people are in the chain as before, only the level changed (orders for the area approvers, invoice for the contractor and the Area Manager).

### The late SOD rule (the owner's answer, replaces the earlier supplementary-invoice idea)
The engineer chooses the **billing month** on the invoicing screen. Orders completed in that month are normal. An order completed in an **earlier** month that is invoiced only now is a **late SOD**: it goes on the invoice of the month it is invoiced in and is shown there as **"Late SOD (completed in <month>)"**. A second run in the same billing month gives a second invoice number (`...-002`); an invoice the contractor has seen is never changed.

### Choices made where the owner said "ok" without a detail (please confirm)
- **Area Manager rejects.** The invoice goes back to the engineer with the reason. The engineer takes orders out (they return to the held-back list or to step 2) or corrects, and creates the invoice again; the contractor accepts again if the amount changed.
- **Contractor disputes.** Same as a rejection, back to the engineer.
- **An order taken out / held back** is recorded with a reason and stays visible to the engineer and the coordinator; it can be passed again later.

## 2. What exists today (what we keep, what we change)

Kept: the process gate engine (queue mode, per-area approvers, drag-and-drop order, "Test this gate", history), the contractor portal confirmation, the Area Manager queue, OSP Quality, Finance send, OSP managers, Head Office run, the removal of orders from an invoice, the order approval history table (`SodApproval`), the order financial validation (PAT, cost, materials).

Changes of meaning:
- Coordinator and QC approve **orders** (gate on the SERVICE_ORDER entity), no longer the invoice. This is the per-order chain that was built first (commits b3be83d9, c305d95e) and retired in 010644c7; its code is in git and is reused, now as a **bulk** queue.
- The INVOICE gate shrinks to **Contractor -> Area Manager** (still drag-reorderable by an administrator).
- "Verify Completed SODs" and "Generate Monthly Invoice" on the Invoicable page are replaced by the engineer's month-end screen.

## 3. The gaps to fill (found in the QA on real data)

| # | Gap | Why it matters | Fix |
|---|---|---|---|
| G1 | The invoice area is the contractor's home area; 189 of 193 contractors have none, and a contractor works in 1 to 4 areas | invoices of such contractors reach nobody, or the wrong area | the invoice carries its **own area** (`opmcId`) taken from its orders; the contractor's home area stops mattering |
| G2 | Only R-KX has Coordinator, QC and Area Manager; 40 other areas have none | orders and invoices wait for nobody | **data work**: appoint them (the gate screen already lists the areas without an approver, and "Test this gate" checks the result) |
| G3 | The Head Office payment of a project-less invoice follows the contractor's area (fixed on 2026-11-19) | wrong area for a contractor who works in several | follow the **invoice's own area** (G1) instead |
| G4 | 27 of 28 materials have no cost, so no real order passes the financial check | nothing can be invoiced | **data work**: enter the item costs (the verification now prices a cost-less line from the item) |
| G5 | 189 of 193 contractors are not KYC verified (no bank account, TIN, agreement) | Head Office refuses every payment request | **data work**: complete KYC |
| G6 | An order has no readable history of who passed it and on which invoice | the owner wants "who approved" visible on the order | a timeline panel on the order page and on the invoice (reads `SodApproval`, the invoice gate history and the audit log) |
| G7 | Nothing stops two invoices for the same contractor and month, and the month of an invoice is the day it was created in the contractor portal | duplicates, wrong month | a unique rule on contractor + area + month + sequence; the billing month is stored and shown |
| G8 | "Held back" has no state; an order that is taken out just returns to the verify list | the exception rule (billing month) cannot be applied | a held-back mark with reason and date on the order |
| G9 | Long operations were limited to 5 seconds | a batch of 40 orders failed | already fixed for verification and invoice creation; the new bulk steps use set-based writes and a 60 second limit |

## 4. Design

### Data
- `ServiceOrder`: use the existing `sodApprovalStage` (stage of the order chain), add `invoicingHeldAt`, `invoicingHoldReason`. History stays in `SodApproval`.
- `Invoice`: add `opmcId` (the invoice's area), keep `month`/`year`/`rtomArea`, add `sequence` (1, 2 for a supplementary invoice) with a unique rule on contractor + area + year + month + sequence.
- A migration changes the INVOICE gate to Contractor -> Area Manager and creates the SERVICE_ORDER gate (Area Coordinator -> QC Officer, shared queue by the order's area). There are no invoices in flight in production now, so the migration is safe; old invoices (LEGACY and the earlier chain) are left alone.

### Capabilities (database-backed, per the authorization rules)
New: pass orders as Coordinator, pass orders as QC, create invoices (Engineer). The existing contractor and Area Manager capabilities stay. Every list is also limited to the user's own areas on the server.

### Screens
1. **Order approvals** (Coordinator, QC): a queue of completed orders of my area, tick several or all, Approve or Return with a reason. Month filter and contractor filter.
2. **Invoicing** (Engineer): orders passed by both, grouped by billing month, then contractor and RTOM, with the payment per order and per group. Held-back orders are listed separately. One button, **Invoiceable / Create invoices**, with a preview of the groups. Orders with a problem can be held back with a reason.
3. **Invoice review** (Contractor): existing portal page, now with the full order list, accept or dispute.
4. **Area Manager queue**: existing, grouped by contractor and RTOM with totals; open an invoice, approve or reject.
5. **Order page**: a timeline (passed by, invoiced on, invoice approvals). **Invoice page**: a status timeline and its orders.

### Safety
- Creating invoices is one transaction (set-based writes, 60 second limit) with a row lock per order, an idempotency key per group, and a check that no order is already invoiced.
- Invoices are never changed after the contractor has seen them; additions go on a supplementary invoice.
- Every step writes the audit log and `SodApproval`; the ledger entry is written when the invoice is created, as today.
- A gate step that nobody can act on is shown on the gate screen and in the engineer's screen **before** the invoice is created ("no QC Officer in R-KL").
- Mail from test runs goes only to prasad@slts.lk.

## 5. Phases

| Phase | Content | Done when |
|---|---|---|
| 0 | Data: appoint Coordinator/QC/Area Manager and Engineers per area, item costs, KYC | the gate screen shows no area without an approver |
| 1 | Schema (invoice area, sequence, held-back), the two gates, capabilities, migration | tests for the rules and the migration pass |
| 2 | Order approvals queue (bulk, by area) | a coordinator and a QC officer pass a batch in the browser |
| 3 | Engineer screen and invoice creation by contractor x RTOM x month, supplementary invoices, held-back | invoices are created for the right groups and months |
| 4 | Contractor accepts, Area Manager review (reject returns to the engineer) | the loop works including rejection |
| 5 | Timelines on the order and the invoice, system guide, Head Office payment by invoice area (G3) | the owner can follow one order end to end |
| 6 | Full QA on real data in the browser (the same method as the 4-contractor run), then clean up the test data | zero defects open, test data removed |

## 6. What I need from the owner
1. Confirm the choices in section 1 (late order, rejection, dispute, held-back).
2. Who are the Coordinator, QC Officer, Area Manager and Engineer of each area (a list), or confirm that it is done in the admin screens.
3. The cost of each of the 27 materials, and the KYC details of the contractors, when payments should start.
4. A quiet time for the migration (phase 1 deploy).
