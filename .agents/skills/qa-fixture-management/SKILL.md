---
name: qa-fixture-management
description: Create safe SLTSERP QA accounts and fixtures for real browser/API tests without leaking secrets or mutating unrelated data.
metadata:
  short-description: Provision deterministic, scoped QA fixtures
---

# QA fixture management

Use when tests need users, projects, OPMCs, stores, contractors, approvals,
documents, or other persisted prerequisites.

- Use dedicated environment-provided credentials and canonical DB roles; never
  print, commit, echo, or screenshot passwords, tokens, or database URLs.
- Generate unique fixture identifiers and tag descriptions as QA data. Reuse
  existing fixture helpers when present; do not invent fake IDs or bypass auth.
- Provision through approved admin/backend paths and verify the returned record
  by API/database read-back before opening the browser.
- Keep maker and checker identities separate. Grant only the capabilities and
  OPMC/store/project scope required by the scenario.
- Do not reset or delete broad data automatically. Preserve evidence and clean
  only exact fixture records through an approved, recoverable path.

A fixture failure is not a PASS or a silent skip: capture the exact prerequisite
error and repair the setup or report the external dependency.
