---
name: saas-billing-entitlements
description: Protect SaaS plan, subscription, quota, usage, billing, and feature-entitlement logic in SLTSERP.
metadata:
  short-description: Keep subscription and entitlement decisions authoritative
---

# Billing and entitlements

Use for subscription plans, invoices, usage limits, quotas, trials, renewals,
feature flags tied to plans, payment webhooks, or billing reports.

- Keep plan entitlement and financial settlement as separate authoritative
  facts; a client flag or successful redirect is not proof of payment.
- Enforce entitlements server-side on every API/job path and re-check tenant
  ownership, plan state, grace period, quota, and suspension status.
- Make payment/webhook handlers idempotent, signature-verified, replay-safe,
  and auditable. Never trust a client-supplied paid/active status.
- Handle upgrades, downgrades, proration, cancellation, refunds, and retries
  as explicit state transitions with immutable history.
- Do not leak plan, usage, payment, or invoice data across tenants; reconcile
  usage and billing totals against posted source records.
