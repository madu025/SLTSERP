# Project lifecycle: how it should run, from creation to closure

Scope: SLTS ERP project module (OSP / FTTH delivery). Based on a read of the current code and a
web scan of FTTH/OSP delivery, acceptance and construction-billing practice. Nothing here is
implemented yet unless marked **done**.

## 1. What the system does today

A project is created with a project type. The first time its workflow is opened, the engine
attaches the active template for that type (`ProjectWorkflowService.getWorkflow`). The production
"Building Fiber / Project Delivery" template (`prisma/seed-workflows.ts`) is a 16-stage gate:

| # | Stage | Owner role | Exit gate in template |
|---|---|---|---|
| 1 | Requirements evaluation | - | checklist |
| 2 | Survey (field/mobile) | - | survey evidence |
| 3 | Design plan | - | - |
| 4 | Design review | - | review / rework loop |
| 5 | CAD drawings | - | versioned upload |
| 6 | Drawing review | - | review / rework loop |
| 7 | BOQ generation | - | checklist |
| 8 | BOQ approval | technical, project, finance | approval levels |
| 9 | Work packages | OSP_MANAGER | child tasks + contractor per package |
| 10 | Permit & access | AREA_MANAGER | approval + documents |
| 11 | Implementation | CONTRACTOR_SUPERVISOR | checklist + photos |
| 12 | In-house PAT | QC_OFFICER | approval + checklist |
| 13 | SLT PAT | AREA_MANAGER, OSP_MANAGER | two approval levels |
| 14 | As-built (GIS + CAD) | ENGINEER, AREA_MANAGER | two approval levels + documents |
| 15 | Invoice submission | CONTRACTOR_FINANCE | invoice linked to tasks |
| 16 | Invoice follow-up | INVOICE_MANAGER | follow-up recorded |

Closure (`ProjectService.closeProject`) refuses to close while PAT sessions, unpaid invoices, open
change requests, incomplete tasks, pending material returns or incomplete stages remain, and it
requires a final as-built. Retention records a defect-liability end date and blocks release
before it.

## 2. What good practice looks like

Sources are vendor and industry pages, not formal standards; check FOA and BICSI before
adopting any threshold.

- Survey first, and reuse the dataset for design, permit packages and construction planning.
  ([Fiber Broadband Association](https://fiberbroadband.org/resources/building-better-broadband-accelerating-designs-securing-permit-approvals-chapter-two-fielding-and-base-mapping/))
- Permits are often the slowest step and they expire, so they are pulled close to construction
  start. ([NTIA grantee report](https://www2.ntia.gov/sites/default/files/grantees/nt10bix5570039_opencape_corporation_ppr2013_q2.pdf))
- Procurement and permits are separate gates; crews mobilise only when both are in hand.
- Acceptance is evidence-based: OTDR traces with pass/fail thresholds, loss measured against the
  design budget, raw trace files and an exceptions list.
  ([acceptance checklist](https://broadbandbreakfast.com/jonathan-romeiro-the-ftth-acceptance-checklist-bead-projects-should-require/))
- As-built is the stage most often neglected; splice records should cross-reference OTDR events
  and GIS features. ([3-GIS](https://blog.3-gis.com/blog/navigating-the-stages-of-fibre-network-rollout))
- Billing ties each invoice to completed work, carries the running retention total, and the
  defect-liability end date must be recorded or the final retention invoice is forgotten.
  ([Zigaflow DLP workflow](https://www.zigaflow.com/workflows/construction-managing-practical-completion-and-dlp),
  [Procore](https://procore.com/library/construction-progress-billing))

## 3. Gaps found in the current system

| # | Gap | Where | Impact |
|---|---|---|---|
| G1 | **Done:** completing a stage starts the next one and now notifies its owner (`WorkflowNotificationService`). Before this, nobody was told. | `WorkflowEngine.transitionStage` (`src/services/core/WorkflowEngine.ts`, next-stage block) | The next owner learns by being phoned. This is the main problem you described. |
| G2 | **Done:** approval levels now notify the next approver, review submit/decision notify the reviewer, submitter and next stage owner. Before this, approvals waited until someone opened the project. | `WorkflowEngine.submitApproval` | An approval waits until someone opens the project. |
| G3 | Project status and workflow stage are two sources of truth. `ProjectStatus` has no value for permit, implementation, as-built or invoicing, and is written by many services. | `prisma/schema/enums.prisma`, survey/BOQ/PAT services | Dashboards that read status disagree with the stage tracker. |
| G4 | Permit expiry date is stored but nothing warns before it lapses. | `project-permit.service.ts` | Permits can expire during construction. |
| G5 | The production template's acceptance stages check "PAT passed" only; the OTDR checklist exists only in the older template. | `prisma/seed-workflows.ts` | Acceptance does not require OTDR evidence or a loss-budget comparison. |
| G6 | `defectLiabilityEnd` is recorded but nothing reminds finance when it arrives. | `project-retention.service.ts` | Final retention release can be missed. |
| G7 | **Done:** task, supervisor and finance assignment notifications; invoice hand-off notifications; finance work queue; overdue invoice reminder; task due-date reminder fixed. | see earlier changes | - |

## 4. Recommended target flow

Every stage has an owner role, an automatic hand-off, and an exit gate. Rule: **finishing a stage
notifies the next stage's owner and puts the work in their queue; nobody should have to call.**

| Stage | Notified when it starts | Exit gate (add or keep) | Reminder / SLA |
|---|---|---|---|
| Requirements, survey | Surveyor / supervisor | survey evidence uploaded | survey overdue |
| Design, CAD, reviews | Designer, then reviewer | review approved, rework loop closes | review waiting > 2 days |
| BOQ + approval | Each approval level in turn | all three levels approved | approval waiting > 2 days |
| Work packages | OSP manager | every child task has a contractor | - |
| Permit & access | Area manager | permit approved, **expiry date set** | expiry in 30 / 7 days |
| Implementation | Contractor supervisor | evidence uploaded, tasks complete | task due in 48 h (**done**) |
| In-house PAT | QC officer | **OTDR traces within limits** | - |
| SLT PAT | Area manager, then OSP manager | acceptance recorded | - |
| As-built | Engineer, then area manager | GIS + CAD approved | - |
| Invoice submission, follow-up | Finance roles (**done**) | invoice issued, submitted, paid | overdue daily (**done**) |
| DLP and retention | Finance lead | defects cleared, certificate | **reminder at `defectLiabilityEnd`** |
| Closure | Project manager | existing closure checks | - |

## 5. Suggested order of work

1. **G1 and G2**: notify the next stage owner and each approval level from the workflow engine,
   resolved from the stage's `assignmentRole` within the project's OPMC scope, deduplicated per
   stage. This is the biggest win and touches one service.
2. **G4 and G6**: two scheduler reminders (permit expiry, DLP end), notification only.
3. **G5**: add an OTDR evidence checklist to the in-house PAT stage of the production template
   (changes the workflow definition, so projects already running are unaffected unless migrated).
4. **G3**: derive the displayed project status from the current stage instead of keeping both.
   Largest change; needs a decision on the status list first.

Open questions for the business: who owns survey, design and CAD stages (the template leaves the
owner role empty for stages 1-8); the review SLA in days; and the permit warning window.

## 6. "What to do next" queue (done)

A notification says something happened; it did not say what to do. A live UI run showed the supervisor
got "Assigned to a Project", opened My Tasks and found it empty. `/projects/my-tasks` now has a
**What to do next** section, derived from live state by `ProjectNextActionService` (nothing stored):

| Who | Sees | Until |
|---|---|---|
| Project supervisor | "Waiting for BOQ approval", then "Start the task plan", then "Finish the task plan" | plan is approved |
| User with project write | "Assign a project supervisor" for in-scope projects with none | a supervisor is assigned |
| User with plan approve | "Review and approve the task plan" (not their own plan, BOQ approved) | plan is approved |
| Assigned approver | "Approve: <request>" once earlier steps are approved | step actioned |
| Stage owner (named user or role) | "Complete stage N: <name>" | stage is completed |

Supervisor and finance assignment notifications now state the next step and open My Tasks.

### Gap closure (2026-11-04)

| Gap | Now |
|---|---|
| Manager never told a plan was ready | **Done:** supervisor clicks *Submit for approval* (status SUBMITTED), project managers are notified; approve queue shows SUBMITTED plans only |
| BOQ 3-level approval notified nobody | **Done:** each level's eligible roles are notified in turn, and the supervisor when the BOQ is fully approved |
| Document approvals broadcast to ADMINISTRATORS (~250 people) | **Done:** only holders of the step's role in the project's OPMC; managers if none |
| G4 permit expiry, G6 DLP end | **Done:** `ProjectDeadlineReminderService` (30/7 days then daily once expired; DLP weekly from 14 days before) |
| Stale approvals / plans | **Done:** nudge after 2 days, once a day |
| Reminders never ran (nothing in the repo called the scheduler) | **Done:** worker daily job `PROJECT_REMINDERS` at 07:30 Asia/Colombo |
| No count on the sidebar | **Done:** My Tasks badge (60 s cache) |
| Error toasts crashed pages (object rendered as a React child) | **Done:** `toErrorText` on 34 call sites |
| Invoice numbers raced; wastage / cycle-count wrote non-UUID reference ids | **Done:** numbering under an advisory lock; ids are UUIDs |

Still needs a business decision, not code: owner roles for stages 1-8 (template leaves them empty), whether the BOQ
should price existing poles/joints as supply, the OTDR evidence gate for in-house PAT (G5, changes the workflow
template), and unifying project status with workflow stage (G3).
