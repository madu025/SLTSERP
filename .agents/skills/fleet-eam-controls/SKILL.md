---
name: fleet-eam-controls
description: Protect SLTSERP vehicle, fleet, asset, maintenance, trip, rental, and EAM lifecycle controls.
metadata:
  short-description: Keep assets and fleet records scoped and auditable
---

# Fleet and EAM controls

Use for vehicles, drivers, trips, fuel/rental payments, office assets,
maintenance, depreciation, assignments, or fleet reports.

- Enforce canonical capability plus OPMC/organizational scope on every asset,
  driver, trip, maintenance, and payment read/write.
- Preserve state transitions and immutable audit history for assignment,
  checkout, service, disposal, and payment records; do not delete evidence.
- Validate odometer/time/quantity/cost values, prevent overlapping trips or
  impossible dates, and make payment/expense postings idempotent.
- Keep driver, contractor, vehicle, and approver identities session-bound;
  reject client-supplied actors and cross-scope references.
- Reconcile fleet reports and exports with posted source records and test both
  allowed and cross-OPMC denial cases.
