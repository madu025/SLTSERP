# SLTSERP Project Management Module: Complete Technical Documentation

## 1. Overview
The Project Management Module is a comprehensive system for telecom construction (OSP FTTH, Cluster, Building Fiber). It manages the full lifecycle from planning/estimation through execution and closure.

Key behaviors:
- **Dynamic UI tabs** are driven by workflow stage using `src/config/stage-tab-mapping.ts`.
- **Workflow / pipeline stage-gates** are tracked and advanced by backend workflow endpoints + `src/services/WorkflowEngine.ts`.
- **Permits / wayleaves** are managed as `projectPermit` records with links to `permitType` and its `authority`.

## 2. Core Architecture
- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL (via Prisma ORM)
- **Design:** Service–Repository-style architecture (services orchestrate Prisma operations)
- **Dynamic Tab System:** Stage-based dynamic tab visibility controlled by `src/config/stage-tab-mapping.ts`

## 3. Workflow Types (Project Types)
The module supports different workflow stage templates depending on the **Project Type**:
1. **SSD (Standard Service Delivery)**
2. **Cluster**
3. **Building Fiber**

Stage count varies by project type; concrete stage instances are cloned from active templates by `WorkflowEngine.initializeProjectWorkflow()`.

## 4. Pipeline / Workflow Pipeline / Stage Gates (Backend + UI contract)

### 4.1 Always-visible tabs (UI contract)
Tabs are determined by `getTabsForStage(stageName)`:
- `ALWAYS_VISIBLE_TABS` are always included:
  - `overview`
  - `workflow-pipeline`

### 4.2 Stage-specific tab mapping (how UI is computed)
- Stage names are normalized with `stageName.toLowerCase().trim()`.
- If a mapping exists in `STAGE_TAB_MAPPING`, UI returns:
  - `[..., ...ALWAYS_VISIBLE_TABS, ...mappedTabs]`
- Otherwise, it falls back to `getDefaultTabs()` (contains a broader superset such as `permits`, `gis`, `survey`, `otdr`, `hse`, `evm`, etc.).

> Practical implication: documentation should not hardcode a single “stage → tab” table; instead, it must reference the actual mapping source (`stage-tab-mapping.ts`) and the known primary tab values.

### 4.3 Workflow API: fetch / auto-initialize workflow instance
**GET** `/api/projects/[id]/workflow`

Backend behavior:
- Tries to fetch `projectWorkflowInstance` by `projectId`.
- If missing, it **auto-initializes**:
  - Reads the project’s `projectTypeId` from `prisma.project`
  - If `projectTypeId` is missing, attempts to select the first `projectType` (`findFirst`)
  - Calls `WorkflowEngine.initializeProjectWorkflow(projectId, projectTypeId)`
- Returns the workflow instance including:
  - `stages` ordered by `sequence asc`
  - each stage includes `tasks`, `checklists`, `approvals`

If still missing after auto-init, returns:
- `404`: `{ error: 'No active workflow found and could not auto-initialize' }`

### 4.4 Workflow API: manual initialization
**POST** `/api/projects/[id]/workflow`

Body:
- `{ projectTypeId: string }`

Behavior:
- Rejects if `projectWorkflowInstance` already exists for the project:
  - `400`: `{ error: 'Workflow already initialized for this project' }`
- Otherwise calls `WorkflowEngine.initializeProjectWorkflow(id, projectTypeId)`.

### 4.5 Stage transitions (stage-gates progression)
**POST** `/api/projects/[id]/workflow/stages`

Body:
- `{ stageId: string, status: string, userId: string }`

Behavior in `WorkflowEngine.transitionStage(stageId, nextStatus, userId)`:
- Loads the stage instance by `stageId`; throws if not found.
- If `nextStatus === 'COMPLETED'`, it enforces gate validation:
  1. **Tasks gate:** all stage tasks must be `COMPLETED`
  2. **Checklist gate:** mandatory checklist items must have `isCompleted=true` (when `stage.reqChecklist` is enabled)
  3. **Photo gate:** when `stage.reqPhotos` is enabled, mandatory checklist items must have `photoUrl`
  4. **Approval gate:** when `stage.reqApproval` is enabled, all stage approvals must have `status === 'APPROVED'`

On successful completion:
- Updates the current stage:
  - `status: 'COMPLETED'`
  - `actualFinish: new Date()`
- Logs audit entry to `workflowAuditLog` with:
  - `action: 'STAGE_COMPLETED'`
- Activates the next stage in sequence:
  - finds stage with `sequence = current.sequence + 1` under same `projectWorkflowInstanceId`
  - updates next stage:
    - `status: 'IN_PROGRESS'`
    - `actualStart: new Date()`
  - updates `projectWorkflowInstance.currentStageId` to the next stage
  - logs audit entry:
    - `action: 'STAGE_STARTED'`
- Updates project progress via `updateProjectProgressOnStageChange(projectId)`.

If `nextStatus !== 'COMPLETED'`:
- It performs a manual status update (e.g. `BLOCKED`, `ON_HOLD`, etc.)
- Logs audit entry with:
  - `action: STAGE_STATUS_SET_<NEXTSTATUS>`

## 5. Stage-by-Stage Tab Mapping (actual mapping highlights)

Primary tab categories that appear across mappings:
- Survey: `survey`, `gis`, `documents`, `risks`
- Permits/Wayleaves: `permits`, `documents`, `approvals`
- Material: `boq`, `materials`, `procurement`, `finance`, `documents`
- Installation: `tasks`, `resources`, `contractor`, `hse`, plus specialized tabs like `field-tasks` and `expenses`
- Testing / OTDR: `otdr`, `qa`, `documents`
- QA/QC / Commissioning: `qa`, `commissioning`, `kpis`, `documents`
- Handover / Closure: `closure`, `assets`, `commissioning`, `kpis`, `finance`, plus `documents` (note: `evm` only appears in specific stage aliases that map to the `evm` tab, e.g. `handover & asset registration` for Cluster)

Examples of stage-name aliases that drive mappings (from `STAGE_TAB_MAPPING`):
- `survey`
- `survey & feasibility`, `survey & route planning`, `building survey`
- `permit acquisition`, `permit management`, `permit & access`
- `material issuance`, `material procurement`
- `installation & cabling`, `civil works`, `cabling & splicing`, `riser & horizontal cabling`, `splicing & termination`
- `testing & otdr`, `otdr testing`, `testing`
- `qa/qc inspection`, `qa/qc & commissioning`, `qa/qc`
- `handover & closure`, `handover & asset registration`, `handover`

> Note: documentation previously listed a simplified stage set; real UI uses many alias stage names that map to different subsets of tab values.

## 6. Detailed Module Breakdown

### 6.1 Permits / Wayleaves (projectPermit)
**Core model:**
- `projectPermit` (tracks permit applications)

Key relations:
- `projectPermit.permitType` (includes `authority`)
- the API response includes counts via `_count`:
  - `_count.permitDocuments`
  - `_count.approvalSteps`

Terminology fix:
- The code uses **“Permits” and “Authority”** through the `permitType.authority` relationship.
- “Wayleaves” are represented as part of permit/wayleave management in the UI tab description (`Permits` tab label/description).

### 6.2 GIS & BOQ
- `GIS Route` concepts are represented by the `gis` tab (see `STAGE_TAB_MAPPING`)
- Generated BOQ flows are supported through GIS-derived data → `BOQ & Material` tab (`boq` / `materials` / `procurement`)

### 6.3 Inventory Integration
- Stock movement / returns are represented by the dedicated inventory flow(s) used by tasks in relevant stages (tabs include `tasks`, `resources`, `documents` depending on mapping).

### 6.4 Financial & Analytics
- `EVM` (Earned Value Management) appears as tab value `evm`
- `Finance` appears as tab value `finance`
- `KPIs` appears as tab value `kpis`

## 7. API Reference (workflow + permits)

### 7.1 Project (entry point)
- `GET /api/projects/[id]`: Project full state (project + related instances)

### 7.2 Workflow / Pipeline / Stage Gates
- `GET /api/projects/[id]/workflow`
  - Fetch workflow instance, auto-initialize if missing
- `POST /api/projects/[id]/workflow`
  - Initialize workflow instance (requires `projectTypeId`)
- `POST /api/projects/[id]/workflow/stages`
  - Transition stage status (gate completion enforces tasks/checklists/photos/approvals)

### 7.3 Permits / Wayleaves
- `GET /api/projects/[id]/permits?status=<STATUS>`
  - Optional `status` query parameter filters `projectPermit.status`
  - Includes:
    - `permitType.authority` (`id`, `name`, `shortName`)
    - `_count.permitDocuments`, `_count.approvalSteps`
  - Ordered by `createdAt desc`

- `POST /api/projects/[id]/permits`
  - Creates a new `projectPermit` with `status: "DRAFT"`
  - Body fields observed in code:
    - `permitTypeId` (**required**)
    - `applicationDate` (optional; parsed to `Date`)
    - `cost` (optional; parsed to `float`)
    - `remarks` (optional)
    - `appliedById` (optional)
  - Response includes `permitType.authority` details

## 8. Agent Knowledge Base (operational guidance)
- **To advance a stage gate:**
  - UI triggers the stage transition endpoint; backend enforces:
    - tasks completion
    - mandatory checklist completion (+ optional mandatory photoUrl)
    - approvals sign-off (if required by stage)
  - Endpoint: `POST /api/projects/[id]/workflow/stages`

- **To view current pipeline state:**
  - Endpoint: `GET /api/projects/[id]/workflow`
  - Note: it auto-initializes workflow instance from active template if missing.

- **To view permits / approvals context:**
  - Endpoint:
    - `GET /api/projects/[id]/permits?status=<...>`
  - Create new permits as draft:
    - `POST /api/projects/[id]/permits` (status starts as `DRAFT`)

- **Troubleshooting UI tab mismatches:**
  - Always verify that stage names (lowercase/trimmed) match keys in `src/config/stage-tab-mapping.ts`.
  - If stage name has no mapping, the UI falls back to `getDefaultTabs()`.