---
name: incident-response
description: Handle SLTSERP SaaS security, availability, data-integrity, and production incidents with evidence and safe containment.
metadata:
  short-description: Contain, investigate, recover, and learn from incidents
---

# Incident response

Use for suspected breach, unauthorized access, data leakage, queue failure,
corrupt ledger/report, outage, or unsafe production behavior.

- Stabilize first: preserve evidence, contain the affected capability/tenant,
  revoke exposed sessions/keys, and avoid destructive cleanup.
- Record timeline, affected URLs/roles/tenants, correlation IDs, deploy
  revision, logs, API requests, database/read-model state, and user impact.
- Separate confirmed facts from hypotheses. Do not overwrite audit evidence or
  claim recovery before read-back and reconciliation succeed.
- Use least-privilege break-glass access with an expiry and audit trail. Restore
  from a verified backup or forward-fix with a reviewed migration plan.
- After recovery, add a regression test, monitoring/alert, runbook update, and
  post-incident review without exposing private data.
