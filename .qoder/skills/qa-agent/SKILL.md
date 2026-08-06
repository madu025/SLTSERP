# /qa-agent — Module QA Sweep Protocol

Use this workflow whenever the user runs `/qa-agent` or asks to QA-test SLTSERP modules end-to-end.

## Purpose

Systematically walk every SLTSERP page per role with Playwright, validate the UI contract, discover real bugs (console errors, 5xx, crashes, RBAC gaps), and produce a structured bug report.

ARGUMENTS: optional — a module filter (e.g. `inventory`, `finance`, `all`) or a single spec file name.

## Architecture

- Specs: `tests/qa-agent/modules/*.spec.ts`
- Infrastructure: `tests/qa-agent/_infrastructure/`
  - `playwright.config.ts` — isolated config (do NOT merge into root playwright.config.ts)
  - `fixtures.ts` — `TEST_USERS`, `loginAs()` (Quick Test Login buttons + rate-limit handling), `LoginResult`
  - `module-registry.ts` — single source of truth: paths, roles, forbiddenRoles, criticalSelectors, apiRoutes
  - `helpers.ts` — `collectOnReload`, `checkRoleForbidden`, `writeBugEntry`, `waitForApi`
- Bug log: `tests/qa-agent/reports/bugs.json` (append-only JSON-lines, gitignored)
- Report: `tests/qa-agent/reports/qa-report.md` (generated)

## Execution Workflow

### Step 1: Pre-flight

1. Ensure the dev server is running on `http://localhost:3000` (`npm run dev`).
2. Verify `npx tsc --noEmit -p tsconfig.json` is clean for any modified spec.

### Step 2: Run the sweep

```powershell
# Full sweep
npx playwright test --config=tests/qa-agent/_infrastructure/playwright.config.ts --reporter=list

# Single module
npx playwright test --config=tests/qa-agent/_infrastructure/playwright.config.ts tests/qa-agent/modules/inventory.spec.ts
```

Expected runtime: ~2.5 min for the full suite (single worker, rate-limit aware).

### Step 3: Generate the report

```powershell
node scripts/generate-qa-report.js
```

Then read `tests/qa-agent/reports/qa-report.md` and present findings grouped by severity (CRITICAL and HIGH first).

### Step 4: Triage rules

- **Test failures that are selector/timing issues** → fix the spec, not the app. Common culprits: standalone pages without Sidebar (use `h1, h2` waits), `.or()` strict-mode violations (use count/`isVisible` instead), client-side routing drift (add URL assertion + re-goto), pages stuck on "Loading..." (wait for hidden).
- **Real app bugs logged to bugs.json** → fix the app code, re-run the affected spec to confirm, and mention the fix in the report.
- **CRITICAL findings (error-boundary crashes, RBAC gaps)** → fix immediately before any other work.

## Adding a new module

1. Add an entry to `module-registry.ts` (path, roles, forbiddenRoles only where a page-level RoleGuard or server guard actually exists, criticalSelectors, apiRoutes).
2. Copy the closest existing spec (`finance.spec.ts` is the most robust template: URL drift guard, loading wait, error-boundary detection, data-region fallback chain table → card → heading).
3. Run the new spec alone first, then the full suite.

## Hard rules

- Never use `page.fill()` for the login form — react-hook-form ignores it. Use `loginAs()` which clicks Quick Test Login buttons.
- Never assert on `networkidle` — Next.js dev HMR websockets hang it. Use `domcontentloaded` + explicit waits.
- Never hard-fail on discoverable bugs (console errors, empty tables) — log via `writeBugEntry` and continue. Only hard-fail on contract violations (5xx, crashes, RBAC leaks).
- Always skip gracefully on `login.rateLimited || login.loginFailed` — the login rate limiter allows 10 req/min.
- Keep the config isolated: never add qa-agent specs to the root playwright config.
