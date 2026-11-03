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

## Immutable image release path

- Build the production Docker image once in GitHub Actions and push it to the
  configured registry with an immutable commit tag or digest. Do not let
  Coolify rebuild the same revision from Git during the production rollout.
- Coolify production must be a Docker Image application with a separately
  stored read-only registry login. The deploy job must update only the image
  tag/digest, verify the resource has no Git source, then pull and roll it out.
- Run `pnpm run db:release` exactly once from the image before the Coolify
  deploy. It owns Prisma migrations, non-Prisma indexes, workflow catalog
  reconciliation, and canonical RBAC grants. A web container must not run any
  of those writes at startup.
- Fail closed when the image application UUID, registry pull login, or masked
  production release database secrets are absent. Never fall back to a Git
  build, a startup migration, or a second deployment provider.
- Record the image tag/digest, release-job result, Coolify deployment UUID,
  health transition, and authenticated smoke result as separate evidence.

## Production deployment authority

- Use one production deployment trigger only: `QA & Security Check` on `main`
  followed by `.github/workflows/coolify-deploy.yml`.
- Do not leave a direct Coolify Git push webhook, Vercel production hook, or
  another provider's auto-deploy enabled for the same production hostname.
  One push must create one production rollout.
- Before manually calling the Coolify deploy API, inspect active deployments;
  do not create a second rollout while the verified workflow is queued or
  running. Cancel only superseded queued/in-progress deployments and keep the
  newest commit.
- The GitHub deploy workflow is not operational until
  `COOLIFY_API_URL`, `COOLIFY_APPLICATION_UUID`, and `COOLIFY_API_TOKEN` are
  configured as repository secrets. A missing secret is a release blocker, not
  a reason to enable a second deploy trigger.

## Zero-downtime rollout requirements

- Treat `swarm_replicas: 1` as single-instance deployment, not a zero-downtime
  guarantee. For availability during rollout, use at least two healthy web
  replicas when VPS capacity permits and a rolling strategy that keeps the old
  replica serving until the new one passes readiness.
- Keep container liveness separate from dependency/readiness and business
  acceptance: `/api/health/live`, `/api/health`, and authenticated smoke are
  separate evidence. A 200 liveness response does not prove the application is
  ready for business traffic.
- Do not claim zero downtime while every new replica runs long Prisma
  migrations, workflow seeds, or RBAC reconciliation in its startup path.
  Prefer a one-time release migration/seed job before the rolling web rollout;
  if the current entrypoint still owns those operations, record the startup
  window and treat the rollout as potentially disruptive.
- Verify the proxy has switched traffic only after the new container is healthy,
  then confirm the old container was removed after the switch. Record any
  period with no healthy backend as a deployment failure.
