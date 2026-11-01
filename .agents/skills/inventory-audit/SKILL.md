---
name: inventory-audit
description: Implement and verify SLTSERP store custody, material issue/return, reservation, and immutable inventory ledger controls.
metadata:
  short-description: Protect stock movement and custody auditability
---

# Inventory custody and audit

Use for Stores, Inventory, material issues, transfers, returns, reservations,
contractor custody, or project material costs.

- Every issue, dispatch, transfer, and return displays an explicit issue note
  number/MIN/MRN reference on the Main Store and Contractor Mobile interfaces.
- Every custody movement writes an immutable `InventoryLedger` record with the
  SHA-256 checksum over the canonical movement fields.
- Enforce store/OPMC/project scope server-side and use row locks for competing
  stock/reservation changes. Reservations must not silently reduce physical
  stock.
- Reject self-approval, duplicate approval, negative/over-return quantities,
  and client-supplied actor/store identities.
- Preserve damaged/voided movements in the audit trail and keep active stock
  and cost read models consistent.

Run inventory unit tests plus a real browser issue -> reject/approve -> return
chain with ledger and stock read-back.
