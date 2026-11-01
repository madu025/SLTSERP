---
name: finance-controls
description: Preserve SLTSERP Project Finance, invoice, receipt, payment, ledger, and maker-checker accounting invariants.
metadata:
  short-description: Protect financial lifecycle and posting correctness
---

# Finance controls

Use for invoices, receipts, payment vouchers, BOQ/expenses, Project Finance,
contractor billing, period close, or financial reports.

- Keep SLT submission, customer receipt/settlement, and completion as separate
  facts; submission must never imply payment received.
- Client invoices settle through `CustomerReceipt`; do not bypass receipt
  controls with payment vouchers.
- Validate positive finite money values, currency precision, balance limits,
  bank references, duplicate references, and row-lock the invoice before
  settlement.
- Make issuance and payment postings idempotent and auditable. Never delete
  financial history; use immutable void/cancellation records with reasons.
- Enforce canonical financial capabilities plus Project/OPMC scope and reject
  creator/self-approval where maker-checker assignments apply.

Run the relevant `tests/unit/project-finance` and finance suites, then perform
the real browser lifecycle with API/read-model/ledger read-back.
