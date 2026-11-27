---
name: sl-inventory-compliance-audit
description: Audit SLTSERP (SLTS Nexus) inventory, purchase and stock-ledger data against Sri Lankan LKAS 2 (inventories), ISO 9001 (quality, traceability) and ISO 27001 (access, logs). Use when asked for an inventory compliance audit, an LKAS 2 / ISO 9001 / ISO 27001 check of stores, stock valuation or NRV review, slow-moving or obsolete stock, count variance, supplier compliance, or PO/GRN segregation of duties.
---

# Sri Lanka inventory compliance audit (SLTSERP)

Read only. The audit never changes data; any correction it suggests is a separate, approved change.

## How to run

1. The database tunnel must be up (see `docs/ai-handover.md`). The script reads the database in one `SET TRANSACTION READ ONLY` transaction.
2. Run, with the report folder in the scratchpad:
   ```
   pnpm exec tsx scripts/inventory-compliance-audit.ts <scratchpad>/inv-audit
   ```
   It prints the report in Markdown and writes `inventory-compliance-<day>.md` and `.json` (the JSON has the samples for each finding).
3. Before you report, open the JSON samples of every NCR and observation. Name ZZTEST / ZZG6 test data as test data, not as a business finding.
4. Report to the owner in simple Sinhala (code and the report file stay in English), using the output format below. Ask before any correction:
   changing production data needs the owner's explicit "yes".

## What is checked, and where it lives in Nexus

### 1. Financial and valuation (LKAS 2)

| Id | Check | Data |
|---|---|---|
| L1 | Costing method: store stock equals the sum of its FIFO batches (Nexus values by FIFO batches; weighted average is not used) | `InventoryStock` vs `InventoryBatchStock` |
| L2 | Every batch in stock carries a cost price (opening stock carries the cost given on its load) | `InventoryBatch.costPrice` |
| L3 | NRV review: no movement for more than 90 days (observation for finance, not an automatic write-down) | last `InventoryLedger` row per store/item |
| L4 | Damaged returns received in the last 12 months, to value at NRV or write off | ledger `DAMAGED_RETURN_RECEIVED` |
| L5 | Tax recorded once: GRN vendor-invoice tax equals the supplier invoice tax, and no invoice above VAT 18% + SSCL 2.5% | `GRN.vendorInvoiceTax`, `SupplierInvoice.taxAmount` |
| L6 | Import duties in landed cost: **not tracked** (Nexus records local purchases only) | - |

### 2. Operational and quality (ISO 9001)

| Id | Check | Data |
|---|---|---|
| Q1 | Traceability in: every GRN line has a numbered batch | `GRNItem.batchId`, `InventoryBatch.batchNumber` |
| Q2 | Traceability out: every issue has its Issue Note number (MIN, AGENTS.md rule) | `StockIssue.issueNumber`, `ContractorMaterialIssue.issueNumber` |
| Q3 | No expired batch still in stock (expiry is optional; most OSP material has none) | `InventoryBatch.expiryDate` |
| Q4 | Physical count vs system: a counted line more than 1% from the system quantity is an NCR | `CycleCountLine.systemQty` / `countedQty` |
| Q5 | Supplier compliance: open POs only with ACTIVE vendors | `PurchaseOrder.vendorId`, `Vendor.status` |

### 3. Data security and access (ISO 27001)

| Id | Check | Data |
|---|---|---|
| S1 | Stock adjustments posted outside 07:00-19:00 Colombo or on Sunday (observation: confirm each was authorised) | ledger `WASTAGE_ADJUSTMENT`, `CYCLE_COUNT_CORRECTION`, `VIRTUAL_SWAP` |
| S2 | Every adjustment approved by a second person | `CycleCountHeader.countedById/approvedById`, `MaterialVarianceAdjustment`, count corrections without an approved count, `OpeningStockLoad` approved by its submitter |
| S3 | No GRN received by the person who recorded its PO (the server refuses this since 27 Nov 2026) | `GRN.receivedById` vs `PurchaseOrder.createdById` |
| S4 | Role segregation: active non-admin users holding both `procurement.write` (record a PO) and `inventory.grn` (receive) | `getUserEffectivePermissions` (role, designations and overrides, as the app decides) |
| S5 | The stock ledger's SHA-256 checksum chain is unbroken (a break is a security incident) | `fn_verify_ledger_integrity()` |

S4 is an observation, not an NCR, because S3 already blocks the conflict per transaction. Administrators (`admin.rbac`) are left to the access review.

## Thresholds

Constants at the top of `scripts/inventory-compliance-audit.ts`: 90 days without movement, 1% count variance, VAT 18%, SSCL 2.5%,
working window 07:00-19:00 Colombo. Change one only with the owner's agreement and say so in the report.

## Output format

1. **Executive summary**: compliance score (%) for LKAS 2, ISO 9001, ISO 27001 and overall. Score = checks without an NCR / checks with
   evidence. Observations count as passed. Not-tracked checks are left out and listed, so a missing control is never shown as a pass.
2. **Non-conformity report (NCR)**: one row per NCR: NCR number, standard and clause, the check, what was found (count, value, examples),
   and the corrective action.
3. **Observations**: things to review that are not a breach (NRV review, off-hours adjustments, dual access).
4. **All checks**: id, standard, result (PASS / NCR / OBSERVATION / NOT_TRACKED), count.
5. **Not tracked**: what the system cannot show, and what would be needed to track it.

## Keep it true

When the inventory, GRN, cycle count, PO or ledger schema or rules change, update the matching query in the script and the table above in
the same change. A check whose query fails reports NOT_TRACKED with the error, never PASS.
