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
