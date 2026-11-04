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

## Full lifecycle run (2026-11-04)

A complete Building Fiber project (17 stages, survey to closure, material chain, both invoice types)
was driven end to end against the real database as role accounts, mostly through the API with a Node
driver and the UI for spot checks. Reuse these lessons:

- **Exact system roles matter.** `createUser` makes section-prefixed roles (`NEW_CONNECTION_OSP_MANAGER`). The
  workflow engine suffix-matches them, but BOQ approval policy, supervisor eligibility and plan
  assignment need the exact code (`OSP_MANAGER`, `ENGINEER`, `AREA_MANAGER`, `FINANCE_MANAGER`,
  `QC_OFFICER`, `OSP_ENGINEER`, `CONTRACTOR_SUPERVISOR`, `INVOICE_MANAGER`). Set `User.roleId` to the
  exact role after creating each account.
- **One user cannot approve two levels of a stage or BOQ**, so a run needs at least ENGINEER x2,
  AREA_MANAGER, OSP_MANAGER, FINANCE_MANAGER, QC_OFFICER and a finance preparer.
- **Notifications reach real staff.** In a shared OPMC, hand-offs, document approvals (ADMINISTRATORS
  audience) and fallbacks create in-app rows for real users. Delete rows that reference the QA project
  for non-QA users after each step; pushes/emails need the worker, which is not running locally.
- **Local storage:** uploads fail against the Coolify S3 endpoint from a dev machine. Blank
  `S3_ENDPOINT` and set `STORAGE_ALLOW_LOCAL_FALLBACK=true` in the worktree `.env` copy only; remove both
  afterwards and delete `public/uploads/`.
- **Slow remote DB:** interactive transactions over the VPS can exceed Prisma's 5 s default. A 500
  `Transaction not found` on a bulk action is a timeout, not a data error.
- **Material chain** needs a store: GRN approval deposits to the project OPMC's store or the MAIN store,
  and the issue approver needs `assignedStoreId`. Keep quantities tiny; ledger and GL rows are permanent.
- Completing the final stage closes the project. Plan-generated project tasks are not completed by their
  workflow stages, so closure waits on 37 pending tasks until assignees finish them.

## GIS import and CAD upload run (2026-11-04)

Sample package `SM-HJJ-0508-AB` (7 GeoJSON layers, one `.qgz`, one AutoCAD 2010 `.dwg`) was driven through
`POST /api/gis/upload` then `/api/gis/process`, exactly as `GISUpload.tsx` sends it (multipart `files`,
`layerTypes`, `projectName`, `opmcId`, `region`, `district`). Reuse these lessons:

- **Read back counts against the source files**: poles 37 existing + 2 new = 39, cables 4, FDP 3 + joints 2 = 5
  closures, handhole 1 = chamber 1, cable length 1123.5 m (geodesic of the geometry; the `Length` text
  property sums to 1666 m, so the sample's declared lengths do not match its geometry).
- **Check the project's OPMC, not just the 200.** A GIS import creates a project whose OPMC is its data scope.
  Importing by region text once put it in a different OPMC than selected, so the importer got 403 on their own
  project. Always assert `project.opmcId` equals the OPMC picked in the form.
- **Test with a scoped account, not admin.** A user limited to one OPMC must not see another OPMC's routes in
  `/api/gis/map-data`, and must get 403 from `POST /api/gis/cable-segment/slack` for a foreign segment id.
- **Open the GIS page in the browser** (`/projects/{id}/gis`) and read the console: Prisma Decimals arrive as
  strings and crashed `seg.length.toFixed` until the GIS endpoints used `toSerializable`.
- **Imports consume the real project code sequence** (`FSSD_SLTS_<year>_<n>`) and write ~50 assets, 153 field
  tasks, 24 permits and a 7-stage workflow. Name the project `QA-GIS-<timestamp>` and report the codes used.
- **CAD files**: `/api/upload` accepts `.dxf`/`.dwg` only; `.geojson`, `.qgz`, `.zip`, `.gpkg` are rejected even
  though the Documents tab offers some of them. With the local storage fallback the returned
  `/api/files/documents/...` URL has no route (404); compare the stored file's SHA-256 on disk instead.
- **BOQ**: the BOQ engine prices every pole, joint and handhole as new supply and ignores the layers'
  `Exist_New` attribute (37 existing poles = LKR 1.665 M in the sample). Check BOQ lines against the source.

## Next-action queue (2026-11-04)

After a hand-off notification, open `/projects/my-tasks` as that user and assert the **What to do next**
section lists the action (supervisor: waiting for BOQ / start plan; manager: assign supervisor / approve plan;
approver: approval step; stage owner: complete stage). A notification with an empty My Tasks is a defect.
Run the UI through the login form, and do not pick real staff in the supervisor dropdown.
- Plan hand-off: supervisor *Submit for approval* -> managers notified and listed under What to do next -> approve generates tasks. The sidebar My Tasks badge reads `myTasks` from `/api/notifications/sidebar-counts`.
- Reminders run from the worker job `PROJECT_REMINDERS` (07:30 SL), not from an external cron; verify with `ReminderSchedulerService.runProjectReminders()` against QA data only (they notify real owners).

## Full lifecycle run, standard-practice version (2026-11-04)

Stages 1-14 were driven with role accounts and every hand-off was asserted in the next owner's `/api/projects/my-tasks`
(`nextActions` of kind STAGE). Extra checks that caught real defects: plan submit -> approver queue -> approve; the OTDR
gate (no trace refused, failed trace refused, same-fibre re-test passes, tester cannot review own trace); project status
follows the stage; invoice stage visible to the finance team only. Fixtures: `e2e_sup` needs the exact `CONTRACTOR_SUPERVISOR`
role and the plan's INVOICE_MANAGER task needs a user with `INVOICE_MANAGER`, otherwise plan assignment fails with
`TASK_USER_ROLE_MISMATCH`. Dry-run migrations inside a transaction you roll back; never apply them to the real DB by hand.
