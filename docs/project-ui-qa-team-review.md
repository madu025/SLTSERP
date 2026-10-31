# Project UI QA team review - 2026-10-30

## Method and limits

Four independent read-only reviewers audited lifecycle/navigation, permissions,
async/API contracts, and responsive/accessibility behavior. The working-tree UI
patch was included. Findings below are source-confirmed or explicitly marked as
rendering risks. No live records, application code, grants, or schemas changed
during this review. Navigation/finance tests: 30 passed; those tests are not full
browser coverage.

## P1 - fix before accepting the complete lifecycle UI

1. **Stale workflow shell.** `page.tsx:97,441` does not pass a refresh callback
   for workflow-pipeline; tracker has no parent refresh prop. Completing a stage
   refreshes the tracker only; shell stage/module recommendations remain stale.
2. **Wrong current stage during review/rework/block.** `page.tsx:147` selects
   IN_PROGRESS then PENDING and ignores IN_REVIEW/CHANGES_REQUESTED/BLOCKED.
   A pending later stage can replace the true current stage in the shell.
3. **Cross-project stale rendering.** `page.tsx:135` neither clears the old
   project nor cancels obsolete requests on id changes. Slow/failed parent-child
   navigation can retain previous details/actions under the target URL.
4. **Document revision publishing blocked.** `ProjectDocuments.tsx:94,151`
   requires an uploader chosen from nonexistent `/api/admin/users`; the backend
   already owns authenticated uploader identity. Remove the client actor choice.
5. **As-built layer export contract mismatch.** `ProjectAsBuilt.tsx:32` uses
   local layer IDs rejected by `as-built.service.ts:267`. Use the canonical layer
   registry rather than a second hard-coded list.
6. **Finance Preparer cannot submit a draft voucher.**
   `ProjectFinance.tsx:1009` restricts PENDING_APPROVAL to canApprove, while the
   backend intentionally permits this submission for writers. Approval and
   submission must be separate actions.
7. **LD Collect is unsupported.** `ProjectFinance.tsx:1183` submits COLLECTED;
   `api/projects/ld-penalties/route.ts:30` accepts only APPROVED/WAIVED/REJECTED.
   Do not show a successful collection workflow without backend implementation.

## P2 - action reliability and role clarity

- `ProjectWorkflowTracker.tsx:273`: optimistic checklist completion is not
  rolled back after a failed update, so a rejected action appears successful.
- `ProjectWorkflowTracker.tsx:159,394`: load failure becomes "setup required"
  and offers initialization instead of a persistent load error and Retry.
- Documents, Surveys, As-built comparison, Finance assignments, and non-invoice
  Finance tabs conflate failed/loading requests with empty or stale data.
  (`ProjectDocuments.tsx:77`, `ProjectSurvey.tsx:130`, `ProjectAsBuilt.tsx:59`,
  `ProjectFinanceAssignments.tsx:91`, `ProjectFinance.tsx:273`.)
- Document upload/version and survey-create buttons lack an in-flight lock;
  rapid repeated submissions can produce multiple requests.
- Tasks, Edit, workflow approval/review, and all-module discovery are not
  consistently capability-aware. Backend denial does not make misleading
  frontend actions usable. (`ProjectTasks.tsx:543,715`, `page.tsx:300,160`,
  `ProjectWorkflowTracker.tsx:677`.)
- `ProjectApprovals.tsx:224` retains a development acting-user selector.
  Backend uses authenticated identity; this is not proof of impersonation, but
  it misrepresents who performs the action.
- `project-approval.service.ts:140` retains legacy-role eligibility checks;
  capability grants can disagree with the actor shown as eligible in the UI.
- "Browse all" merges every workflow mapping, filtering only GIS/OTDR; it is
  not a project-specific or permission-aware module catalogue.
- CAD Survey still exposes QField integration controls, and generic Survey &
  Current-State Assessment does not recommend Survey in its default modules.
- "Open current step" selects the pipeline module, not a specific stage ID.
- Completed invoices still offer Complete; manual QField ID typing refetches
  on every keystroke without cancellation/order protection.

## Responsive and accessibility risks (visual reproduction pending)

- Invoice dialog lacks bounded viewport height/scroll; a long item list can
  place its submission footer off-screen (`ProjectFinance.tsx:604`).
- Invoice item editor keeps five columns on phones (`:653`).
- Many Finance/Edit labels lack input ids/htmlFor or accessible names.
- Module navigation selected state is conveyed by color rather than aria-current.
- Finance tab bar has no narrow-screen wrap/scroll strategy.
- Active mobile modules use text-white on a theme-dependent primary background;
  use matching semantic foreground tokens and verify actual contrast.

## Financial visibility policy to resolve

Project-read returns project budget/actual-cost and BOQ data; Overview and summary
export expose them even without a finance permission (`project.service.ts:161`,
`ProjectOverview.tsx:35`, `page.tsx:295`). This is broader than Finance-tab access.
Decide explicitly whether operational project readers may see those amounts.
If not, server-side response projections are required; hiding a tab is insufficient.
Do not label this a confirmed unauthorized-data breach without that policy decision.

## Recommended fixing order

1. Current-stage identity, parent refresh, project-switch stale state.
2. Documents/As-built/LD API contracts and preparer submission path.
3. Canonical role visibility, actor simulator removal, consistent error/retry.
4. Mobile dialogs, accessible fields/navigation, project-specific module catalogue.
5. Browser role matrix and complete project/invoice lifecycle, including negative
   actions, slow network, keyboard navigation, 360px viewport, and theme contrast.

## Fixing round (2026-10-30)

Implemented after review:

- Shared current-stage resolver (including persisted currentStageId, review,
  rework and blocked states), workflow-to-parent refresh, current-step remount,
  and aborting obsolete project-load requests.
- Canonical read-capability module filtering, edit/mutation UI guards, accessible
  active navigation and semantic mobile foreground color.
- Document revision actor is session-owned; removed the nonexistent user lookup.
  Documents/Survey submission locks and load error/Retry states added.
- As-built exports reuse the canonical survey-layer registry; comparison requests
  have stale-result protection and errors are no longer reported as empty data.
- CAD surveys no longer expose QField controls; manual ID entry no longer
  automatically refetches on each keystroke.
- Finance preparers can submit draft vouchers; already-completed invoices do not
  offer Complete. Non-invoice tabs/assignments have explicit load/error/retry.
- Unsupported LD Collect mutation removed and replaced with an honest explanation.
  Actual collection accounting is NOT implemented by this UI fix.
- Finance dialogs scroll within viewport, item editor stacks on mobile, labels
  are linked to fields, and Finance tabs can scroll horizontally.
- Approval actor simulator removed. Task controls and approval actions are
  capability-aware. Approval service now resolves eligibility from active
  canonical DB roles/capabilities and explicitly checks project scope.
- Failed checklist requests no longer leave an optimistic successful checkmark;
  workflow load failure offers Retry rather than initialization.

User confirmed Project readers should retain budget/actual-cost summary. That
visibility is intentional, not a defect to fix by removing their summary.

Verification: unit suite 101 passed; navigation/UI-contract/finance checks 38
passed; changed-file ESLint and production build passed (existing Next.js
deprecation/tracing warnings remain). Browser visual verification remains pending.
"Browse all" is now permission-filtered but is still a broad optional toolbox,
not a per-project configurable capability catalogue. Do not claim complete
end-to-end acceptance or implemented LD collection accounting from these checks.
