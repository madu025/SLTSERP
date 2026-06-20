# SLTSERP - Complete Project Module Implementation Plan

> **Version:** 2.1  
> **Date:** 2026-06-18  
> **Status:** Updated - Telecom Cable Rules, Executive Dashboard, AI Forecasting Added

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Project Creation & Supervisor Assignment](#2-phase-1-project-creation--supervisor-assignment)
3. [Phase 2: QFieldCloud Self-Hosted Setup](#3-phase-2-qfieldcloud-self-hosted-setup)
4. [Phase 3: QGIS Survey Layers (12 Layers)](#4-phase-3-qgis-survey-layers-12-layers)
5. [Phase 4: Mobile Survey (QField + QFieldCloud)](#5-phase-4-mobile-survey-qfield--qfieldcloud)
6. [Phase 5: Continue Multi-Day Survey](#6-phase-5-continue-multi-day-survey)
7. [Phase 6: DP Location & Route Changes](#7-phase-6-dp-location--route-changes)
8. [Phase 7: Map Layer Approval Workflow](#8-phase-7-map-layer-approval-workflow)
9. [Phase 8: Auto-BOQ Generation Engine](#9-phase-8-auto-boq-generation-engine)
10. [Phase 9: BOQ Approval Workflow](#10-phase-9-boq-approval-workflow)
11. [Phase 10: Material Request & Procurement](#11-phase-10-material-request--procurement)
12. [Phase 11: Budget Tracking](#12-phase-11-budget-tracking)
13. [Phase 12: Implementation & Daily Progress](#13-phase-12-implementation--daily-progress)
14. [Phase 13: Change Request Workflow](#14-phase-13-change-request-workflow)
15. [Phase 14: Route Versioning](#15-phase-14-route-versioning)
16. [Phase 15: GIS Audit Trail](#16-phase-15-gis-audit-trail)
17. [Phase 16: PAT Process (Pre-PAT + SLT PAT + Fine-tune)](#17-phase-16-pat-process-pre-pat--slt-pat--fine-tune)
18. [Phase 17: Contractor Auto-KPI Engine](#18-phase-17-contractor-auto-kpi-engine)
19. [Phase 18: QGIS/CAD As-Built Output](#19-phase-18-qgiscad-as-built-output)
20. [Phase 19: Invoice & 3-Level Payment](#20-phase-19-invoice--3-level-payment)
21. [Phase 20: Project Closure](#21-phase-20-project-closure)
22. [Phase 21: Executive Dashboard](#22-phase-21-executive-dashboard)
23. [Phase 22: AI Forecasting](#23-phase-22-ai-forecasting)
24. [Database Schema (All Models)](#24-database-schema-all-models)
25. [API Endpoints](#25-api-endpoints)
26. [Service Architecture](#26-service-architecture)
27. [Implementation Sequence](#27-implementation-sequence)

---

## 1. Architecture Overview

### System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        SLTSERP WEB PORTAL                        │
│  (Next.js 15 + React + Prisma + PostgreSQL)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Project  │ │   BOQ    │ │ Material │ │ Payment  │           │
│  │ Creation │ │  Engine  │ │ Request  │ │  Flow    │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │             │             │             │                 │
│       └─────────────┼─────────────┼─────────────┘                │
│                     │             │                               │
│              ┌──────┴──────┐ ┌───┴────────┐                      │
│              │ QFieldCloud │ │  Auto-BOQ  │                      │
│              │  Service    │ │  Service   │                      │
│              └──────┬──────┘ └────────────┘                      │
└─────────────────────┼────────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │    QFieldCloud Server   │
         │  (Docker Self-Hosted)   │
         │  ┌──────────────────┐   │
         │  │  REST API (Delta)│   │
         │  └────────┬─────────┘   │
         └───────────┼─────────────┘
                     │
         ┌───────────┴───────────┐
         │   QField Mobile App   │
         │  (Android/iOS/Desktop)│
         │  ┌─────────────────┐  │
         │  │ 12 Survey Layers│  │
         │  │ GPS + Photos    │  │
         │  │ Offline Support │  │
         │  │ Multi-Day Survey│  │
         │  └─────────────────┘  │
         └───────────────────────┘
```

### Technology Stack
| Component | Technology |
|-----------|-----------|
| Web Portal | Next.js 15, React 19, TypeScript |
| Database | PostgreSQL 16 + PostGIS |
| ORM | Prisma 6.x |
| GIS Map | OpenLayers 10 + Leaflet |
| Mobile Survey | QFieldCloud (self-hosted) + QField App |
| Container | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| QGIS Template | QGIS 3.x QGZ Project File |

### Project Status Lifecycle
```
PLANNING
  → SURVEY_IN_PROGRESS
    → SURVEY_COMPLETE
      → BOQ_PENDING
        → BOQ_APPROVED
          → MATERIAL_REQUESTED
            → MATERIAL_ISSUED
              → INSTALLATION_IN_PROGRESS
                → INSTALLATION_COMPLETE
                  → PRE_PAT_PENDING
                    → PRE_PAT_IN_PROGRESS
                      → PRE_PAT_PASSED
                        → SLT_PAT_PENDING
                          → SLT_PAT_IN_PROGRESS
                            → SLT_PAT_PASSED
                              → COMPLETED
```

---

## 2. Phase 1: Project Creation & Supervisor Assignment

### Current Status: ✅ Already Built (Needs Refinement)

### 2.1 Project Create Form Fields
```typescript
interface ProjectCreateInput {
  name: string; projectCode: string; opmcId: string;
  region: string; province: string; district: string;
  routeFrom: string; routeTo: string; routeLength: number;
  routeType: 'AERIAL' | 'UNDERGROUND' | 'HYBRID';
  supervisorId: string; assistantId?: string;
  plannedStartDate: Date; plannedEndDate: Date;
  estimatedBudget: number; surveyLayers: string[];
}
```

### 2.2 New Model: ProjectSupervisorAssignment
```prisma
model ProjectSupervisorAssignment {
  id            String    @id @default(cuid())
  projectId     String
  supervisorId  String
  role          String    @default("PRIMARY")
  status        String    @default("ASSIGNED")
  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  supervisor    User      @relation("SupervisorAssignment", fields: [supervisorId], references: [id])
}
```

---

## 3. Phase 2: QFieldCloud Self-Hosted Setup

### Docker Compose
```yaml
services:
  qfieldcloud:
    image: opengisch/qfieldcloud:latest
    environment:
      - DB_HOST=postgres
      - DB_NAME=qfieldcloud
    ports: ["8000:8000"]
  qfieldcloud_worker:
    image: opengisch/qfieldcloud:latest
    command: python manage.py qcluster
    depends_on: [postgres, redis]
  redis:
    image: redis:7-alpine
```

### 3.1 Service: `qfieldcloud.service.ts`
```typescript
class QFieldCloudService {
  async createProject(projectId, projectName) {}
  async fetchDelta(projectId, sinceExportId?) {}
  async getLayerFeatures(projectId, layerId) {}
  async triggerSyncAndUpdate(projectId) {}
}
```

### 3.2 New Model: QFieldCloudSyncLog
```prisma
model QFieldCloudSyncLog {
  id              String    @id @default(cuid())
  projectId       String
  syncType        String    // FULL_SYNC, DELTA_SYNC
  status          String    // STARTED, COMPLETED, FAILED
  featuresCount   Int       @default(0)
}
```

---

## 4. Phase 3: QGIS Survey Layers (12 Layers)

| # | Layer ID | Name | Key Attributes |
|---|----------|------|---------------|
| 1 | survey_existing_pole | Existing Pole | pole_id, owner, type, condition, is_new=false |
| 2 | survey_new_pole | New Pole | pole_number, type, height, foundation, guy_bracket, is_new=true |
| 3 | survey_joint_closure | Joint Closure | closure_number, type, capacity, splice_count |
| 4 | survey_enclosure | Enclosure/ODF | enclosure_number, type, size, capacity |
| 5 | survey_cable_start | Cable Start (A-End) | section_number, fiber_count, cable_type, install_method |
| 6 | survey_cable_end | Cable End (B-End) | gps_distance (auto), slack_required |
| 7 | survey_cable_mid | Cable Mid-Point | point_type, slack_length |
| 8 | survey_fdp | FDP | fdp_number, type, port_count, serving_area |
| 9 | survey_chamber | Chamber | chamber_number, type, dimensions, depth |
| 10 | survey_dp_location | DP Location | route_change_reason, deviation_distance |
| 11 | survey_road_crossing | Road Crossing | road_type, crossing_method, duct_type |
| 12 | survey_obstruction | Obstruction | type, severity, mitigation, mitigation_cost |

### 4.1 Dynamic Dropdown Configurator (Value Map Widget Injector)
To allow Project Managers to customize select choices for mobile survey forms:
* **Prisma Model:** `QFieldFieldConfig` stores selected options for a project's target layer and field.
* **Backend XML Engine:** `scripts/patch-qgis-dynamic.py` handles reading the project database options, unpacking `QGIS.qgz`, updating edit widgets in the `.qgs` XML configuration to `ValueMap`, and repacking.
* **Sync Integration:** `QFieldCloudSyncService` fetches configurations from the DB during project creation, runs the patching script on the project archive, and uploads the customized QGIS package to QFieldCloud.
* **Frontend Configurator:** `src/components/projects/QFieldConfigForm.tsx` provides the UI to manage select lists and load standard presets.

---

## 5. Phase 4: Mobile Survey (QField + QFieldCloud)

### 5.1 Supervisor Mobile Workflow
```
1. Supervisor opens QField → logs into QFieldCloud
2. Opens assigned project → QGIS loads 12 layers
3. Walks route → marks points on each layer
4. Each point: GPS captures lat/lon + attributes + photos
5. Works OFFLINE → periodic sync when online
```

### 5.2 Sync Flow (QFieldCloud → SLTSERP)
```
1. QFieldCloudService.fetchDelta(projectId)
2. Parse features → extract geometry + attributes
3. Create SurveyPoint records
4. Update project progress
```

---

## 6. Phase 5: Continue Multi-Day Survey

### 6.1 New Model: MobileSurveySession
```prisma
model MobileSurveySession {
  id                  String    @id @default(cuid())
  projectId           String
  supervisorId        String
  status              String    @default("IN_PROGRESS")
  pointsCount         Int       @default(0)
  syncStatus          String    @default("PENDING")
  project             Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  surveyPoints        SurveyPoint[]
}
```

### 6.2 Continue Survey Workflow
```
Day 1: Open QField → survey 40 points → save locally (no sync needed)
Day 2: Open SAME project → all Day 1 points visible → add 35 more
Day 3: Complete remaining → sync ALL 100 points → session COMPLETED
```

---

## 7. Phase 6: DP Location & Route Changes

When the planned route cannot be followed, surveyor marks a **DP (Diversion Point)** on survey_dp_location layer:
- route_change_reason: OBSTRUCTION, UTILITY_CONFLICT, LAND_OWNER_DENIAL, TERRAIN
- deviation_distance: meters from planned route
- Each DP creates SurveyFinding with findingType=OBSTRUCTION
- Triggers review by project manager

---

## 8. Phase 7: Map Layer Approval Workflow

### 8.1 Problem
**Surveyor adds point → Direct to BOQ → No verification!**

### 8.2 Solution: 3-Step Approval
```
Surveyor marks point on QField
  ↓ Data synced → Status: PENDING_VERIFICATION
    ↓ Supervisor reviews on web map
      → REJECTED (reason + correction) OR VERIFIED
        ↓ GIS Engineer reviews
          → APPROVED (ready for BOQ) OR FLAGGED
```

### 8.3 SurveyPoint Approval Fields
```prisma
model SurveyPoint {
  // ... existing fields ...
  
  verificationStatus  String    @default("PENDING_VERIFICATION")
  // PENDING_VERIFICATION, VERIFIED, REJECTED, APPROVED, FLAGGED
  verificationStep    String    @default("SUPERVISOR")
  
  verifiedById        String?
  verifiedAt          DateTime?
  approvedById        String?
  approvedAt          DateTime?
  rejectionReason     String?
}
```

### 8.4 Approval Dashboard
```
Layer: survey_new_pole (25 points)
┌──────┬─────────┬────────────┬──────────┬──────────┐
│  #   │  Point  │  Status    │ Photos   │ Actions  │
├──────┼─────────┼────────────┼──────────┼──────────┤
│  1   │ NP-001  │ ⏳ PENDING │ [View]   │ [✓][✗]   │
│  2   │ NP-002  │ ✅ APPROVED│ [View]   │ --       │
│  3   │ NP-003  │ ❌ REJECTED│ [View]   │ [Edit]   │
└──────┴─────────┴────────────┴──────────┴──────────┘

Rule: ONLY APPROVED points go to BOQ Engine
```

---

## 9. Phase 8: Auto-BOQ Generation Engine

### 9.1 BOQ Rules Matrix

| Layer | is_new | Material BOQ | Labor BOQ |
|-------|--------|-------------|-----------|
| survey_existing_pole | false | ❌ None | ✅ Labor only |
| survey_new_pole | true | ✅ Pole + Foundation + Guy | ✅ Erection |
| survey_joint_closure | - | ✅ Closure unit | ✅ Splicing |
| survey_enclosure | - | ✅ Enclosure + pigtails | ✅ Installation |
| survey_cable_start+end | - | ✅ Cable(Actual Route × meter) | ✅ Pulling |
| survey_fdp | - | ✅ FDP + adapters | ✅ Installation |
| survey_chamber | - | ✅ Chamber + cover | ✅ Excavation |

### 9.2 Telecom Cable Calculation Rules

#### Rule 1: Simple Cable Section
```
A ──────────────── B
Actual Route Length = 500m

Cable = ActualRoute + StartSlack(10) + EndSlack(10) = 520m
```

#### Rule 2: Long Cable (>500m threshold)
```
A ───────────────────────────── B
Actual Route Length = 1200m

Cable = 1200 + Start(10) + End(10) + MaintenanceLoop(10) = 1230m
```

#### Rule 3: Joint Closure (Mid-Section Split)
```
A ──────── JC ──────── B
A→JC = 300m → Cable1 = 300 + 10 + 10 = 320m
JC→B = 400m → Cable2 = 400 + 10 + 10 = 420m
Total = 740m ✓
```

#### Rule 4: Split From Joint (Multi-Branch)
```
          FDP-1 (100m)
          |
A ── JC ── FDP-2 (150m)     ← 24F cable split into 3 branches
          |
        FDP-3 (200m)

Branch 1: 100 + 10 + 10 = 120m
Branch 2: 150 + 10 + 10 = 170m
Branch 3: 200 + 10 + 10 = 220m
Each branch = INDEPENDENT cable section with own slack
```

#### Telecom Cable Formula (Most Accurate)
```
✅ Use: Actual QGIS Route Polyline Length (not straight-line GPS)
❌ Don't use: Point A → Point B straight-line distance

Example:
  GPS Straight Line: 500m
  Actual Pole Route polyline: 565m

  Cable = 565 + 10 + 10 = 585m
  (This is how real telecom operators calculate!)
```

#### Configurable Slack Settings
| Setting | Default | Source | Configurable |
|---------|---------|--------|-------------|
| Start Reserve | 10m | Project Settings | ✅ Yes |
| End Reserve | 10m | Project Settings | ✅ Yes |
| Joint Reserve | 5m | Project Settings | ✅ Yes |
| Maintenance Loop | 10m | Project Settings | ✅ Yes |
| Long Route Threshold | 500m | Project Settings | ✅ Yes |
| Route Factor % | 0% | Project Settings | ✅ Yes |

#### BOQ Cable Length Formula
```typescript
CableTotal = ActualRoutePolylineLength
  + startReserve
  + endReserve  
  + (jointCount × jointReserve)
  + (isLongRoute ? maintenanceLoop : 0)
  + (actualRouteLength × routeFactorPct / 100)
```

### 9.3 Service: `auto-boq.service.ts`
```typescript
class AutoBOQService {
  // Configurable project settings
  private config = {
    startReserve: 10,       // meters (configurable)
    endReserve: 10,         // meters (configurable)
    jointReserve: 5,        // meters per joint (configurable)
    maintenanceLoop: 10,    // meters if route >500m (configurable)
    longRouteThreshold: 500,// meters (configurable)
    routeFactorPct: 0       // % terrain adjustment (configurable)
  }

  async generateBOQ(projectId, sessionId): Promise<BOQResult> {
    // 1. Load APPROVED SurveyPoints only
    // 2. Group by layer + match cable A/B pairs
    // 3. Detect joints on cable sections
    // 4. Calculate full cable lengths with all slack
    // 5. Generate material + labor per layer
  }

  async calculateCableLength(section: CableSection): number {
    // 1. Get ACTUAL route polyline from QGIS route geometry
    //    NOT straight-line GPS distance!
    const actualRouteLength = section.routePolylineLength
      ?? this.calculateGPSDistance(section.start, section.end);
    
    // 2. Start + End slack (always)
    const startSlack = this.config.startReserve;
    const endSlack = this.config.endReserve;
    
    // 3. Joint slack (if joints present on this section)
    const jointCount = section.joints?.length ?? 0;
    const jointSlack = jointCount * this.config.jointReserve;
    
    // 4. Maintenance loop (only if long route)
    const maintenance = (actualRouteLength > this.config.longRouteThreshold)
      ? this.config.maintenanceLoop : 0;
    
    // 5. Route terrain factor %
    const routeFactor = actualRouteLength * (this.config.routeFactorPct / 100);
    
    // 6. Total cable length
    return actualRouteLength + startSlack + endSlack 
      + jointSlack + maintenance + routeFactor;
  }

  private async processCableSections(startPoints, endPoints): Promise<BOQItem[]> {
    const items: BOQItem[] = [];
    const pairs = this.matchCablePairs(startPoints, endPoints);
    
    for (const pair of pairs) {
      const length = await this.calculateCableLength(pair);
      const fiberCount = pair.start.attributes.fiber_count;
      const cableType = pair.start.attributes.cable_type;
      const installMethod = pair.start.attributes.installation_method;
      
      // Cable material (per meter)
      items.push({
        itemCategory: 'CABLE',
        itemCode: `CABLE-${cableType}-${fiberCount}F`,
        description: `${cableType} Fiber ${fiberCount}F - ${length.toFixed(0)}m`,
        unit: 'METER',
        quantity: length,
        unitRate: this.rates.cablePerMeter[`${cableType}_${fiberCount}F`] || 0,
        amount: length * (this.rates.cablePerMeter[`${cableType}_${fiberCount}F`] || 0)
      });
      
      // Pulling labor (per meter, method-dependent)
      items.push({
        itemCategory: 'LABOR',
        itemCode: `LAB-CABLE-${installMethod}`,
        description: `Cable Pulling Labor (${installMethod}) - ${length.toFixed(0)}m`,
        unit: 'METER',
        quantity: length,
        unitRate: this.rates.cablePullingPerMeter[installMethod] || 0,
        amount: length * (this.rates.cablePullingPerMeter[installMethod] || 0)
      });
    }
    return items;
  }

  private calculateGPSDistance(lat1, lon1, lat2, lon2): number {
    // Haversine formula - GPS straight-line (fallback only)
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  
  private async processExistingPoles(points): Promise<BOQItem[]> {}
  private async processNewPoles(points): Promise<BOQItem[]> {}
}
```

### 9.4 New Model: BOQRateConfig
```prisma
model BOQRateConfig {
  id              String    @id @default(cuid())
  itemCategory    String    // POLE, CHAMBER, CLOSURE, CABLE, DUCT, LABOR
  itemCode        String    @unique
  unitRate        Float     @default(0)
  isActive        Boolean   @default(true)
}
---

## 10. Phase 9: BOQ Approval Workflow

### 10.1 Approval Flow
```
BOQ Generated (DRAFT)
  → Supervisor Reviews → PM Reviews → Finance Reviews
    → BOQ_APPROVED
```

### 10.2 New Model: BOQApproval
```prisma
model BOQApproval {
  id              String    @id @default(cuid())
  boqId           String
  status          String    @default("PENDING")
  // PENDING, APPROVED, REJECTED, CHANGES_REQUESTED
}
```

---

## 11. Phase 10: Material Request & Procurement

### 11.1 Material Request Flow
```
BOQ_APPROVED → Generate Material Request → Check Stock:
  STOCK OK → Issue Material → MATERIAL_ISSUED
  NO STOCK → PR → RFQ → PO → GRN → Stock → Issue
```

### 11.2 Procurement Models
```prisma
model PurchaseRequest {
  id              String    @id @default(cuid())
  projectId       String
  requestNumber   String    @unique
  status          String    // DRAFT, APPROVED, RFQ_ISSUED, PO_CREATED
  items           PurchaseRequestItem[]
}

model RFQ {
  id              String    @id @default(cuid())
  rfqNumber       String    @unique
  status          String    // DRAFT, SENT, QUOTES_RECEIVED, AWARDED
  quotes          Quote[]
}

model Quote {
  id              String    @id @default(cuid())
  supplierId      String
  totalAmount     Float
  status          String    // RECEIVED, AWARDED, REJECTED
}

model PurchaseOrder {
  id              String    @id @default(cuid())
  poNumber        String    @unique
  supplierId      String
  totalAmount     Float
  status          String    // DRAFT, SENT, PARTIALLY_DELIVERED, FULLY_DELIVERED
  grns            GRN[]
}

model GRN {
  id              String    @id @default(cuid())
  grnNumber       String    @unique
  receivedDate    DateTime
  status          String    // PENDING_QC, QC_PASSED, STOCKED
}
```

---

## 12. Phase 11: Budget Tracking

### 12.1 Problem
BOQ estimate exists but NO actual cost tracking.

### 12.2 New Model: ProjectBudget
```prisma
model ProjectBudget {
  id                  String    @id @default(cuid())
  projectId           String    @unique
  originalBudget      Float     @default(0)   // From approved BOQ
  revisedBudget       Float?                  // Approved change
  committedCost       Float     @default(0)   // PR + PO totals
  actualMaterialCost  Float     @default(0)   // From GRN + issue
  actualLaborCost     Float     @default(0)   // From DailyProgress
  forecastCost        Float?                  // Committed + remaining
  variance            Float?                  // Budget - Actual
  variancePct         Float?
  varianceStatus      String?   // UNDER, ON, OVER, CRITICAL
  transactions        BudgetTransaction[]
}

model BudgetTransaction {
  id              String    @id @default(cuid())
  budgetId        String
  transactionType String    // COMMITMENT, ACTUAL_MATERIAL, ACTUAL_LABOR
  amount          Float
  referenceType   String?   // MATERIAL_REQUEST, PO, GRN, DAILY_PROGRESS
  referenceId     String?
}
```

### 12.3 Auto-Cost Service: `budget-tracking.service.ts`
```typescript
class BudgetTrackingService {
  async initializeBudget(projectId): void { /* On BOQ approval */ }
  async updateCommittedCost(projectId): void { /* Sum PR+PO */ }
  async updateActualCost(projectId): void { /* Sum GRN+DailyProgress */ }
  async calculateVariance(projectId): void { /* Auto status */ }
}
```

---

## 13. Phase 12: Implementation & Daily Progress

### 13.1 New Model: DailyProgress
```prisma
model DailyProgress {
  id              String    @id @default(cuid())
  projectId       String
  reportDate      DateTime  @default(now())
  polesErected    Int       @default(0)
  cablePulled     Float     @default(0)
  chambersInstalled Int     @default(0)
  closuresInstalled Int     @default(0)
  teamSize        Int?
  hoursWorked     Float?
  photoUrls       String[]  @default([])
  progressPct     Float     @default(0)
}
```

---

## 14. Phase 13: Change Request Workflow

### 14.1 Flow
```
PM identifies change → Creates ProjectChangeRequest
  → Impact Analysis (cost, timeline, BOQ impact)
    → Approval Chain based on cost:
      - <100K: Section Manager
      - <500K: AE/Engineer
      - >500K: Finance + Director
```

### 14.2 New Models
```prisma
model ProjectChangeRequest {
  id              String    @id @default(cuid())
  projectId       String
  requestNumber   String    @unique
  changeType      String    // SCOPE, ROUTE, MATERIAL, TIMELINE, BUDGET
  costImpact      Float?
  routeChangeData Json?     // {oldPoints, newPoints, changes}
  status          String    // DRAFT, SUBMITTED, APPROVED, REJECTED
  approvals       ChangeApproval[]
}

model ChangeApproval {
  id              String    @id @default(cuid())
  changeRequestId String
  role            String    // SECTION_MANAGER, AE_ENGINEER, FINANCE
  status          String    @default("PENDING")
}
```

---

## 15. Phase 14: Route Versioning

### 15.1 Concept
```
Route v1 (PLANNED) → Original survey
Route v2 (FIELD_CHANGE) → After field adjustments
Route v3 (AS_BUILT) → After installation
Rollback: Revert v3 → v2 if issues found
```

### 15.2 GISRoute Versioning Fields
```prisma
model GISRoute {
  // ... existing fields ...
  version         Int       @default(1)
  parentVersionId String?
  childVersionId  String?
  versionType     String    @default("PLANNED") // PLANNED, FIELD_CHANGE, AS_BUILT
  changeRequestId String?
  isActive        Boolean   @default(true)
}
```

### 15.3 Service: `route-version.service.ts`
```typescript
class RouteVersionService {
  async createNewVersion(routeId, versionType): Promise<GISRoute> { }
  async rollback(routeId, targetVersion): Promise<void> { }
  async getVersionDiff(v1Id, v2Id): Promise<DiffResult> { }
  async compareVersions(projectId): Promise<VersionComparison[]> { }
}
```

---

## 16. Phase 15: GIS Audit Trail

### 16.1 New Model: GISAuditLog
```prisma
model GISAuditLog {
  id              String    @id @default(cuid())
  projectId       String
  entityType      String    // POLE, CABLE, CHAMBER, CLOSURE, FDP, ROUTE
  entityId        String
  action          String    // CREATED, UPDATED, DELETED, MOVED, APPROVED
  fieldChanges    Json?     // [{field, oldValue, newValue}]
  locationBefore  Json?     // {lat, lng}
  locationAfter   Json?     // {lat, lng}
  performedById   String
  performedAt     DateTime  @default(now())
  routeVersion    Int?
  source          String    // QFIELD_MOBILE, WEB_PORTAL, API
}
```

### 16.2 Audit Service
```typescript
class GISAuditService {
  async logChange(params: {...}): Promise<void> { }
  async getAuditTrail(entityType, entityId): Promise<GISAuditLog[]> { }
  async getProjectAuditSummary(projectId): Promise<AuditSummary> { }
}
```

---

## 17. Phase 16: PAT Process (Pre-PAT + SLT PAT + Fine-tune)

### 17.1 PAT Workflow
```
INSTALLATION_COMPLETE → PRE_PAT → SLT_PAT
  If FAIL: INSTALLATION_PENDING → Fine-tune → Re-submit → COMPLETED
```

### 17.2 New Models
```prisma
model PATSession {
  id              String    @id @default(cuid())
  projectId       String
  patType         String    // PRE_PAT, SLT_PAT
  status          String    // PENDING, IN_PROGRESS, COMPLETED, FAILED
  sltOfficers     Json?     // [{name, designation}]
  fineTuneNeeded  Boolean   @default(false)
  fineTuneDetails Json?     // Fine-tune change records
  totalPoints     Int       @default(0)
  passedPoints    Int       @default(0)
  pointResults    PATPointResult[]
}

model PATPointResult {
  id              String    @id @default(cuid())
  patSessionId    String
  measuredPower   Float?
  powerStatus     String?   // PASS, FAIL
  verifiedLat     Float?
  verifiedLng     Float?
  fineTuneNeeded  Boolean   @default(false)
  fineTuneType    String?   // DP_LOCATION_CHANGE, POLE_SHIFTING, CABLE_REROUTE
}
```

---

## 18. Phase 17: Contractor Auto-KPI Engine

### 18.1 Data Sources (Auto-Calculated)

| KPI Metric | Auto Source | Calculation |
|-----------|-------------|-------------|
| Timeline Adherence | DailyProgress | completedTasks / total × 100 |
| Quality (PAT Pass %) | PATSession | passed / total × 100 |
| Safety Score | HSESafetyLog | 100 - (incidents × 10) |
| Material Wastage | ProjectBudget | waste / issued × 100 |
| Rework Count | PATPointResult | Count of fineTuneNeeded=true |

### 18.2 Existing Model Update
```prisma
// Add to existing ContractorPerformanceScore in osp_enhancements.prisma
model ContractorPerformanceScore {
  // ... existing fields ...
  patPassPct          Float?    // Auto from PATSession
  materialWastagePct  Float?    // Auto from material records
  reworkCount         Int?      // Auto from PAT fine-tune
  autoCalculated      Boolean   @default(true)
}
```

### 18.3 Service: `contractor-kpi.service.ts`
```typescript
class ContractorKPIService {
  async calculateMonthlyScore(contractorId, month) { }
  private calcTimelineScore(projectIds): number { }
  private calcPATQualityScore(projectIds): number { }
  private calcSafetyScore(projectIds): number { }
}
```

---

## 19. Phase 18: QGIS/CAD As-Built Output

### 19.1 Output Formats
- QGIS Project (.qgz) - Actual survey points
- GeoJSON per layer
- PDF maps (layer-by-layer)
- CAD Drawing (.dxf)

### 19.2 Service: `as-built.service.ts`
```typescript
class AsBuiltService {
  async generateAsBuiltQGIS(projectId): Promise<Buffer> { }
  async exportLayerGeoJSON(projectId, layerId): Promise<GeoJSON> { }
  async exportCAD(projectId): Promise<Buffer> { }
}
```

---

## 20. Phase 19: Invoice & 3-Level Payment

### 20.1 3-Level Payment Confirmation
```
Level 1: Section Manager → Confirms receipt
Level 2: AE/Engineer → Technical verification
Level 3: Finance Department → Budget + rate verification
All 3 confirmed → PAID
```

### 20.2 Model: ProjectPayment
```prisma
model ProjectPayment {
  id              String    @id @default(cuid())
  projectId       String
  amount          Float
  level1Status    String    @default("PENDING") // PENDING, CONFIRMED, REJECTED
  level2Status    String    @default("PENDING")
  level3Status    String    @default("PENDING")
  status          String    @default("PENDING") // PENDING, PAID
}
```

---

## 21. Phase 20: Project Closure

```
SLT_PAT_PASSED → Payment finalized → As-Built generated
  → Asset register updated → Project status → COMPLETED
```

---

## 22. Phase 21: Executive Dashboard

### 22.1 CEO View - KPI Cards
```
┌─────────────────────────────────────────────────────────────────────────┐
│ SLTSERP EXECUTIVE DASHBOARD                    ⏰ Last Updated: 5 min ago│
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│ │ Active      │ │ Delayed     │ │ Budget      │ │ PAT Success │       │
│ │ Projects    │ │ Projects    │ │ Variance    │ │ Rate        │       │
│ │     42      │ │      8      │ │   +12.5%    │ │   87.3%     │       │
│ │  ↑ 15% YoY  │ │  ⚠️ 19%    │ │  ✅ Under   │ │  📈 +5.2%   │       │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
├─────────────────────────────────────────────────────────────────────────┤
│ Contractor Ranking                       Regional Performance           │
│ ┌────────────────────────┐               ┌────────────────────────┐    │
│ │ #1  ABC Constructions  │ 98.5%        │ Metro        92% ✅   │    │
│ │ #2  XYZ Fiber Works    │ 92.1%        │ Southern     85% ✅   │    │
│ │ #3  PQR Telecom        │ 78.4%        │ Central      67% ⚠️  │    │
│ │ #4  LMN Cable Co       │ 65.2%        │ Northern     45% ❌   │    │
│ │ #5  RST Infrastructure │ 52.0% ❌     │ Uva          55% ❌   │    │
│ └────────────────────────┘               └────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│ Budget Pipeline (Bar Chart)                Timeline (Gantt)            │
│ Budget ████████████████████ 500M           │░░░░░░░░░░░░░░░░░░│ Mar   │
│ Comm  ████████████████░░░░  320M           │████████░░░░░░░░░░│ Apr   │
│ Actual████████████░░░░░░░░  280M           │████████████░░░░░░│ May   │
│ Fore  ███████████████████░  480M           │████████████████░░│ Jun   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 22.2 Service: `executive-dashboard.service.ts`
```typescript
class ExecutiveDashboardService {
  async getDashboard(): Promise<ExecutiveDashboard> {
    return {
      overview: {
        activeProjects: await this.countByStatus('ACTIVE'),
        delayedProjects: await this.countDelayed(),
        budgetVariance: await this.avgBudgetVariance(),
        patSuccessRate: await this.avgPatSuccessRate()
      },
      contractorRanking: await this.getContractorRanking(),
      regionalPerformance: await this.getRegionalPerformance(),
      budgetPipeline: await this.getBudgetTrend(),
      timeline: await this.getTimeline()
    };
  }
}
```

### 22.3 API Endpoints
```
GET    /api/dashboard/executive          - Full executive dashboard
GET    /api/dashboard/contractor-ranking - Top/bottom contractors
GET    /api/dashboard/regional           - Regional performance
```

---

## 23. Phase 22: AI Forecasting

### 23.1 Prediction Dashboard
```
┌────────────────────────────────────────────────────────────────────┐
│ AI PREDICTIONS                           Confidence: 78%           │
├────────────────────────────────────────────────────────────────────┤
│ 🔮 DELAY PREDICTION (3 High Risk)                                 │
│ Project: Metro Fiber Phase 3                                      │
│ ⚠️ 73% probability of 2-week delay                                │
│ Cause: Material shortage (Poles not delivered)                    │
│ Recommendation: Expedite PO #PO-2026-0421                         │
│                                                                    │
│ 🔮 BUDGET OVERRUN PREDICTION (2 High Risk)                        │
│ Project: Southern Ring Cable - 65% chance of ₹0.3M overrun       │
│                                                                    │
│ 🔮 PERMIT DELAY PREDICTION (1 Critical)                           │
│ Central Trunk Line - RDA permit 45 days pending (30-day SLA)     │
│ ⚠️ 89% probability of additional 3-week delay                    │
│                                                                    │
│ 🔮 MATERIAL SHORTAGE PREDICTION (Next 30 Days)                    │
│ 📦 Concrete Poles: CRITICAL (12 - 5 projects need)               │
│ 📦 12F Cable: LOW STOCK (45 units)                               │
│ 📦 Joint Closures: ADEQUATE (120 units)                          │
└────────────────────────────────────────────────────────────────────┘
```

### 23.2 New Model: AiPrediction
```prisma
model AiPrediction {
  id              String    @id @default(cuid())
  projectId       String?
  predictionType  String    // DELAY, BUDGET_OVERRUN, PERMIT_DELAY, MATERIAL_SHORTAGE
  riskLevel       String    // LOW, MEDIUM, HIGH, CRITICAL
  probabilityPct  Float     // 0-100
  predictedImpact String    // e.g., "2 week delay"
  currentMetrics  Json      // Snapshot of data at prediction time
  rootCause       String?   // Identified cause
  recommendation  String?   // Action recommendation
  confidenceScore Float?
  createdAt       DateTime  @default(now())
  project         Project?  @relation(fields: [projectId], references: [id])
  
  @@index([projectId])
  @@index([predictionType])
  @@index([riskLevel])
}
```

### 23.3 Service: `ai-prediction.service.ts`
```typescript
class AiPredictionService {
  async predictDelay(projectId: string): Promise<AiPrediction> {
    // Factors: DailyProgress velocity, material availability, 
    // permit status, contractor history
    const score = this.calculateDelayRisk(projectId);
    return this.savePrediction('DELAY', score);
  }

  async predictBudgetOverrun(projectId: string): Promise<AiPrediction> {
    // Factors: spend rate vs budget, pending change requests,
    // PO totals vs BOQ, route version changes
    const score = this.calculateOverrunRisk(projectId);
    return this.savePrediction('BUDGET_OVERRUN', score);
  }

  async predictPermitDelay(projectId: string): Promise<AiPrediction> {
    // Factors: days pending vs SLA, authority type, region
    const score = this.calculatePermitRisk(projectId);
    return this.savePrediction('PERMIT_DELAY', score);
  }

  async predictMaterialShortage(): Promise<AiPrediction[]> {
    // Stock vs demand across all projects
    return this.calculateShortages();
  }

  async getAllPredictions(projectId: string): Promise<AiPrediction[]> {
    return Promise.all([
      this.predictDelay(projectId),
      this.predictBudgetOverrun(projectId),
      this.predictPermitDelay(projectId)
    ]);
  }
}
```

### 23.4 API Endpoints
```
GET    /api/ai/predictions/[projectId]        - All predictions for project
GET    /api/ai/predictions/delay/[projectId]  - Delay prediction only
GET    /api/ai/predictions/budget/[projectId] - Budget overrun prediction
GET    /api/ai/predictions/material           - Material shortage predictions
```

---

## 24. Database Schema (All New Models)

```prisma
// Phase 1: ProjectSupervisorAssignment
// Phase 2: QFieldCloudSyncLog
// Phase 5: MobileSurveySession
// Phase 7: SurveyPoint (with approval fields)
model SurveyPoint {
  id              String    @id @default(cuid())
  sessionId       String
  layerId         String
  layerName       String
  latitude        Float
  longitude       Float
  attributes      Json
  photoUrls       String[]  @default([])
  supervisorId    String?
  // Approval Fields
  verificationStatus  String @default("PENDING_VERIFICATION")
  verifiedById        String?
  verifiedAt          DateTime?
  approvedById        String?
  approvedAt          DateTime?
  rejectionReason     String?
}

// Phase 8: BOQRateConfig
model BOQRateConfig {
  id              String    @id @default(cuid())
  itemCode        String    @unique
  unitRate        Float     @default(0)
  isActive        Boolean   @default(true)
}

// Phase 9: BOQApproval
model BOQApproval {
  id              String    @id @default(cuid())
  boqId           String
  status          String    @default("PENDING")
}

// Phase 10: Procurement
model PurchaseRequest { id String @id @default(cuid()) }
model RFQ { id String @id @default(cuid()) }
model Quote { id String @id @default(cuid()) }
model PurchaseOrder { id String @id @default(cuid()) }
model GRN { id String @id @default(cuid()) }

// Phase 11: Budget
model ProjectBudget {
  id              String    @id @default(cuid())
  projectId       String    @unique
  originalBudget  Float     @default(0)
  committedCost   Float     @default(0)
  actualTotal     Float     @default(0)
  variance        Float?
  varianceStatus  String?
}

// Phase 12: DailyProgress
model DailyProgress {
  id              String    @id @default(cuid())
  projectId       String
  polesErected    Int       @default(0)
  cablePulled     Float     @default(0)
  hoursWorked     Float?
}

// Phase 13: Change Request
model ProjectChangeRequest {
  id              String    @id @default(cuid())
  projectId       String
  changeType      String
  status          String    @default("DRAFT")
}

// Phase 15: GIS Audit
model GISAuditLog {
  id              String    @id @default(cuid())
  projectId       String
  entityType      String
  action          String
  performedById   String
}

// Phase 16: PAT
model PATSession {
  id              String    @id @default(cuid())
  projectId       String
  patType         String
  totalPoints     Int       @default(0)
  passedPoints    Int       @default(0)
  fineTuneNeeded  Boolean   @default(false)
}

// Phase 19: Payment
model ProjectPayment {
  id              String    @id @default(cuid())
  projectId       String
  amount          Float
  level1Status    String    @default("PENDING")
  level2Status    String    @default("PENDING")
  level3Status    String    @default("PENDING")
}
```

---

## 23. API Endpoints

```
# Project
GET    /api/projects
POST   /api/projects
POST   /api/projects/[id]/assign

# Survey
POST   /api/projects/[id]/survey/session/start
GET    /api/projects/[id]/survey/points?layer=X
POST   /api/projects/[id]/survey/sync

# Map Layer Approval
PATCH  /api/projects/[id]/survey/points/[id]/verify
PATCH  /api/projects/[id]/survey/points/[id]/approve
PATCH  /api/projects/[id]/survey/points/[id]/reject
POST   /api/projects/[id]/survey/points/batch-approve

# BOQ
POST   /api/projects/[id]/boq/generate
GET    /api/projects/[id]/boq

# Material + Procurement
POST   /api/projects/[id]/material/request
POST   /api/projects/[id]/procurement/pr
POST   /api/procurement/pr/[id]/rfq
POST   /api/procurement/rfq/[id]/quote
POST   /api/procurement/po
POST   /api/procurement/grn

# Budget
GET    /api/projects/[id]/budget
POST   /api/projects/[id]/budget/transaction
GET    /api/projects/[id]/budget/dashboard

# PAT
POST   /api/projects/[id]/pat/session/start
POST   /api/projects/[id]/pat/session/[id]/complete

# Change Request + Route Versioning
POST   /api/projects/[id]/change-request
GET    /api/projects/[id]/route/versions
POST   /api/projects/[id]/route/version/[id]/rollback

# GIS Audit
GET    /api/projects/[id]/audit/logs
GET    /api/projects/[id]/audit/summary

# Payment
POST   /api/projects/[id]/invoice/generate
POST   /api/projects/[id]/payment/[id]/confirm/level1

# As-Built
GET    /api/projects/[id]/as-built/qgis
GET    /api/projects/[id]/as-built/geojson/[layer]

# Contractor KPI
GET    /api/contractors/[id]/kpi
POST   /api/contractors/[id]/kpi/calculate
```

---

## 24. Service Architecture

```
src/services/
├── qfieldcloud.service.ts       # QFieldCloud REST API
├── auto-boq.service.ts          # Auto BOQ generation
├── map-approval.service.ts      # Map layer approval workflow  ✨NEW
├── procurement.service.ts       # PR→RFQ→PO→GRN workflow     ✨NEW
├── budget-tracking.service.ts   # Budget vs Actual tracking   ✨NEW
├── change-request.service.ts    # Change request workflow     ✨NEW
├── route-version.service.ts     # Route versioning + rollback ✨NEW
├── gis-audit.service.ts         # GIS change audit trail      ✨NEW
├── contractor-kpi.service.ts    # Auto KPI calculation        ✨NEW
├── pat.service.ts               # PAT session management
├── payment.service.ts           # 3-level payment
├── as-built.service.ts          # As-built documents
└── daily-progress.service.ts    # Daily progress
```

---

## 25. Implementation Sequence

| # | Phase | Priority | Effort |
|---|-------|----------|--------|
| 1 | Project Creation & Supervisor | HIGH | 2d |
| 2 | QFieldCloud Setup | HIGH | 3d |
| 3 | QGIS Survey Layers | HIGH | 2d |
| 4 | Mobile Survey | HIGH | 5d |
| 5 | Continue Multi-Day | HIGH | 2d |
| 6 | DP Location | MED | 1d |
| 7 | Map Layer Approval | HIGH | 3d |
| 8 | Auto-BOQ Engine | HIGH | 4d |
| 9 | BOQ Approval | MED | 2d |
| 10 | Material Request + Procurement | MED | 5d |
| 11 | Budget Tracking | HIGH | 3d |
| 12 | Daily Progress | MED | 2d |
| 13 | Change Request | MED | 2d |
| 14 | Route Versioning | HIGH | 3d |
| 15 | GIS Audit Trail | MED | 2d |
| 16 | PAT Process | HIGH | 4d |
| 17 | Contractor Auto-KPI | MED | 3d |
| 18 | As-Built Output | MED | 3d |
| 19 | Invoice + Payment | MED | 3d |
| 20 | Project Closure | LOW | 1d |

**Total: ~55 days**

### Sprint Plan
| Sprint | Phases |
|--------|--------|
| Sprint 1 (W1-2) | 1, 2, 3 |
| Sprint 2 (W3-4) | 4, 5, 6, 7 |
| Sprint 3 (W5-6) | 8, 9, 10 |
| Sprint 4 (W7-8) | 11, 12, 13, 14 |
| Sprint 5 (W9-10) | 15, 16, 17 |
| Sprint 6 (W11-12) | 18, 19, 20 |

---

## Appendix A: Existing Models Reference (osp_enhancements.prisma)

| Model | Purpose | Status |
|-------|---------|--------|
| GISRoute | Route design + GeoJSON | ✅ |
| GISPole, GISChamber, GISClosure, GISCableSegment | Route elements | ✅ |
| GISGeneratedBOQ + GISGeneratedBOQItem | Auto-BOQ | ✅ |
| SurveyRequest, SurveyCheckIn, SurveyPhoto, SurveyFinding | Survey | ✅ |
| FieldTask, FieldPhoto, FieldChecklist, FieldSignature | Field mobile | ✅ |
| ProjectPermit, PermitType, AuthorityEntity | Permits | ✅ |
| ProjectEVM, EVMSnapshot | EVM tracking | ✅ |
| ProjectAsset, ProjectAssetCable, ProjectAssetConnection | Assets | ✅ |
| OTDRTest, OTDRTestEvent | Fiber testing | ✅ |
| HSESafetyLog, HSEAttendee | Safety | ✅ |
| ContractorPerformanceScore | Contractor KPI | ✅ |
| StageGateRule | Stage gates | ✅ |

---

## Appendix B: Environment Variables

```env
QFC_API_URL=https://qfieldcloud.slt.lk/api/v1
QFC_API_TOKEN=your_api_token
QFC_DOMAIN=qfieldcloud.slt.lk
REDIS_URL=redis://redis:6379/0
SYNC_INTERVAL_MINUTES=5