# Project Module deep audit — 2026-10-31

## Scope and evidence

Reviewed the Project workflow API, workflow engine, navigation, existing unit tests,
Playwright configuration, and the CI gate at commit `1aea72ba`. Ran the Project
test set locally (70 passing after the fixes below), TypeScript, and changed-file
ESLint. This is source and local test evidence, not a browser lifecycle or deployed
role acceptance result.

## Fixed in this round

1. **High: workflow OPMC scope bypass.** The stage transition and approval routes
   checked `project.approve` but did not call `assertProjectAccess`. Review and
   handoff reads/writes had the same gap. All four routes now check the project
   boundary before accessing or mutating workflow records. Task and base workflow
   routes already had that check. Regression contracts cover the four routes.
2. **High: Project tests absent from the CI gate.** `test:unit` ran only two
   Project-related files. Added `test:project` to run the full existing Project
   unit set, and made the QA workflow run it. The new gate runs 70 tests locally.

## Remaining gaps

1. **Resolved in follow-up: legacy role checks inside workflow actions.**
   `WorkflowEngine` now checks effective `project.approve` and Project OPMC scope.
   Approval-level eligibility uses active DB role assignments, with an explicit
   `admin.rbac` routing override and a same-user multi-level approval ban.
   Service-level tests cover allow/deny, direct override, inactive role, foreign
   OPMC, and legacy display-role independence.
   Workflow review decisions now use the same canonical capability/active-role
   model. The client no longer chooses the reviewer role; a review submitter
   cannot decide their own review. Service-level allow/deny tests cover these
   paths. The Project suite now runs 81 tests locally.
2. **High: no Project browser lifecycle test in CI.** The production Playwright
   config runs only `production-smoke.spec.ts`: health, login form, and optional
   login/profile. It does not visit Project detail, complete a stage, exercise
   review/rework, invoice/receipt, or verify role-specific controls. Local
   `playwright.config.ts` references `project-module.spec.ts`, but that file is
   absent. Add a disposable QA project fixture and role matrix before claiming
   end-to-end Project acceptance. Do not mutate production records for that test.
3. **Medium: Project tests are mostly unit/source contracts.** Existing tests
   cover finance lifecycle, scopes, costs, navigation, closure, stock return and
   transition rules, but they do not execute the full workflow HTTP routes with
   real authentication, database scope, and concurrent writes. Add integration
   cases for a foreign OPMC, out-of-order stage action, duplicate approval and
   concurrent completion against a disposable database.
4. **Medium: UI acceptance remains unverified.** The earlier UI audit records
   pending visual, mobile, keyboard, and role-specific browser checks. Source
   tests and a successful build cannot establish contrast or usability in a
   rendered Project page.

## Acceptance path

Run the Project gate in CI; add disposable integration fixtures for Engineer,
Area Manager, Finance Preparer/Approver, Stores Manager, and Admin; then run a
browser lifecycle on localhost/staging. Verify each role's visible actions and
server responses, a 360px viewport, keyboard navigation, stage rework, BOQ and
material handoff, client invoice submission, separate receipt settlement, and
closure. Retest a deployed revision only after deployment is confirmed.
