---
name: release-verification
description: Validate SLTSERP builds, commits, Coolify deployments, health endpoints, and authenticated production browser acceptance.
metadata:
  short-description: Release with evidence instead of assumptions
---

# Release and deployment verification

Use for release, deploy, push, Coolify, production QA, or claims that a fix is
live.

- Use pnpm only: targeted tests, `pnpm run test:types`, `pnpm run build`, and
  targeted lint on changed files.
- Commit only intentional tracked changes; preserve user-owned untracked files
  and never stage secrets, credentials, reset scripts, or generated artifacts.
- After push/deploy, verify the deployed revision matches the pushed commit,
  Coolify reports finished, `/api/health/live` is 200, `/api/health` has
  healthy dependencies, and authenticated UI/API calls work.
- Re-run the failed browser chain from its first step against the deployed URL;
  inspect console/network errors and read back persisted state.
- Do not convert a local build, unit suite, or health endpoint into a browser
  lifecycle PASS. Record transient worker/queue warnings separately.
