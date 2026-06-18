# SLTSERP Project Details Page: Full Tab-by-Tab Role-Based Technical & Functional Audit
**Audit Date:** June 18, 2026  
**Document Version:** 1.0.0  
**Target File:** `src/app/projects/[id]/page.tsx`  
**Focus Roles:** Project Manager (PM), Senior Software Architect & Automation Engineer, GIS Engineer/Surveyor, Logistics Manager, QA/QC Inspector, Contractor/Field Supervisor, and Project Accountant.

---

## 1. Executive Summary & Context

This comprehensive audit evaluates the Project Details Page (`src/app/projects/[id]/page.tsx`) in SLTSERP. The SLTSERP is designed to manage complex telecom infrastructure projects (such as OSP, FTTH, Cluster, and Building Fiber) throughout their full engineering, procurement, construction, and handover lifecycle. 

The Project Details Page is the core workspace of the application. It aggregates **29 functional tab components** and dynamically controls their visibility using a stage-gate mapping engine. The purpose of this audit is to conduct a highly thorough, technical, and functional analysis of every single tab, evaluating:
1. **Functional alignment** with the targeted role.
2. **Technical robustness** (APIs, state management, Prisma schemas, transaction boundaries, and security).
3. **Automation capability** (integrating individual tab actions to automatically drive project-level progress, financial calculations, and stage transitions).

---

## 2. Global Core Architecture Audit

### 2.1 Dynamic Tab Visibility Mapping
The tab routing is controlled by `src/config/stage-tab-mapping.ts` and resolved on the client-side in the `ProjectDetailsPage` component using:
```typescript
const visibleTabs = useMemo(() => {
    if (!project?.workflowInstance?.currentStage?.name) {
        return getDefaultTabs(); // Superset fallback
    }
    return getTabsForStage(project.workflowInstance.currentStage.name);
}, [project]);
```
#### Architectural Critique:
* **Pros:** Excellent declarative design that reduces UI clutter. Prevents field supervisors or logistics teams from seeing irrelevant modules during planning or closing phases.
* **Cons:** Hardcoded mapping structures make workflow customization brittle. Any changes to workflow templates in the DB require a corresponding update to `STAGE_TAB_MAPPING` strings.
* **Security Gaps:** Visibility is managed purely in the frontend. There are no backend middleware or API restrictions preventing a direct REST API call to `/api/projects/[id]/materials` or `/api/projects/[id]/expenses` even if that stage is closed or hidden for the current user's role.

### 2.2 Global State Management & API Performance
* **Single Page Data Fetching:** `fetchProjectDetails()` retrieves a massive nested project object (`/api/projects/${id}`) on load. This triggers database joins across `workflowInstance`, `stages`, `opmc`, `contractor`, and others.
* **Over-fetching & Query Bloat:** As projects grow in complexity, fetching a single massive JSON tree impacts Time-To-Interactive (TTI). GIs route data, BOQ lines, and task lists should be paginated or loaded lazily when switching to their respective tabs, rather than pre-fetched globally.
* **React Re-renders:** Every dynamic dialog (Edit Details, Guide Dialog) mutates state at the top-level page component, causing a full re-render of all 29 registered tabs, regardless of whether they are active.

---

## 3. Section-by-Section Dynamic Tab Audits

Here is the exhaustive, tab-by-tab evaluation of all 29 tabs registered in `TAB_COMPONENTS`.

---

### Tab 1: Overview (`overview` - Component: `ProjectOverview`)
* **Role Focus:** Project Manager, Executive Sponsor
* **Functional Evaluation (PM):** 
  Provides high-level project metadata, OPMC association, contractor metadata, and timeline summaries.
  * *Gaps:* Crucial KPIs (such as Schedule Variance or Cost Performance Index) are missing. Status updates are manual and disconnected from live field tasks.
* **Technical Evaluation (Architect):**
  Renders static metadata. Relies on the initial large payload.
  * *Data Flow:* Purely read-only via `project` props.
  * *Security:* Viewable by anyone with read access to the project.
  * *Automation Potential:* This dashboard should auto-compile its widgets by querying aggregated child services (EVM, BOQ, Milestones) rather than reading flat fields on the `Project` model.

---

### Tab 2: Workflow Pipeline (`workflow-pipeline` - Component: `ProjectWorkflowTracker`)
* **Role Focus:** Project Manager, QA/QC Inspector
* **Functional Evaluation (PM):**
  Tracks active workflow stages, checklist statuses, and stage-gate progression. Enforces constraints before transitioning stages (e.g., forcing task completion).
  * *Gaps:* No visual dependency Gantt charting or interactive blocker/risk paths.
* **Technical Evaluation (Architect):**
  Communicates with `/api/projects/[id]/workflow/stages` for transitions.
  * *Data Flow:* Triggers a POST request to transition stages which in turn calls `WorkflowEngine.transitionStage()`.
  * *Atomicity:* Uses Prisma transactions in the backend engine to ensure that stage-gate completion, audit logs, and next-stage activation happen atomically.
  * *Security:* Lacks a strict role check. Any client can trigger a stage transition if they know the stage ID.
  * *Automation Potential:* Successfully integrates with `project-progress.ts` to trigger a project-level progress calculation upon stage completion.

---

### Tab 3: Permits & Wayleaves (`permits` - Component: `ProjectPermits`)
* **Role Focus:** Project Manager, Wayleave Officer, Surveyor
* **Functional Evaluation (PM & Wayleave Officer):**
  Tracks statutory permits (Municipal, RDA, CEB, LECO, Forest Dept) needed for telecom trenching and cabling. Manages document upload counts and approval steps.
  * *Gaps:* Lacks real-time push notifications or reminders when permit expiry dates approach. No financial integration to link permit fees automatically to overall expenses.
* **Technical Evaluation (Architect):**
  Integrates with `/api/projects/[id]/permits`.
  * *Data Flow:* GET retrieves permits, and POST creates DRAFT permits.
  * *Schema Gaps:* The `projectPermit` model represents permit documents and approval steps purely as count relations (`_count.permitDocuments`), which limits detail without fetching individual files.
  * *Automation Potential:* Transitioning the "Permit Acquisition" stage to COMPLETED should be blocked programmatically until all mandatory permits in this tab have `status === 'APPROVED'`.

---

### Tab 4: GIS Route (`gis` - Component: `ProjectGISRoute`)
* **Role Focus:** GIS Engineer, Surveyor
* **Functional Evaluation (GIS):**
  Visualizes route alignments, pole locations, FDP positions, and cable paths. Supports geo-spatial coordinate plotting and GeoJSON/KML processing.
  * *Gaps:* Does not support real-time redlining (field markups) directly inside the map component to record as-built variations.
* **Technical Evaluation (Architect):**
  Interacts with GIS routing backend.
  * *Performance:* Leaflet or Mapbox rendering can freeze the browser if rendering raw files exceeding 20MB directly in client state.
  * *Automation Potential:* Parse uploaded GeoJSON to dynamically populate the `BOQ & Material` tab (e.g., calculating required cable meters based on route length + 10% splicing slack).

---

### Tab 5: Site Survey (`survey` - Component: `ProjectSurvey`)
* **Role Focus:** Surveyor, Field Supervisor
* **Functional Evaluation (Surveyor):**
  Captures field measurements, structure types, soil classification (rock, soft, concrete), and physical obstructions.
  * *Gaps:* Missing offline data collection capabilities in the UI, forcing survey teams to use paper or third-party apps in poor coverage areas.
* **Technical Evaluation (Architect):**
  * *Schema Gaps:* Relies on flat database text fields. Needs structured dynamic forms for different survey templates (e.g., overhead vs underground).
  * *Automation Potential:* Soil classification inputs should automatically adjust the standard labor rate and material costs in the BOQ (e.g., digging rock costs 3x more than soft soil).

---

### Tab 6: OTDR Testing (`otdr` - Component: `ProjectOTDR`)
* **Role Focus:** QA/QC Inspector, Fiber Splicer
* **Functional Evaluation (Inspector):**
  Captures Optical Time-Domain Reflectometer (OTDR) fiber traces, testing wavelengths (1310/1550nm), connector attenuation, and split loss.
  * *Gaps:* Missing automated trace (.SOR file) parsing. Users must manually type loss values instead of uploading raw measurement files.
* **Technical Evaluation (Architect):**
  * *Data Gaps:* Missing binary blob storage references in Prisma schemas for raw `.sor` file payloads.
  * *Automation Potential:* OTDR test results must automatically populate the QA checklist. A single failed fiber test should block the stage-gate transition to Network Commissioning.

---

### Tab 7: Health, Safety & Environment (`hse` - Component: `ProjectHSE`)
* **Role Focus:** HSE Officer, Field Supervisor
* **Functional Evaluation (HSE Officer):**
  Tracks safety audits, toolbox talk logs, PPE compliance, and incident reports.
  * *Gaps:* Lacks corrective action tracking (CAPA) with assigned owners and automated email escalations.
* **Technical Evaluation (Architect):**
  * *State Management:* Highly disconnected from other active workflows. Written mostly as static forms.
  * *Automation Potential:* An open critical HSE incident should automatically block the Project Manager from advancing any active workflow stages in the "Workflow Pipeline" tab.

---

### Tab 8: Contractor Performance (`contractor-perf` - Component: `ProjectContractorPerformance`)
* **Role Focus:** Project Manager, Procurement Controller
* **Functional Evaluation (PM):**
  Evaluates subcontractor metrics: schedule adherence, quality of workmanship, and safety performance.
  * *Gaps:* Scores are based on manual entry rather than objective metrics.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* Generate scorecards automatically by querying:
    1. Average delay in completed tasks (`actualFinish - endDate`).
    2. QA reinspection rates (rejection count / total QA audits).
    3. HSE incident records.

---

### Tab 9: Earned Value Management (`evm` - Component: `ProjectEVM`)
* **Role Focus:** Project Manager, Finance Controller
* **Functional Evaluation (PM):**
  Computes Planned Value (PV), Earned Value (EV), and Actual Cost (AC) to track project variance (Schedule Variance, Cost Variance) and performance indices (SPI, CPI).
  * *Gaps:* Rendered using mock values. No live calculation query integrates the database variables to generate these values.
* **Technical Evaluation (Architect):**
  * *Calculations:* EVM must run calculations inside a background cron job or database view.
    * $PV = \text{Sum of planned costs of all tasks scheduled to date}$.
    * $EV = \text{Sum of planned costs of completed tasks}$.
    * $AC = \text{StockIssue costs + approved expenses + timesheets}$.
  * *Automation Potential:* Needs a dedicated backend service to write historical daily logs of PV, EV, and AC to render EVM trend lines over time.

---

### Tab 10: Asset Register (`assets` - Component: `ProjectAssetRegister`)
* **Role Focus:** GIS Engineer, Network Operations (NOC)
* **Functional Evaluation (Asset Manager):**
  Registers newly built physical assets (Poles, Splitters, FDCs, OLT Ports) into the SLT Core Network inventory system.
  * *Gaps:* Lacks automated GIS-to-Asset linkage. Handover is manual.
* **Technical Evaluation (Architect):**
  * *Data Flow:* Requires strict synchronization with external telecom GIS systems.
  * *Automation Potential:* On stage "Closure" completion, an automated script should parse the project's GISRoute and export asset records directly to the Core Network Inventory API.

---

### Tab 11: Variation Orders (`variations` - Component: `ProjectVariationOrders`)
* **Role Focus:** Project Manager, Client Representative
* **Functional Evaluation (PM):**
  Tracks changes in scope (such as extra cable distance or pole relocations) requiring formal client approval for cost adjustments.
  * *Gaps:* Lacks an integrated approval workflow that adjusts the parent project budget automatically when approved.
* **Technical Evaluation (Architect):**
  * *Schema Gaps:* Variation items are often saved as raw descriptions. They need structured links to the Inventory BOQ items.
  * *Automation Potential:* Upon approval, variations should automatically append new rows to the `ProjectBOQ` model and increment the project's `budget` field.

---

### Tab 12: BOQ & Materials (`boq` - Component: `ProjectBOQ`)
* **Role Focus:** Logistics Manager, Project Manager
* **Functional Evaluation (Logistics Manager):**
  Lists all required materials, estimated quantities, unit rates, and current actual consumption.
  * *Audit Result:* **Excellent UI/UX.** The SearchableItemSelect and auto-calculations of amount and actual cost work smoothly.
* **Technical Evaluation (Architect):**
  * *APIs:* Supports standard CRUD operations under `/api/projects/boq`.
  * *Calculations:* Correctly calculates planned cost and reads actual cost from associated approved material issues.
  * *Automation Potential:* This tab is the primary source of truth for the project's planned cost. The sum of all BOQ items should dynamically update the `project.budget` field.

---

### Tab 13: Material Issues (`materials` - Component: `ProjectMaterialIssues`)
* **Role Focus:** Stores Officer, Contractor Representative
* **Functional Evaluation (Logistics Manager):**
  Tracks material requests, approvals, and physical stock issuance from warehouses to the field team.
  * *Audit Result:* **Critical Security Risk Detected!** The API `/api/projects/stock-issue` handles stock deductions correctly but contains a major authorization bypass.
* **Technical Evaluation (Architect):**
  * *The Security Bug:*
    In `/api/projects/stock-issue/route.ts` (line 10), the code grabs the issuer using:
    `const issuer = await prisma.user.findFirst();`
    This bypasses session validation entirely, attributing all stock issues to the first user in the database.
  * *The Fix:* Replace this with the active session user obtained from the authentication middleware (e.g., NextAuth session).
  * *Atomicity:* Uses Prisma transaction logic in `stock-issue/approve` to deduct warehouse stock and increment project actual costs simultaneously.

---

### Tab 14: Project Milestones (`milestones` - Component: `ProjectMilestones`)
* **Role Focus:** Project Manager, Client Representative
* **Functional Evaluation (PM):**
  Tracks high-level milestones (e.g., "Survey Complete," "Splicing 50%," "FAT Testing").
  * *Gaps:* Milestones are updated manually and are completely decoupled from active field tasks and workflow stages.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* Milestones should be driven by stage gates. For example, completing the "otdr testing" stage-gate in the workflow pipeline should automatically toggle the "OTDR Testing Completed" milestone to true.

---

### Tab 15: Expenses (`expenses` - Component: `ProjectExpenses`)
* **Role Focus:** Project Accountant, PM
* **Functional Evaluation (Accountant):**
  Tracks miscellaneous field costs: food, lodging, transport, petty cash, and local labor payments.
  * *Gaps:* These expenses are completely ignored when calculating `project.actualCost`.
* **Technical Evaluation (Architect):**
  * *The Cost Leakage Gap:*
    Currently, `project.actualCost` is updated **only** during material issue approvals (`/api/projects/stock-issue/approve`). Miscellaneous expenses are left as isolated rows in the database, leading to inaccurate financial reporting.
  * *Automation Potential:* Approving an expense record must run a transaction that increments the parent project's `actualCost` and recalculates `variance`.

---

### Tab 16: Project Tasks (`tasks` - Component: `ProjectTasks`)
* **Role Focus:** PM, Contractor Supervisor
* **Functional Evaluation (PM):**
  Manages detailed project execution tasks (e.g., "Lay 500m optical cable," "Mount OTB box").
  * *Gaps:* Gaps exist in task dependencies. You can mark "Splicing" as complete before "Cabling" is started.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* Task completion rates should directly influence the project's progress calculation.
    $\text{Progress Contribution} = \left(\frac{\text{Completed Tasks}}{\text{Total Tasks}}\right) \times \text{Weight of Stage}$.

---

### Tab 17: Resources (`resources` - Component: `ProjectResources`)
* **Role Focus:** PM, Resource Scheduler
* **Functional Evaluation (PM):**
  Manages the assignment of critical human and physical assets: fusion splicers, OTDR machines, specialized crew vans, and field engineers.
  * *Gaps:* No resource scheduling engine or calendar view. There is no automated conflict checking (e.g., assigning the same OTDR machine to three different projects on the same day).
* **Technical Evaluation (Architect):**
  * *Schema Gaps:* Resources are often assigned as flat metadata. Needs structured foreign-key relationships to `User` and `FleetAsset` models to enforce allocation rules.

---

### Tab 18: Project Documents (`documents` - Component: `ProjectDocuments`)
* **Role Focus:** All Stakeholders
* **Functional Evaluation:**
  Centralized document repository for civil drawings, permits, survey sheets, fiber layouts, and completion certificates.
  * *Gaps:* Lacks automatic folder structuring or OCR (optical character recognition) parsing for uploaded wayleaves/permits.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* Documents uploaded to support stage-gate checklist requirements must be programmatically linked to the corresponding workflow stage.

---

### Tab 19: Approvals (`approvals` - Component: `ProjectApprovals`)
* **Role Focus:** Wayleave Officer, Regional Manager, PM
* **Functional Evaluation (PM):**
  Tracks formal internal sign-offs required during the project lifecycle.
  * *Gaps:* Relies on manual notifications; lacks automated escalation policies if an approval sits in a queue for more than 48 hours.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* Tie these approval records to active stage-gates in the `WorkflowEngine` so that a stage-gate cannot be completed until its approval list is signed off.

---

### Tab 20: Risks (`risks` - Component: `ProjectRisks`)
* **Role Focus:** PM, Risk Officer
* **Functional Evaluation (PM):**
  Logs project risks (e.g., severe weather, delayed permits, utility damage), classifying their likelihood and impact to calculate a severity score.
  * *Gaps:* Completely static log. No mitigation actions are tied to actual tasks or calendars.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* When a risk occurs (e.g., "RDA permit delay" goes active), it should flag a warning indicator on the project dashboard and mark the dependent workflow stage as BLOCKED.

---

### Tab 21: Quality Assurance (`qa` - Component: `ProjectQA`)
* **Role Focus:** QA/QC Inspector
* **Functional Evaluation (Inspector):**
  Field inspection checklist engine. Tracks non-conformance reports (NCRs) and coordinates corrective actions.
  * *Gaps:* Lacks visual pin drops on the GIS route map to show exactly where a physical defect was detected.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* A raised and unresolved NCR must dynamically lock the "otdr testing" or "qa" stage transition in the `WorkflowEngine`.

---

### Tab 22: Contractor Portal (`contractor` - Component: `ProjectContractors`)
* **Role Focus:** Contractor Supervisor
* **Functional Evaluation (Contractor):**
  Subcontractor portal to view work orders, check material allocations, and request tool issuances.
  * *Gaps:* Contractor view is not segregated; supervisors can see sensitive project-wide financial margins.
* **Technical Evaluation (Architect):**
  * *Security Gap:* Requires rigorous tenant isolation to ensure that logged-in contractor accounts can only query data associated with their assigned `contractorId`.

---

### Tab 23: Commissioning (`commissioning` - Component: `ProjectCommissioning`)
* **Role Focus:** Commissioning Engineer, NOC Team
* **Functional Evaluation (Engineer):**
  Tracks optical light path activation, OLT port alignments, subscriber loop validation, and final handover to operations.
  * *Gaps:* Handover documentation must be typed manually instead of pulling configuration values from QGIS assets.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* Commissioning completion must automatically change the overall project status to 'COMPLETED' in the main table.

---

### Tab 24: KPIs (`kpis` - Component: `ProjectKPIs`)
* **Role Focus:** Executive Sponsor, PM
* **Functional Evaluation (PM):**
  Displays performance metrics: schedule variance, cost efficiency, QA pass rates, and material wastage ratios.
  * *Audit Result:* **Mock Dashboard.** ALL graphs and widgets are built with static client state.
* **Technical Evaluation (Architect):**
  * *The Fix:* Must fetch aggregates from a dedicated project stats API `/api/projects/[id]/kpis` instead of using static React states.

---

### Tab 25: Procurement (`procurement` - Component: `ProjectProcurement`)
* **Role Focus:** Materials Controller, Buyer
* **Functional Evaluation (Logistics):**
  Tracks Purchase Orders (POs), material RFQs, and supplier delivery schedules.
  * *Gaps:* Completely disconnected from BOQ deficits.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* The procurement module should automatically highlight items in red when BOQ requirements exceed warehouse stock availability.

---

### Tab 26: Project Finance (`finance` - Component: `ProjectFinance`)
* **Role Focus:** Project Accountant, CFO
* **Functional Evaluation (Accountant):**
  High-level financial ledger: total estimated budget, material expenses, contractor payments, payment vouchers, and overall profit margin.
  * *Audit Result:* **High Risk.** Financial numbers are calculated on the client side, which is prone to rounding mismatches and lacks transaction-level audit trails.
* **Technical Evaluation (Architect):**
  * *The Fix:* Financial metrics must be processed in the database layer. Calculations must follow strict double-entry principles on invoice and stock issue tables.

---

### Tab 27: Closure & Handover (`closure` - Component: `ProjectClosure`)
* **Role Focus:** PM, Client Representative
* **Functional Evaluation (PM):**
  Handles formal closeout: final bill validation, as-built drawing approval, PAT (Provisional Acceptance Testing) sign-off, and customer handover.
  * *Gaps:* No automated asset transfer tool.
* **Technical Evaluation (Architect):**
  * *Automation Potential:* Completing the "Closure" stage should automatically lock the database records, preventing any further material issues or expense logs on the project.

---

### Tab 28: Field Tasks (`field-tasks` - Component: `ProjectFieldTasks`)
* **Role Focus:** Contractor Supervisor, Field Technician
* **Functional Evaluation (Field Technician):**
  Field workforce task tracker. Technicians upload completion photos, report fiber lengths, and request safety sign-offs.
  * *Gaps:* Lacks real-time offline synchronization.
* **Technical Evaluation (Architect):**
  * *API Integration:* Needs strict payload size compression to handle multiple image uploads from mobile connections in the field.

---

### Tab 29: Documentation / Guide (`guide` - Component: `ProjectDocumentation`)
* **Role Focus:** System Administrator, Onboarding Users
* **Functional Evaluation (All Users):**
  Quick-reference documentation explaining SLTSERP workflow policies, stage gate criteria, and system procedures.
  * *Pros:* Easily accessible directly in the project details view. Very helpful for user training.

---

## 4. Architectural Summary of Critical Gaps & Bugs

| Severity | Issue Description | Location | Core Technical Cause | Proposed Solution |
|---|---|---|---|---|
| **🔴 CRITICAL** | **Warehouse Stock Issue Authorization Bypass** | `/api/projects/stock-issue/route.ts` | The API defaults to the first user found in the DB (`findFirst`) instead of pulling the authenticated session user. | Integrate NextAuth session extraction to populate `issuerId`. |
| **🔴 CRITICAL** | **Mock Dashboards** | `/projects/dashboards/*` | Core metrics are hardcoded static data structures. | Replace states with fetch hooks pointing to `/api/dashboard/project-stats`. |
| **🟡 HIGH** | **Financial Cost Leakage** | `actualCost` Calculation | Financial calculations only count approved material issues, ignoring field expenses and timesheets. | Refactor `actualCost` calculations to aggregate stock issues, expenses, and labor costs. |
| **🟡 HIGH** | **Manual Progress Tracking** | `project-progress.ts` | Progress does not auto-recalculate based on active deliverables (tasks, milestones, BOQ lines). | Update progress calculations to aggregate completion percentages across tasks, milestones, and workflow stages. |
| **🟡 HIGH** | **Unused Project Variance Field** | `project.variance` | The `variance` field is never populated or synchronized. | Create a database trigger or middleware hook to calculate `variance = budget - actualCost` on every cost transaction. |

---

## 5. Blueprint: Automated Performance Engine

To transition the Project Details page from a static data viewer into an automated execution system, we propose implementing a unified **Performance Engine** that acts as a central coordinator:

```
                  ┌──────────────────────────────────────────────┐
                  │              PERFORMANCE ENGINE              │
                  └──────────────────────┬───────────────────────┘
                                         │
       ┌─────────────────────────────────┼─────────────────────────────────┐
       ▼                                 ▼                                 ▼
┌──────────────┐                  ┌──────────────┐                  ┌──────────────┐
│  WORKFLOW    │                  │  FINANCIAL   │                  │  DELIVERABLE │
│  ENGINE      │                  │  TRACKER     │                  │  MONITOR     │
├──────────────┤                  ├──────────────┤                  ├──────────────┤
│ Calculates:  │                  │ Calculates:  │                  │ Calculates:  │
│ Completed    │                  │ Material cost│                  │ Tasks comp.  │
│ stages vs    │                  │ + Expenses   │                  │ + Milestones │
│ total stages │                  │ + Timesheets │                  │ completed    │
└──────┬───────┘                  └──────┬───────┘                  └──────┬───────┘
       │                                 │                                 │
       └─────────────────────────────────┼─────────────────────────────────┘
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │       DYNAMIC PROGRESS & VARIANCE SYNC       │
                  ├──────────────────────────────────────────────┤
                  │ project.progress = weighted calculation      │
                  │ project.variance = budget - actualCost       │
                  └──────────────────────────────────────────────┘
```

### Proposed Automated Progress Calculation Formula:
$$Progress = (W_{s} \times StageProgress) + (W_{t} \times TaskProgress) + (W_{m} \times MilestoneProgress)$$

*Where $W_{s} = 0.50$, $W_{t} = 0.30$, and $W_{m} = 0.20$ represent standard architectural weights.*

---

## 6. Actionable Implementation Roadmap

### Phase 1: Immediate Gaps & Security Patches (1-3 Days)
1. **Fix Warehouse Stock Issue Auth Bug:** Replace the `findFirst` database query with authenticated session details inside the stock issue POST handler.
2. **Synchronize Financial Variance:** Modify the material issue approval endpoint to automatically calculate and save `variance = budget - actualCost`.
3. **Draft the Project Stats API Endpoint:** Create a unified statistics endpoint (`/api/projects/[id]/stats`) to serve live aggregates to the KPIs and Finance tabs.

### Phase 2: Core Cost & Progress Automation (1-2 Weeks)
1. **Integrate Expense Calculations:** Connect the `ProjectExpenses` and labor timesheet models to the project's total `actualCost` calculator.
2. **Automate Progress Calculation:** Deploy the weighted progress formula inside `project-progress.ts` and set up database triggers to update progress automatically whenever tasks or stages change.
3. **Configure Live Data Dashboards:** Refactor the PM, Logistics, QA, and Finance dashboards to fetch live aggregated data from the stats API.

### Phase 3: Spatial Automation & Advanced Features (3+ Weeks)
1. **Automate BOQ from GIS Routing:** Connect QGIS coordinate parsing to the material catalog to automate material forecasting and budget generation.
2. **Set Up Resource Conflict Warnings:** Implement real-time scheduling checks to prevent conflicts when allocating fleet or OTDR machinery to multiple sites.