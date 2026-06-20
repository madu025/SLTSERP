# SLTSERP Project Module — File Map

> **Version:** 1.0  
> **Date:** 2026-06-18  
> **Purpose:** ඕනෑම function එකකට අදාළ files ඉක්මනින් හොයාගන්න

---

## 📁 File Index by Function

### 1. Project Creation & Supervisor Assignment
| Function | API / Service / Component | File Path |
|----------|--------------------------|-----------|
| Create Project | `POST /api/projects` | `src/app/api/projects/route.ts` |
| List Projects | `GET /api/projects` | `src/app/api/projects/route.ts` |
| Update Project | `PATCH /api/projects` | `src/app/api/projects/route.ts` |
| Delete Project | `DELETE /api/projects` | `src/app/api/projects/route.ts` |
| Get Project Detail | `GET /api/projects/[id]` | `src/app/api/projects/[id]/route.ts` |
| Assign Supervisor | `POST /api/projects/[id]/supervisors` | `src/app/api/projects/[id]/supervisors/route.ts` |
| List Supervisors | `GET /api/projects/[id]/supervisors` | `src/app/api/projects/[id]/supervisors/route.ts` |
| Remove Supervisor | `DELETE /api/projects/[id]/supervisors` | `src/app/api/projects/[id]/supervisors/route.ts` |
| Project Page UI | Page Component | `src/app/projects/[id]/page.tsx` |
| Project List UI | Page Component | `src/app/projects/page.tsx` |

### 2. QFieldCloud Self-Hosted (Mobile Survey)
| Function | API / Service / Config | File Path |
|----------|----------------------|-----------|
| Docker Compose | 4 services (PostGIS+MinIO+API+Worker) | `docker/qfieldcloud/docker-compose.qfield.yml` |
| DB Init Script | PostGIS extensions + schema | `docker/qfieldcloud/init-qfield-db.sh` |
| QFieldCloud Sync Service | Delta API, create project, push layers, pull features | `src/services/qfieldcloud-sync.service.ts` |
| QFieldCloud Sync API | GET status / POST full_sync, push_layers, create_project | `src/app/api/projects/[id]/qfield-sync/route.ts` |
| QField Config UI | Form Component & Page Router | `src/components/projects/QFieldConfigForm.tsx`, `src/app/projects/[id]/qfield-config/page.tsx` |
| QField Config API | GET list / POST update configurations | `src/app/api/projects/[id]/qfield-config/route.ts` |
| QField Patching Script | Python widget XML patcher utility | `scripts/patch-qgis-dynamic.py` |
| Config DB Model | `QFieldFieldConfig` | `prisma/schema/gis.prisma` |
| Sync Log Model | QFieldCloudSyncLog | `prisma/schema/gis.prisma` |
| Deployment Guide | Local + Remote + Production | `docs/QFIELDCLOUD-DEPLOYMENT.md` |
| Environment Config | QFieldCloud variables | `.env` (QFIELD_HOST, QFIELD_ALLOWED_HOSTS, etc.) |

### 3. 12 QGIS Survey Layers
| Function | File | Path |
|----------|------|------|
| Layer Definitions | 12 layers with icons, colors, attributes, point styles | `src/config/survey-layers.ts` |
| QGIS Template | Base QGIS project file | `QGIS Project Template/QGIS.qgz` |
| Sample GeoJSON | Template layers | `QGIS Project Template/GeoJSON/` |

### 4. Mobile Survey Sessions (Multi-Day Continue)
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Start Session | `POST /api/projects/[id]/survey/sessions` | `src/app/api/projects/[id]/survey/sessions/route.ts` |
| Continue Session | `POST` (action=continue) | `src/app/api/projects/[id]/survey/sessions/route.ts` |
| Complete Session | `PATCH` (action=complete) | `src/app/api/projects/[id]/survey/sessions/route.ts` |
| Abandon Session | `PATCH` (action=abandon) | `src/app/api/projects/[id]/survey/sessions/route.ts` |
| Session Model | MobileSurveySession | `prisma/schema.prisma` (line ~4107) |

### 5. Survey Points (Map Marking)
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Create Point | `POST /api/projects/[id]/survey/points` | `src/app/api/projects/[id]/survey/points/route.ts` |
| List Points | `GET /api/projects/[id]/survey/points` | `src/app/api/projects/[id]/survey/points/route.ts` |
| Survey Point Model | SurveyPoint | `prisma/schema.prisma` (line ~4128) |

### 6. Map Layer Approval (3-Step: Verify → Approve → Reject)
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Verify Point (Step 1) | `PATCH` (action=verify) | `src/app/api/projects/[id]/survey/points/[pointId]/route.ts` |
| Approve Point (Step 2) | `PATCH` (action=approve) | `src/app/api/projects/[id]/survey/points/[pointId]/route.ts` |
| Reject Point | `PATCH` (action=reject) | `src/app/api/projects/[id]/survey/points/[pointId]/route.ts` |
| Flag Point | `PATCH` (action=flag) | `src/app/api/projects/[id]/survey/points/[pointId]/route.ts` |
| Batch Verify | `POST /api/projects/[id]/survey/batch-approve` | `src/app/api/projects/[id]/survey/batch-approve/route.ts` |
| Batch Approve | `POST` (action=approve) | `src/app/api/projects/[id]/survey/batch-approve/route.ts` |
| Map Approval Service | verifyPoint, approvePoint, rejectPoint, flagPoint, batchVerify, batchApprove | `src/services/map-approval.service.ts` |
| Approval Summary | getApprovalSummary, getSurveyPoints | `src/services/map-approval.service.ts` |
| Approval UI | React component | `src/components/projects/ProjectSurveyApproval.tsx` |

### 7. Auto-BOQ Engine
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Generate BOQ | `POST /api/projects/[id]/boq/generate` | `src/app/api/projects/[id]/boq/generate/route.ts` |
| Auto-BOQ Service | 4 telecom cable rules, layer processors | `src/services/auto-boq.service.ts` |
| Cable Length Formula | calculateCableLength (scaling maintenance loop) | `src/services/auto-boq.service.ts` |
| Config Parameters | startReserve, endReserve, jointReserve, maintenanceLoop, longRouteThreshold, routeFactorPct | `src/services/auto-boq.service.ts` (DEFAULT_CONFIG) |
| BOQ Item Model | ProjectBOQItem | `prisma/schema.prisma` (line ~422) |

### 8. BOQ Approval Workflow
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Submit BOQ | `POST /api/projects/[id]/boq/approve` (action=submit) | `src/app/api/projects/[id]/boq/approve/route.ts` |
| Approve BOQ | `POST` (action=approve) | `src/app/api/projects/[id]/boq/approve/route.ts` |
| Reject BOQ | `POST` (action=reject) | `src/app/api/projects/[id]/boq/approve/route.ts` |
| Revise BOQ | `POST` (action=revise) | `src/app/api/projects/[id]/boq/approve/route.ts` |
| BOQ Approval Status | `GET` | `src/app/api/projects/[id]/boq/approve/route.ts` |
| BOQ Approval Model | BOQApproval | `prisma/schema.prisma` (line ~4176) |

### 9. BOQ Rate Configuration
| Function | API | File Path |
|----------|-----|-----------|
| List Rates | `GET /api/projects/boq-rates` | `src/app/api/projects/boq-rates/route.ts` |
| Create/Update Rate | `POST /api/projects/boq-rates` | `src/app/api/projects/boq-rates/route.ts` |
| Bulk Update Rates | `PATCH /api/projects/boq-rates` | `src/app/api/projects/boq-rates/route.ts` |
| Rate Config Model | BOQRateConfig | `prisma/schema.prisma` (line ~4158) |

### 10. Material Request & Procurement (PR→RFQ→PO→GRN)
| Function | API | File Path |
|----------|-----|-----------|
| Auto-Generate PR from BOQ | `POST /api/projects/[id]/boq/generate-pr` | `src/app/api/projects/[id]/boq/generate-pr/route.ts` |
| PR Generation Status | `GET` | `src/app/api/projects/[id]/boq/generate-pr/route.ts` |
| Manual PR CRUD | `GET/POST/PATCH/DELETE /api/projects/requisitions` | `src/app/api/projects/requisitions/route.ts` |
| Quotations CRUD | `GET/POST/PATCH /api/projects/quotations` | `src/app/api/projects/quotations/route.ts` |
| Purchase Orders CRUD | `GET/POST/PATCH/DELETE /api/projects/purchase-orders` | `src/app/api/projects/purchase-orders/route.ts` |
| Goods Receipts (GRN) CRUD | `GET/POST /api/projects/goods-receipts` | `src/app/api/projects/goods-receipts/route.ts` |
| Vendor Model | Vendor | `prisma/schema.prisma` (line ~1641) |
| Requisition Model | ProjectRequisition | `prisma/schema.prisma` (line ~1679) |
| Quotation Model | Quotation | `prisma/schema.prisma` (line ~1728) |
| PO Model | ProjectPurchaseOrder | `prisma/schema.prisma` (line ~1774) |
| GRN Model | ProjectGoodsReceipt | `prisma/schema.prisma` (line ~1838) |

### 11. Budget Tracking
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Budget Dashboard | `GET /api/projects/[id]/budget` | `src/app/api/projects/[id]/budget/route.ts` |
| Sync Actual Cost | `POST /api/projects/[id]/budget` | `src/app/api/projects/[id]/budget/route.ts` |
| Budget Tracking Service | initializeBudget, syncActualCost, getBudgetDashboard, getVarianceStatus | `src/services/budget-tracking.service.ts` |

### 12. Daily Progress
| Function | API / Service | File Path |
|----------|--------------|-----------|
| List Records | `GET /api/projects/[id]/daily-progress` | `src/app/api/projects/[id]/daily-progress/route.ts` |
| Log Progress | `POST /api/projects/[id]/daily-progress` | `src/app/api/projects/[id]/daily-progress/route.ts` |
| Progress UI | React component | `src/components/projects/ProjectDailyProgress.tsx` |
| Progress Model | DailyProgress | `prisma/schema.prisma` (line ~4200) |

### 13. Change Request Workflow
| Function | API / Service | File Path |
|----------|--------------|-----------|
| List CRs | `GET /api/projects/[id]/change-requests` | `src/app/api/projects/[id]/change-requests/route.ts` |
| Create CR | `POST /api/projects/[id]/change-requests` | `src/app/api/projects/[id]/change-requests/route.ts` |
| Change Request Service | dynamic approval chain (<100K/500K thresholds) | `src/services/change-request.service.ts` |
| CR Model | ProjectChangeRequest | `prisma/schema.prisma` (line ~4226) |
| Approval Model | ChangeApproval | `prisma/schema.prisma` (line ~4249) |

### 14. Route Versioning
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Version History | `GET /api/projects/[id]/gis/[routeId]/versions` | `src/app/api/projects/[id]/gis/[routeId]/versions/route.ts` |
| New Version | `POST` (action=new_version) | `src/app/api/projects/[id]/gis/[routeId]/versions/route.ts` |
| Rollback | `POST` (action=rollback) | `src/app/api/projects/[id]/gis/[routeId]/versions/route.ts` |
| Route Version Service | createNewVersion, rollback, getVersionHistory, getVersionDiff | `src/services/route-version.service.ts` |
| GISRoute Model | version, parentVersionId, childVersionId, etc. | `prisma/schema.prisma` (line ~3341) |

### 15. GIS Audit Trail
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Audit Logs (Filtered) | `GET /api/projects/[id]/gis-audit` | `src/app/api/projects/[id]/gis-audit/route.ts` |
| GIS Audit Service | logChange, getAuditTrail, getProjectAuditSummary, getProjectLogs | `src/services/gis-audit.service.ts` |
| Audit Log Model | GISAuditLog | `prisma/schema.prisma` (line ~4265) |

### 16. PAT Process (Pre-PAT + SLT PAT)
| Function | API / Service | File Path |
|----------|--------------|-----------|
| List Sessions | `GET /api/projects/[id]/pat` | `src/app/api/projects/[id]/pat/route.ts` |
| Start Session | `POST /api/projects/[id]/pat` | `src/app/api/projects/[id]/pat/route.ts` |
| Record Point | `POST /api/projects/[id]/pat/[sessionId]/points` | `src/app/api/projects/[id]/pat/[sessionId]/points/route.ts` |
| Complete Session | `PATCH` (action=complete) | `src/app/api/projects/[id]/pat/[sessionId]/points/route.ts` |
| PAT Service | startSession, recordPointResult, completeSession, getProjectSessions | `src/services/pat.service.ts` |
| PAT UI | React component | `src/components/projects/ProjectPAT.tsx` |
| PAT Session Model | PATSession | `prisma/schema.prisma` (line ~4286) |
| PAT Point Model | PATPointResult | `prisma/schema.prisma` (line ~4312) |

### 17. Contractor Auto-KPI
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Get KPI Scores | `GET /api/projects/[id]/contractor-kpi` | `src/app/api/projects/[id]/contractor-kpi/route.ts` |
| Calculate KPI | `POST /api/projects/[id]/contractor-kpi` | `src/app/api/projects/[id]/contractor-kpi/route.ts` |
| KPI Service | calculateMonthlyScore (weighted: timeline 30%, PAT 35%, safety 20%, adherence 15%) | `src/services/contractor-kpi.service.ts` |
| KPI Model | ContractorPerformanceScore | `prisma/schema.prisma` (line ~3605) |

### 18. QGIS/CAD As-Built Output
| Function | API / Service | File Path |
|----------|--------------|-----------|
| QGIS GeoJSON Export | `GET /api/projects/[id]/as-built?format=qgis` | `src/app/api/projects/[id]/as-built/route.ts` |
| Single Layer Export | `GET ?format=layer&layerId=xxx` | `src/app/api/projects/[id]/as-built/route.ts` |
| CAD Block Export | `GET ?format=cad` | `src/app/api/projects/[id]/as-built/route.ts` |
| Survey Comparison | `GET ?format=comparison` | `src/app/api/projects/[id]/as-built/route.ts` |
| As-Built Service | generateQGIS, exportLayerGeoJSON, exportCAD, getAsBuiltComparison | `src/services/as-built.service.ts` |

### 19. Invoice + 3-Level Payment
| Function | API | File Path |
|----------|-----|-----------|
| Payment Summary | `GET /api/projects/[id]/payment-summary` | `src/app/api/projects/[id]/payment-summary/route.ts` |
| Invoice CRUD | `GET/POST/PATCH/DELETE /api/projects/invoices` | `src/app/api/projects/invoices/route.ts` |
| Payment Voucher CRUD | `GET/POST/PATCH/DELETE /api/projects/payment-vouchers` | `src/app/api/projects/payment-vouchers/route.ts` |
| Retention CRUD | Various | `src/app/api/projects/retentions/route.ts` |
| Invoice Model | ProjectInvoice | `prisma/schema.prisma` (line ~1888) |
| Payment Voucher Model | PaymentVoucher | `prisma/schema.prisma` (line ~2735) |
| Payment Model (3-Level) | ProjectPayment | `prisma/schema.prisma` (line ~4333) |
| Retention Model | ProjectRetention | `prisma/schema.prisma` (line ~2806) |

### 20. Project Closure
| Function | API | File Path |
|----------|-----|-----------|
| Closure Checklist | `GET /api/projects/[id]/close` | `src/app/api/projects/[id]/close/route.ts` |
| Close Project | `POST /api/projects/[id]/close` | `src/app/api/projects/[id]/close/route.ts` |

### 21. Executive Dashboard
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Dashboard Data | `GET /api/dashboard/executive` | `src/app/api/dashboard/executive/route.ts` |
| Dashboard Service | 5 widgets (projects, budget, PAT, contractors, activity) | `src/services/executive-dashboard.service.ts` |

### 22. AI Forecasting
| Function | API / Service | File Path |
|----------|--------------|-----------|
| Saved Predictions | `GET /api/projects/[id]/predictions` | `src/app/api/projects/[id]/predictions/route.ts` |
| Run Fresh Analysis | `POST /api/projects/[id]/predictions` | `src/app/api/projects/[id]/predictions/route.ts` |
| AI Service | predictDelay, predictBudgetOverrun, predictPermitDelay, predictMaterialShortage | `src/services/ai-prediction.service.ts` |
| AI Prediction UI | React component | `src/components/projects/ProjectAIForecasting.tsx` |
| AI Model | AiPrediction | `prisma/schema.prisma` (line ~4364) |

### 23. Stock Issue (Material Issuing + Security)
| Function | API | File Path |
|----------|-----|-----------|
| Create Issue | `POST /api/projects/stock-issue` | `src/app/api/projects/stock-issue/route.ts` |
| List Issues | `GET /api/projects/stock-issue` | `src/app/api/projects/stock-issue/route.ts` |
| Approve Issue | `POST /api/projects/stock-issue/approve` | `src/app/api/projects/stock-issue/approve/route.ts` |
| Stock Issue Model | StockIssue | `prisma/schema.prisma` (line ~1288) |

---

## 📁 Services Directory (`src/services/`)

| File | Purpose |
|------|---------|
| `auto-boq.service.ts` | BOQ engine with 4 telecom cable rules (393 lines) |
| `pat.service.ts` | Pre-PAT + SLT PAT sessions and point recording (156 lines) |
| `map-approval.service.ts` | 3-step survey point approval (231 lines) |
| `budget-tracking.service.ts` | Budget vs actual vs variance (168 lines) |
| `contractor-kpi.service.ts` | Auto-weighted KPI from live data (155 lines) |
| `gis-audit.service.ts` | Full GIS change audit with filters (131 lines) |
| `ai-prediction.service.ts` | 4 prediction types (delay/budget/permit/shortage) (312 lines) |
| `executive-dashboard.service.ts` | CEO dashboard with 5 widgets (204 lines) |
| `qfieldcloud-sync.service.ts` | QFieldCloud Delta API integration (270 lines) |
| `change-request.service.ts` | Dynamic approval chain by cost (140 lines) |
| `route-version.service.ts` | GIS route create/rollback/history/diff (230 lines) |
| `as-built.service.ts` | QGIS/CAD/Comparison exports (210 lines) |

---

## 📁 Config Files (`src/config/`)

| File | Purpose |
|------|---------|
| `survey-layers.ts` | 12 QGIS survey layers with full config (170 lines) |
| `stage-tab-mapping.ts` | Workflow stage → tab mappings |

---

## 📁 UI Components (`src/components/projects/`)

| File | Purpose |
|------|---------|
| `ProjectAIForecasting.tsx` | AI risk prediction cards (266 lines) |
| `ProjectDailyProgress.tsx` | Daily construction progress log (298 lines) |
| `ProjectPAT.tsx` | PAT session management UI (502 lines) |
| `ProjectSurveyApproval.tsx` | Survey point approval interface |

---

## 📁 Database Schema

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Master schema (4384 lines) — single source of truth |
| `prisma/migrations/` | Migration history |

---

## 📁 Docker / Deployment

| File | Purpose |
|------|---------|
| `docker/qfieldcloud/docker-compose.qfield.yml` | QFieldCloud 4-service stack |
| `docker/qfieldcloud/init-qfield-db.sh` | PostGIS init script |
| `docs/QFIELDCLOUD-DEPLOYMENT.md` | Deployment guide (local + remote + production) |
| `.env` | Environment variables (12 QFieldCloud vars) |

---

## 🔗 Quick Cross-Reference

| Feature | Service | API Route | UI Component | Model (Prisma) |
|---------|---------|-----------|-------------|----------------|
| Supervisor Assignment | — | `/api/projects/[id]/supervisors` | — | `ProjectSupervisorAssignment` |
| Mobile Survey Session | `qfieldcloud-sync.service.ts` | `/api/projects/[id]/survey/sessions` | — | `MobileSurveySession` |
| Survey Points | `map-approval.service.ts` | `/api/projects/[id]/survey/points` | `ProjectSurveyApproval` | `SurveyPoint` |
| BOQ Generate | `auto-boq.service.ts` | `/api/projects/[id]/boq/generate` | — | `ProjectBOQItem` |
| BOQ Approval | — | `/api/projects/[id]/boq/approve` | — | `BOQApproval` |
| BOQ Rates | — | `/api/projects/boq-rates` | — | `BOQRateConfig` |
| PR Generation | — | `/api/projects/[id]/boq/generate-pr` | — | `ProjectRequisition` |
| Budget | `budget-tracking.service.ts` | `/api/projects/[id]/budget` | — | — |
| Daily Progress | — | `/api/projects/[id]/daily-progress` | `ProjectDailyProgress` | `DailyProgress` |
| Change Request | `change-request.service.ts` | `/api/projects/[id]/change-requests` | — | `ProjectChangeRequest` |
| Route Versioning | `route-version.service.ts` | `/api/projects/[id]/gis/[routeId]/versions` | — | `GISRoute` |
| GIS Audit | `gis-audit.service.ts` | `/api/projects/[id]/gis-audit` | — | `GISAuditLog` |
| PAT Session | `pat.service.ts` | `/api/projects/[id]/pat` | `ProjectPAT` | `PATSession` |
| Contractor KPI | `contractor-kpi.service.ts` | `/api/projects/[id]/contractor-kpi` | — | `ContractorPerformanceScore` |
| As-Built | `as-built.service.ts` | `/api/projects/[id]/as-built` | — | `SurveyPoint` |
| Payment Summary | — | `/api/projects/[id]/payment-summary` | — | `ProjectPayment` |
| Project Closure | — | `/api/projects/[id]/close` | — | — |
| Executive Dashboard | `executive-dashboard.service.ts` | `/api/dashboard/executive` | — | — |
| AI Predictions | `ai-prediction.service.ts` | `/api/projects/[id]/predictions` | `ProjectAIForecasting` | `AiPrediction` |