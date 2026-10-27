# CI/CD v0.3

The repository now has two separate gates:

1. `QA & Security Check` runs on pull requests and pushes to `main`/`staging`.
   It performs dependency installation, Prisma generation, TypeScript checks,
   build, unit tests, sync diagnostics, and the local Playwright suite.
2. `Production Smoke Gate` runs against an already deployed URL. It checks the
   liveness endpoint, database health, login form, and a dedicated read-only
   account session. It does not create, edit, delete, upload, or process business
   records.

## Required GitHub secrets

Configure these secrets before enabling the gates:

- `E2E_USERNAME` / `E2E_PASSWORD`: dedicated CI account for the local E2E suite.
- `PRODUCTION_SMOKE_USERNAME` / `PRODUCTION_SMOKE_PASSWORD`: dedicated
  production smoke account with the minimum read-only permissions required for
  `/api/profile`.

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
such as `https://sltserp.vercel.app`. A Coolify or Vercel release is accepted
only after this read-only smoke gate passes. The same workflow is reusable from a
deployment workflow through `workflow_call`.
