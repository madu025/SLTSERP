# Plan: OSP payment approval chain and the Head Office payment flow

Status: PROPOSAL, not built. Written 2026-11-24 after reading the current code. Needs the owner's answers to the questions at the end.

## 1. What the owner wants

1. Any payment OSP has to make (project advance, contractor invoice, vendor, rent, vehicle, other) goes through one approval chain in the OSP Account: **OSP Account Finance Manager -> OSP Manager -> Head of Section**.
2. Only then is it handed to Head Office (HO).
3. At HO, the request waits in the **HO Finance Manager's** proceed list. It passes through **HO statuses** (pending, signature pending, ...). The status list is **kept in the database and edited by the Admin**, never hard coded.
4. A **HO Finance Officer** records the payment with its reference. The payment is a success only when the last status is reached.
5. A payment may be made in parts (for example 80 % now, 20 % later). The OSP Account must show what was paid and the balance still to pay. When the payment is complete, the follow-up work can start.

## 2. What already exists (so we extend it, not rebuild it)

| Piece | Today |
|---|---|
| Payment voucher | `PaymentVoucher`, statuses `DRAFT, PENDING_APPROVAL, APPROVED, SUBMITTED_TO_HO, PAID, REJECTED, CANCELLED`. One approval step (`finance.approve`: Finance Manager, CEO, and by mistake the Stores Manager). |
| Hand-over to HO | `HoPaymentBatch` (a numbered pack), `ho-batch.service.ts`, `ho-run.service.ts`, pages under `/finance/ho-*`. Voucher fields `submittedToHoAt/By`, `hoBatchId`, `hoReference`, `hoPaidDate`. |
| HO confirmation | Moves `SUBMITTED_TO_HO -> PAID` with reference and date (`finance.ho.confirm`, held by the Finance Manager only). It is all or nothing: no part payments on one voucher. |
| Payment kinds | `payment-categories.ts` (six kinds, `allowPartial` is true for all, but a part payment today means a second voucher). |
| Approval engine | Process gates (`ProcessGatePolicy`, queue mode, Admin can reorder steps) already used for invoices and stock requests. |
| OSP Accounts (IOU, advance, rent, fuel, hiring) | One step, `finance.approve`, no maker/checker check, no approval limit. |

## 3. Design

### 3.1 Approval chain in the OSP Account (database, Admin editable)
- Add a process gate for `PAYMENT_VOUCHER` (`PENDING_APPROVAL -> APPROVED`) with three levels: Finance Manager, OSP Manager, Head of Section. Seeded; the Admin changes steps on the existing Process Gate screen.
- The same person cannot approve two steps (existing `planApproval` rule), the creator cannot approve (existing rule), approval limits apply (existing `ApprovalLimitService`).
- OSP Accounts items (IOU, advance, rent, fuel deposit, hiring payment) stop approving themselves: each becomes a voucher that goes through the same gate, or uses the same gate directly. No self approval.

### 3.2 HO status list in the database
New table `HoPaymentStage` (the Admin edits it on a settings page):
`code, label, sortOrder, kind (OPEN | FINAL_PAID | RETURNED), whoMayUpdate (capability), requiresReference (bool), requiresSignature (bool), isActive, color`.
- Seeded with: Received -> Pending (HO Finance Manager) -> Signature Pending -> Paid. The Admin can add, rename, reorder, switch off.
- Exactly one stage is `FINAL_PAID` and at least one is `RETURNED`; the screen refuses to save a list without them.
- A voucher keeps `hoStageCode`. A stage may only move forward to the next active stage, or to a RETURNED stage. Nothing in the code names a stage except the two kinds.
- Stages in use cannot be deleted, only switched off.

### 3.3 Payment records (part payments)
New table `HoPaymentInstallment`: `voucherId, amount, paidDate, reference (cheque or transfer number), method, recordedById, recordedAt`.
- Recommendation: **reference, date and amount** are all required. A reference alone cannot tell 80 % from 20 %.
- Paid so far = sum of installments. When the sum equals the net amount the voucher reaches the FINAL_PAID stage. In between the voucher is `PARTIALLY_PAID` and the balance is shown everywhere.
- An installment can never take the sum above the net amount; recorded rows are never edited (a wrong one is reversed by a correcting row, audited).

### 3.4 People and capabilities (DB, `src/config/rbac-permissions.ts`)
- New role **HO Finance Officer** (records payments and moves a voucher through the stages the stage row allows) and a clear **HO Finance Manager** (owns the proceed list, signs off). Both are Head Office staff: they see only vouchers submitted to HO, never the OSP data scope.
- New capabilities: `finance.ho.pay` (record an installment), `finance.ho.proceed` (HO Finance Manager). `finance.ho.confirm` stays for the OSP side confirming receipt if the owner wants it, otherwise it is retired.
- Segregation: the HO payer cannot be the person who submitted from OSP; the OSP creator or approver cannot record the HO payment.
- Remove `finance.approve` and `project.finance.approve` from the Stores Manager (a mistake found in this review).
- The Cashier gets the capability to record the OSP-side "handed over / paid" if the owner confirms that is their job (open question 4).

### 3.5 What OSP sees
- On the voucher, the pack and the OSP Account: the live HO stage, installments with references, paid amount and **balance**.
- Balance feeds the payable (supplier invoice paid amount, contractor invoice, advance) exactly as the existing paid path does, now per installment instead of once.
- Notifications on every stage change (templates registered in `notification-templates.ts` with defaults seeded, as the project mandate requires).

### 3.6 Follow-up work after a complete payment
When the last installment closes the voucher (FINAL_PAID) an event is raised. What starts is configurable (table of "on paid" actions per payment kind, Admin editable). Candidates: invoice marked paid, retention release timer, project closeout task for the Invoice Manager, vendor statement refresh, a notification to the requester. The owner decides the list (open question 5).

## 4. Phases (each can be tested and deployed alone)

1. **Schema and Admin**: `HoPaymentStage`, `HoPaymentInstallment`, seed, Admin stage page, migration of existing vouchers (`SUBMITTED_TO_HO` -> first stage, `PAID` untouched).
2. **Approval chain**: `PAYMENT_VOUCHER` gate with three levels; OSP Accounts items brought under it; Stores Manager grant removed.
3. **HO roles and payment recording**: new role and capabilities, HO proceed list, installment recording, stage moves.
4. **OSP visibility**: balance, installments and stage on the voucher, pack and OSP Account pages; notifications.
5. **Completion follow-ups**: the configurable "on paid" actions.
6. **Hardening**: system guide for Finance (`src/content/guides`), RBAC document, unit tests for the pure rules (stage order, installment sum, segregation), a service-level lifecycle test with real roles, GUI test, `pnpm run rbac:check`, type, unit and build checks.

## 5. Risks

- Vouchers already in flight when it goes live: handled by the migration in phase 1; the chain applies only to vouchers created after the gate is switched on (the existing in-flight ones keep their single approval).
- Changing the stage list while vouchers sit in a stage that is switched off: the screen blocks it.
- Gate and capability changes on production need the owner's approval at deploy time.

## 6. Owner's answers (2026-11-24)

1. Stage list Received -> Pending -> Signature Pending -> Paid is accepted as the seed (Admin edits it later).
2. If Head Office cannot pay (no money, wrong reference) the voucher **stays at Head Office as Pending**; it is a Head Office problem. OSP sees it as "Pending at Head Office" (the OSP side only reads the HO stage). No return to OSP is needed for this case.
3. Part payments: reference, date and amount per installment (more fields can be added if needed).
4. IOU, petty cash and similar duties: add job roles where a duty has no owner. The owner accepts new roles when needed.
5. Follow-up on a complete payment: **notify**. A contractor payment emails the contractor; a project payment tells the Project Manager with the details. (More actions may follow.)
6. No OSP-side confirmation of receipt is needed. The HO Finance Officer's record is final.
7. The business gaps found in the review are fixed **before** the implementation starts (phase 0).

## 7. Phase 0 - business gaps to fix first

| # | Gap | Fix |
|---|---|---|
| 0.1 | OSP Accounts items (IOU, advance, rent, fuel, hiring) can be approved by whoever created them | DONE (maker recorded, maker cannot approve, approver recorded; migration 20261216000000). Approval limit and the payment chain come with phase 2 |
| 0.2 | The Cashier cannot do any cash step (everything with "status/approve" in the path needs `finance.approve`) | Give the Cashier a narrow capability (record the cash handed over for IOU / petty cash), not approval |
| 0.3 | Nobody owns the IOU and petty cash float | Cashier holds the IOU / petty cash duty; the Finance Assistant prepares; the Finance Manager approves |
| 0.4 | Finance Manager is the single point of approval; no deputy | A deputy (Finance Executive) role, as for the Stores Executive, if the owner wants it |
| 0.5 | Stores Manager holds `finance.approve` | DECIDED by the owner (2026-11-24): keep as is |
| 0.6 | Read-only finance roles see every Finance menu item | Menu is shown by what the person can do (read-only roles get reports only) |
| 0.7 | Invoice Manager (follow-up and closeout) has no finance write | Decide what the Invoice Manager must record, then grant exactly that |

## 8. Notes found while reading the code (affects the design)

- Part payments today are separate vouchers (`allowPartial`); `PAID` is all or nothing and posts the whole amount to the ledger and to the supplier / project invoice. Installments must post to the ledger and the invoice **per installment**; this is the most sensitive change and needs a database for the lifecycle test.
- An OSP invoice chain already exists for contractor invoices (`Invoice.approvalFlow = OSP_CHAIN`, dispatch to the OSP managers, then the Head Office run). The new payment gate must sit after it and must not duplicate it.
- The database used for testing is reached through a local tunnel (port 55433) that is not running now, so the service-level and GUI tests of phases 1 to 5 wait for it.
