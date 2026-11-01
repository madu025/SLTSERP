---
name: backup-disaster-recovery
description: Plan and verify SLTSERP SaaS backups, restore, disaster recovery, migrations, and data-loss prevention.
metadata:
  short-description: Make recovery tested rather than assumed
---

# Backup and disaster recovery

Use for database migrations, storage, destructive operations, incident repair,
backup schedules, restore tests, or production data-loss concerns.

- Identify authoritative database, object storage, queues, secrets, and audit
  data; define RPO/RTO and dependency order before a change.
- Use recoverable operations and immutable/versioned backups; never rely on a
  container-local disk or an unverified snapshot.
- Test restore into an isolated environment, run integrity/reconciliation
  checks, and document the exact revision/config needed to restart safely.
- Make migrations backward-compatible where rolling deploys are possible and
  provide a rollback or forward-fix plan for each destructive schema change.
- Verify backup age, encryption, access control, retention, and alerting; never
  print backup credentials or copy production data into unsafe fixtures.
