---
name: reporting-reconciliation
description: Keep SLTSERP reports, exports, dashboards, and read models reconciled with posted ledger and scoped source records.
metadata:
  short-description: Protect report correctness and reconciliation
---

# Reporting and reconciliation

Use for trial balance, P&L, balance sheet, GL viewers, dashboards, exports,
AR/AP, inventory summaries, or any derived read model.

- Define the authoritative source and posting status before changing a query;
  draft, void, cancelled, or unposted records must not silently appear in
  official reports.
- Apply canonical permission and OPMC/store/project scope to both detail and
  aggregate queries. Never treat a menu visibility check as data authorization.
- Reconcile totals against ledger/source rows, including currency, dates,
  rounding, reversals, receipts, and retained void records.
- Make exports use the same filtered read model as the visible report and avoid
  leaking hidden columns or other-tenant data.
- Add a deterministic fixture and a read-back assertion for every changed
  financial or inventory report.
