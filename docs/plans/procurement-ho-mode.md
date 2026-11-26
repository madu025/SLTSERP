# Procurement in HO mode: PO approved outside Nexus, GRN against one or more POs, values for OSP and stores

Owner decisions (26 Nov 2026):
- The PO is approved in the HO internal system and on paper. In Nexus the PO part ends with the Procurement Officer.
- The three-step Nexus chain (OSP Manager, Head of OSP, Finance Manager) is switched off by an admin setting, not deleted.
- The Procurement Officer records the PO with the HO approval reference number and a scan of the approved document (both required).
- One GRN (one delivery) may receive goods of several POs.
- Finance (supplier invoice approval and payment) is also in the HO system. OSP and stores still need to know quantities and money:
  the PO carries the quantities and prices, so that is the source of the values in Nexus.

## Phase A: record an HO-approved PO (Procurement Officer)

- Admin setting `PROCUREMENT_PO_APPROVAL_MODE` = `HO_DOCUMENTS` (default) | `NEXUS_CHAIN` (the current three steps).
- In HO mode the PO form asks, in addition to vendor, lines, quantities, prices and tax:
  HO approval reference number, HO approval date, approved by (name and designation), and the scanned PO/approval document (PDF or image, required).
- Saving makes the PO APPROVED at once; the approval log gets one entry "Recorded with HO approval <ref>" (the hash chain stays).
- The approve/return buttons and the step capabilities are not used in HO mode. A PO with no document cannot be saved.
- The PO history page shows the HO reference and opens the scanned document.

## Phase B: GRN against one or more POs (Stores)

- A GRN line links to a PO line (`GRNItem.purchaseOrderItemId`); the GRN header PO stays for older receipts.
- The GRN screen: choose the vendor, see the open lines of all that vendor's approved POs, enter received quantities per line.
- Over-receipt is checked per PO line; each PO moves to PARTIALLY_RECEIVED / RECEIVED on its own.
- Stock enters at the PO price (weighted average cost), with the GRN number and the immutable inventory ledger entry, as today.

## Phase C: money visible in Nexus without a finance step

- The supplier invoice approval and the CEO threshold step are not used in HO mode (kept for `NEXUS_CHAIN` mode).
- Nexus shows, from the PO prices: ordered value, received value (GRN quantity x PO price), still to receive (commitment), and stock value.
- Optional information fields on the PO for OSP to follow payment: HO invoice number, HO payment reference and paid date (no approval).

## Database (one migration, needs the owner's yes)

- `PurchaseOrder`: `hoApprovalRef`, `hoApprovalDate`, `hoApprovedBy`, `hoDocumentUrl`, `hoInvoiceRef`, `hoPaymentRef`, `hoPaidAt` (all nullable).
- `GRNItem`: `purchaseOrderItemId` (nullable, indexed).

## Open point

- Accounting in Nexus: a GRN today posts stock against goods received not invoiced (GR/IR). With the invoice in HO, that balance is never cleared in Nexus.
  Proposal: in HO mode the GRN still values stock, and the GR/IR balance is cleared when the HO payment reference is recorded on the PO.

## Tests

- Unit tests for the mode switch, required HO evidence, multi-PO GRN and over-receipt per line.
- Browser pass by the real roles on ZZTEST data: Procurement Officer records two POs with documents, the Stores Executive receives both on one GRN,
  stock and values are checked, the PO history page shows the document.

---

# Phase D (built 26 Nov 2026): credit purchases through HO, due dates, part payments, payable balance

Owner decisions (26 Nov 2026): the Procurement Officer enters the credit terms and due date on the PO (HO Finance entering it would break the chain);
HO pays at once or in several parts (HO Finance decides); who records the HO payment is to be decided from this plan.

## What already exists (reuse, do not duplicate)

| Piece | Today | Limit for HO-mode orders |
|---|---|---|
| Vendor payment terms | `Vendor.paymentTerms` text ("Net 30"), `dueDateFrom()` in `procurement-rules.ts` | Used only for a Nexus supplier invoice |
| Supplier invoice due date | `SupplierInvoice.dueDate` | HO-mode orders have no Nexus invoice |
| Vendor statement `/finance/vendor-statement` | Invoices, paid vouchers, debit notes, running balance, overdue | Does not see HO-mode orders or HO payments |
| AP aging `/finance/ap/aging` | Buckets by invoice date, reconciles to GL AP-2010 / AP-VEND-2010 | Ages by invoice date, not due date; no HO-mode orders |
| HO payment of a voucher | `PaymentVoucher` -> HO batch -> HO confirms PAID with reference | Needs a Nexus supplier invoice; one payment per voucher |
| Planned part payments | `docs/plans/ho-payment-flow.md` section 3.3 `HoPaymentInstallment` (not built) | Planned for vouchers only |
| Built today | PO HO fields, one "Record HO payment" per PO, clears GR/IR to HO-2020 | One payment only, no due date, no verification |

## Design

D1. Credit terms on the PO (Procurement Officer, required in HO mode): payment basis (CREDIT / ADVANCE / ON_DELIVERY), credit days, due date
    (filled from goods-received date + credit days, or typed from the HO document), HO credit reference.
D2. One payments table for both kinds of payable: build the planned `HoPaymentInstallment` once, linked to a purchase order (HO mode) or a voucher (later).
    Each row: amount, paid date, reference (cheque / transfer), method, recorded by, verified by, status (RECORDED -> VERIFIED, or REJECTED with remarks).
    The sum of verified rows can never exceed what is payable on the order. Replaces today's single "Record HO payment".
D3. Who records: an OSP Finance Officer seated at HO (a designation, capability `procurement.ho.payment.record`) records each payment as HO makes it;
    the OSP Finance Manager verifies it (`procurement.ho.payment.verify`, a different person). Only a verified payment posts to the ledger.
D4. Ledger, per verified payment: up to the received value not yet cleared, DR GR/IR AP-2010 / CR HO current HO-2020; any part paid before the goods arrive
    is an advance, DR Advances ADV-1210 / CR HO-2020, moved to GR/IR when the goods are received. The OSP account then balances against HO-2020.
D5. Reports, extended not duplicated: the vendor statement and AP aging also show HO-mode orders (received, paid, balance, due date, overdue days) and age by
    due date; the PO history page shows the payment schedule and balance.
D6. Reminders through the existing automated notices: payments due in 7 days and overdue go to OSP Finance (email template wired as the mandate requires).
D7. Migration: PO credit fields; the installments table. RBAC seed: the two capabilities and the HO-desk designation.
D8. Tests: unit rules (payable cap, advance then receipt, maker-checker), and a browser pass: PO with 60 credit days -> GRN -> two part payments recorded at HO
    -> verified -> statement, aging, ledger and OSP balance agree.

---

# Section E (built 26 Nov 2026): the company flow from the owner's diagram

Replaces Phase D's payments on the PO. Relations: material request 1 -> n PO (one per vendor, total within the approved quantity); PO 1 -> n GRN; GRN 1 -> 1 vendor invoice -> 1 payment voucher.

| Step | Who (position -> role / designation) | Screen |
|---|---|---|
| Material request | Stores Officer (Stores Executive / Assistant) | Material Requisitions |
| Review 1, 2, 3 | Stores Manager, OSP Manager, Head of Section | Approvals (request gate, Admin can change levels) |
| Record the HO procurement | Procurement Officer | Order Processing: PO with HO reference, scan, credit terms |
| Accept / reject the delivery, Oracle GRN number, vendor invoice | Stores Manager | GRN |
| Payment voucher from the GRN invoice | OSP Account Officer (designation on Finance Assistant) | Payment requests to Head Office |
| Accept the voucher (approves the invoice) | OSP Account Manager (designation on Finance Manager) | same |
| Send to HO Invoice Section | OSP Account Manager / Officer | same (packs) |
| Record HO's full or part payments | Account Executive at HO (designation, only holder of procurement.ho.payment.record) | same: Record HO payment |

Ledger: GRN accept INV-1010 DR / GR/IR AP-2010 CR; voucher acceptance GR/IR DR (+ input VAT) / Vendor payable AP-VEND-2010 CR; each HO payment Vendor payable DR / HO current HO-2020 CR.

## Section F (26 Nov 2026): the polished diagram

After the OSP Account Officer raises the voucher: OSP Account Manager -> OSP Manager -> Head of Section (invoice posted at the last approval) -> Procurement Officer marks the documents received (sent to HO) or not received (back to the Account Officer with remarks) -> HO OSP Account Executive records full or part payments with the reference. Rejections go back to the Account Officer with remarks.

After the Head of Section approves, the OSP Account sends the documents to the Procurement Officer and confirms it with "Documents sent"; only then can Procurement mark them received (to HO) or not received (back to the OSP Account). Each step notifies the next one in-app by its notification audience.
