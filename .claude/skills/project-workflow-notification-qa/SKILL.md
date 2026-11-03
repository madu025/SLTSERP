---
name: project-workflow-notification-qa
description: End-to-end browser QA of Project hand-off notifications (assignments, finance roles, invoice approval, workflow stages) against the real database with role-specific test accounts.
metadata:
  short-description: Verify project hand-offs notify the next owner
---

# Project hand-off notification QA

Use when a change touches project task/supervisor/finance assignment, invoice hand-offs,
workflow stage or approval notifications, `/projects/my-tasks`, or the notification scheduler.
It extends `browser-qa`; read that first. Pnpm only.

## Rules that are easy to get wrong

- **The test database is the real database.** There is no separate test DB by decision. Every
  fixture is clearly named (`QA-NOTIF-<timestamp>` projects, `qa_*` users) and cleaned up at the
  end. Never run `prisma/seed.js` against it: it resets the `admin` password.
- **Login two ways, know the difference.** `fetch('/api/login')` sets the cookie only; the sidebar,
  header and permissions UI then show "Guest" and hide Projects. Use the **login form** for any UI
  assertion, and `fetch` only for API read-back or fast account switching. Access tokens last
  15 minutes; a 401 in the middle of a run means re-login, not a bug.
- **Never type credentials on a non-local host.** Production (`slts.vynor.lk`) logins are manual.
  Run the app on `localhost` (`.claude/launch.json` config `slts-erp-dev`, port 3000) against
  the real DB through `D:\MyProject\SLTSERP\.env` (copy into the worktree; it is git-ignored).
- **Do not click the login page's quick-login role buttons** (Super Admin, Admin, ...).
- **Posting writes accounting entries.** Issuing an invoice (`status: ISSUED`) posts a journal
  entry to the real ledger. Draft creation does not. Ask before issuing; cancel creates a
  reversal entry that stays in the audit trail.
- **Notifications never block the action.** A missing notification is a silent failure: always
  read back `/api/notifications` for the recipient, do not assume.

## Fixtures

Create accounts with a one-off `tsx` script (not committed) that calls
`UserService.createUser(...)` then updates the user with an explicit `permissions` JSON array,
`accessibleOpmcs` for one OPMC (`OPMC R-AD` has data), and `mustChangePassword: false`.
Generate passwords randomly, write them only to the session scratchpad, never print or commit
them. `provision:production-smoke-user` shows the fail-closed pattern.

| Account | Role | Explicit permissions |
|---|---|---|
| `qa_pm` | MANAGER | dashboard.read, project.read, project.write, project.plan.read, project.plan.write, project.finance.read, project.finance.assign |
| `qa_eng` | ENGINEER | dashboard.read, project.read, project.plan.read, and `roleId` = system role `ENGINEER` |
| `qa_fin_prep` | FINANCE_ASSISTANT | dashboard.read, project.read, project.finance.read, project.finance.write, finance.write |
| `qa_fin_appr` | FINANCE_MANAGER | dashboard.read, project.read, project.finance.read, project.finance.approve, finance.approve |

`qa_eng` needs the plain `ENGINEER` system role: supervisor eligibility matches the exact code
(only `_GLOBAL` is stripped), so the auto-created `<SECTION>_ENGINEER` role does not qualify.

## Scenario (all PASS on 2026-11-03)

1. `qa_pm`: `POST /api/projects` with `type`, `projectTypeId` (BUILDING_FIBER) and the OPMC id.
2. `qa_pm`: `POST /api/projects/{id}/supervisors` `{supervisorId: qa_eng}` -> qa_eng gets
   "Assigned to a Project".
3. `qa_pm`: `POST /api/projects/finance-assignments` for `qa_fin_prep` (PREPARER) and
   `qa_fin_appr` (APPROVER) -> both get "Assigned to a Project".
4. `qa_pm`: `POST /api/projects/{id}/field-tasks` with `assignedUserId: qa_eng` -> qa_eng gets
   "New Project Task Assigned"; `/api/projects/my-tasks` lists it.
5. `qa_fin_prep`: `POST /api/projects/invoices` (CLIENT, one item) -> `qa_fin_appr` gets
   "Invoice awaiting your approval" and sees it under "Finance & invoicing - waiting on you";
   the creator's own queue stays empty (no self-approval).
6. Log in through the form as `qa_fin_appr`, open `/projects/my-tasks`, screenshot the queue.

Not covered, needs a prepared project: plan publish notifications (needs an APPROVED BOQ,
`BOQ_APPROVAL_REQUIRED_FOR_TASK_PLAN`), workflow stage completion hand-off and approval levels
(gate validation: mandatory checklists, approvals), `ISSUED -> submit to SLT` (ledger posting).

## Cleanup and evidence

- Set `qa_*` users `status` to `inactive`, delete the DRAFT invoice (approver), and record the
  project id so it can be removed by an admin.
- Report per step: role, URL or endpoint, HTTP status, and the persisted read-back (notification
  title/message or queue row). A step without read-back is not a PASS.
