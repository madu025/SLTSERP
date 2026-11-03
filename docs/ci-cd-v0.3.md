# CI/CD v0.3

The repository now has two separate gates:

1. `QA & Security Check` runs on pull requests and pushes to `main`/`staging`.
   It performs dependency installation, Prisma generation, TypeScript checks,
   build, unit tests, and sync diagnostics. It is source/release validation and
   never waits for the production hostname.
2. `Production Smoke Gate` runs after the immutable deployment against the
   deployed URL. It checks the
   liveness endpoint, database health, login form, and a dedicated read-only
   account session. It does not create, edit, delete, upload, or process business
   records.

Production deployment is handled by `.github/workflows/coolify-deploy.yml`.
It runs only after `QA & Security Check` succeeds for `main`, verifies that the
tested SHA is still the latest `main` SHA, builds one immutable Docker image,
pushes it to GHCR, runs the database release job from that exact image, asks
Coolify to pull the exact image tag, and then calls `Production Smoke Gate`.
This ordering avoids a circular gate where pre-deploy QA waits for production
while deployment waits for QA. Coolify must be configured as a Docker Image
application; a Git/Dockerfile application is rejected by the workflow so a
push cannot silently rebuild on the VPS. Do not also enable a direct Coolify
Git push webhook, otherwise one push can create duplicate deployments.

The Docker build uses a non-production JWT placeholder only for static Next.js
evaluation. The web image never runs Prisma migrations, SQL index creation, workflow seed,
or RBAC reconciliation during startup. Those writes are owned by the one-time
`pnpm run db:release` job and must finish before the image deployment begins.

## Required GitHub secrets

Configure these secrets before enabling the gates:

- `E2E_USERNAME` / `E2E_PASSWORD`: dedicated CI account for the local E2E suite.
- `PRODUCTION_SMOKE_USERNAME` / `PRODUCTION_SMOKE_PASSWORD`: dedicated
  production smoke account with the minimum read-only permissions required for
  `/api/profile`.
- `COOLIFY_API_URL`: trusted Coolify base URL without `/api/v1`.
- `COOLIFY_API_TOKEN`: team API token with `deploy` and application update
  permission.
- `COOLIFY_IMAGE_APPLICATION_UUID`: the Coolify Docker Image application UUID
  for the production hostname. Keep the old Git/Dockerfile application
  available as a rollback resource until the image path has passed acceptance.
- `PRODUCTION_DATABASE_URL`: production database connection string for the
  one-time release job. Store it only as a masked GitHub Actions secret.
- `PRODUCTION_DIRECT_URL`: direct production database connection string for
  Prisma migrations. Store it only as a masked GitHub Actions secret.
- `GHCR pull login`: configure a read-only GHCR token for the Coolify server
  under Servers > Registries. The workflow uses the ephemeral GitHub Actions
  token only to publish; Coolify needs its own pull credential.

Never use a real administrator password for these tests.

## Provisioning the smoke account

Point `DATABASE_URL` at the intended staging/production database, set the
following values only in the shell or secret manager, and run the command once:

```powershell
$env:PRODUCTION_SMOKE_USERNAME = 'ci_smoke_readonly'
$env:PRODUCTION_SMOKE_EMAIL = 'ci-smoke@your-domain.example'
$env:PRODUCTION_SMOKE_PASSWORD = '<random-password-at-least-16-characters>'
$env:PROVISION_SMOKE_USER_CONFIRM = 'YES'
pnpm run provision:production-smoke-user
```

The command refuses to overwrite an existing account and grants only the
`HEAD_OF_SECTION`/`dashboard` read-only baseline used by the smoke test. Do not
commit the password or place it in `.env.example`.

## Running the post-deploy gate

From GitHub Actions, run **Production Smoke Gate** and supply the deployed URL,
such as `https://slts.vynor.lk`. A Coolify release is accepted only after the
immutable image tag, release-job success, Coolify deployment, health endpoints,
and this read-only smoke gate all pass. The same workflow is reusable from a
deployment workflow through `workflow_call`.
