# Project Module - Full Audit Report

## අවසන් යාවත්කාලීනය: 2026-06-16 16:10

---

## ✅ CHECKED - Phase 1: Project Dashboards (ALL HARDCODED)

### 1.1 PM Dashboard `/projects/dashboards/pm/`
- [x] **Hardcoded data detected** - ALL data is mock/static
  - `statusData` (Planning:8, In Progress:15, On Hold:4, Completed:11, Cancelled:2) - hardcoded
  - `delayedProjects` (FTTH Zone A, Fiber Backbone, etc.) - hardcoded
  - `recentActivities` (Kamal Perera, Saman Silva, etc.) - hardcoded
  - Active Projects: 23, Budget: LKR 485M, Spend: LKR 312M - **ALL HARDCODED**
  - **Status: ❌ NOT WORKING - No real data integration**

### 1.2 Financials Dashboard `/projects/dashboards/financials/`
- [x] **Hardcoded data detected** - ALL data is mock/static
  - Top Expenses by Category - hardcoded (Material Procurement LKR 142M, etc.)
  - Payment Voucher Status - hardcoded (Paid:145, Pending:52, Overdue:18, Draft:35)
  - Recent Transactions - hardcoded dates from "2025-04-08"
  - Total Budget LKR 485M, Total Invoiced LKR 178M, etc. - **ALL HARDCODED**
  - **Status: ❌ NOT WORKING - No real data integration**

### 1.3 Logistics Dashboard `/projects/dashboards/logistics/`
- [x] **Hardcoded data detected** - ALL data is mock/static
  - Stock Movements - hardcoded (GRN-2025-0421, etc.)
  - Low Stock Alerts - hardcoded (Fusion Sleeve, Optical Splitter, etc.)
  - **Status: ❌ NOT WORKING - No real data integration**

### 1.4 QAQC Dashboard `/projects/dashboards/qaqc/`
- [x] **Hardcoded data detected** - ALL data is mock/static
  - Recent Inspections - hardcoded
  - Quality Trend - hardcoded monthly data
  - **Status: ❌ NOT WORKING - No real data integration**

---

## ✅ CHECKED - Phase 2: Main Dashboard

### 2.1 `/dashboard` (Main)
- [x] Uses real API data from `/api/dashboard/stats`
- [x] **BUT**: This is SOD (Service Order) focused, not Project focused
- [x] Shows: Monthly Received, Invoicable, Completed, Return (SOD stats)
- [x] Shows: Contractor Performance, RTOM Performance, PAT results
- [x] Shows: Brought Forward (2025), 2026 Total Received/Completed
- **Status: ✅ Working but SOD-focused, not Project-focused**

### 2.2 `/api/dashboard/stats`
- [x] Uses `DashboardStat` model (pre-cached SOD stats per OPMC/rtom)
- [x] Live counts for monthly stats
- [x] Contractor groupBy queries working
- [x] SLT PAT status integration working
- [x] Aging report working
- **Status: ✅ Working but no project stats API exists**

---

## ✅ CHECKED - Phase 3: BOQ Module

### 3.1 BOQ CRUD API `/api/projects/boq`
- [x] POST - Create BOQ item ✅ (auto-calculates amount = quantity × unitRate)
- [x] PATCH - Update BOQ item ✅ (updates actualQuantity, actualCost)
- [x] DELETE - Delete BOQ item ✅
- [x] Validates required fields (projectId, itemCode, description, unit, quantity, unitRate)
- [x] Links to InventoryItem via materialId
- **Status: ✅ API Working**

### 3.2 BOQ UI Component `ProjectBOQ.tsx`
- [x] Add/Edit/Delete BOQ items ✅
- [x] SearchableItemSelect for inventory items ✅
- [x] Auto-populates itemCode, description, unit from selected inventory item ✅
- [x] Total Budget auto-calculated ✅
- [x] Actual vs Planned comparison ✅
- **Status: ✅ UI Working**

### 3.3 GIS Auto BOQ Generation
- [x] `boq-engine.ts` exists at `src/lib/gis/boq-engine.ts`
- [x] Can auto-generate BOQ items from GIS cable/pole/FDP data
- [x] Part of the GIS import pipeline
- **Status: ✅ Code exists, needs end-to-end testing**

---

## ✅ CHECKED - Phase 4: Material Management

### 4.1 Material Issue (StockIssue)
- [x] **POST `/api/projects/stock-issue`** - Creates PENDING issue ✅
  - Verifies stock availability ✅
  - Generates issue number (ISS-2026-XXXX) ✅
  - **BUG**: Uses `issuer = await prisma.user.findFirst()` instead of session user ⚠️
- [x] **GET `/api/projects/stock-issue?projectId=X`** - Lists issues ✅
- [x] **POST `/api/projects/stock-issue/approve`** - Approves issue ✅
  - Double-checks stock availability ✅
  - Deducts stock from InventoryStore ✅
  - Updates BOQ actualQuantity and actualCost ✅
  - Updates Project actualCost ✅
  - Uses transaction for atomicity ✅
- **Status: ✅ Working with minor auth bug**

### 4.2 Material Return (ProjectMaterialReturn)
- [x] Schema models exist (`ProjectMaterialReturn`, `ProjectMaterialReturnItem`) ✅
- [x] Approval workflow exists (`approvedById`, `approvedAt`) ✅
- [x] Condition tracking (GOOD/DAMAGED) ✅
- **Status: ⚠️ Need to verify the return API endpoint exists and works**

### 4.3 Material Issue UI
- [x] `ProjectMaterialIssues.tsx` - Full UI with tabs for Issues and Returns ✅
- [x] Store selection ✅
- [x] Item selection with quantity ✅
- [x] Create/Approve workflow ✅
- **Status: ✅ UI Working**

---

## ✅ CHECKED - Phase 5: GIS Integration

### 5.1 GIS Import Pipeline
- [x] `GISImportService.ts` - Full orchestration engine (922 lines) ✅
- [x] File upload support ✅
- [x] GeoJSON parsing (`gis-parser.ts`) ✅
- [x] Validation (`gis-validator.ts`) ✅
- [x] Project type detection (`project-type-detector.ts`) ✅
- [x] BOQ generation (`boq-engine.ts`) ✅
- [x] Asset generation (`asset-engine.ts`) ✅
- [x] Survey generation (`survey-generator.ts`) ✅
- [x] Permit generation (`permit-generator.ts`) ✅
- [x] Analytics (`gis-analytics-engine.ts`) ✅
- [x] Workflow definitions (`workflow-definitions.ts`) ✅
- **Status: ✅ Full pipeline exists, needs end-to-end testing**

### 5.2 GIS Upload API `/api/gis/`
- [x] API endpoints exist ✅
- **Status: ✅ APIs exist**

### 5.3 Path Data / QGIS
- [x] Sample GIS data at `KL-SVK-0567/` ✅
- [x] Upload script `upload-qgis.mjs` ✅
- [x] GISRoute model in schema ✅
- **Status: ✅ Assets exist**

---

## ✅ CHECKED - Phase 6: Stats & Auto-calculation

### 6.1 Project Progress Auto-calculation
- [x] `project.progress` field defaults to 0
- [x] **NO auto-calculation mechanism exists** ❌
  - Progress should be calculated from:
    - Milestones completion ratio
    - BOQ actual vs planned quantities
    - Task completion ratio
    - Workflow stage progression
- **Status: ❌ NOT WORKING - Manual update only**

### 6.2 Project Actual Cost Auto-update
- [x] Updated when StockIssue is approved ✅ (from `stock-issue/approve/route.ts`)
- [x] **BUT**: Not updated from Expenses, Timesheets, or Invoice payments ❌
- **Status: ⚠️ Partial - only updates from material issues**

### 6.3 Budget vs Actual / Variance
- [x] `project.budget`, `project.actualCost`, `project.variance` fields exist
- [x] `variance` field is **never calculated** ❌
- **Status: ❌ NOT WORKING - variance field unused**

### 6.4 DashboardStat Model
- [x] `DashboardStat` model exists (SOD-focused per OPMC/rtom)
- [x] Used by `/api/dashboard/stats`
- [x] **No equivalent for Project stats** ❌
- **Status: ⚠️ SOD stats cached, Project stats missing**

---

## ✅ CHECKED - Phase 7: API Endpoints Audit

### API Routes Status:
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/projects` | GET | ✅ | Filters: status, type, opmcId, projectTypeId |
| `/api/projects` | POST | ✅ | Creates project + auto-init workflow |
| `/api/projects` | PATCH | ✅ | Updates project fields |
| `/api/projects` | DELETE | ✅ | Deletes project |
| `/api/projects/[id]` | GET | ✅ | Full project details with relations |
| `/api/projects/boq` | POST/PATCH/DELETE | ✅ | CRUD operations |
| `/api/projects/stock-issue` | GET/POST | ✅ | Material issue management |
| `/api/projects/stock-issue/approve` | POST | ✅ | Approval with stock deduction |
| `/api/projects/return` | GET/POST | ⚠️ | Need to verify |
| `/api/projects/return/approve` | POST | ⚠️ | Need to verify |
| `/api/projects/milestones` | - | ⚠️ | Need to verify |
| `/api/projects/expenses` | - | ⚠️ | Need to verify |
| `/api/projects/tasks` | - | ⚠️ | Need to verify |
| `/api/dashboard/stats` | GET | ✅ | SOD-focused dashboard stats |
| `/api/dashboard/alerts` | GET | ✅ | Inventory low stock alerts |

---

## 🔴 CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **All 4 Project Dashboards use hardcoded data** | 🔴 CRITICAL | `/projects/dashboards/pm/`, `financials/`, `logistics/`, `qaqc/` |
| 2 | **No Project Stats API** | 🔴 CRITICAL | Missing - need `/api/projects/stats` or `/api/dashboard/project-stats` |
| 3 | **Project progress never auto-calculated** | 🟡 HIGH | `project.progress` stays 0 unless manually set |
| 4 | **Project variance never calculated** | 🟡 HIGH | `project.variance` always null |
| 5 | **ActualCost only updates from material issues** | 🟡 HIGH | Expenses, timesheets don't update it |
| 6 | **Stock issue uses `findFirst` user instead of session** | 🟡 MEDIUM | `/api/projects/stock-issue/route.ts` line 10 |
| 7 | **No Project dashboard API route** | 🟡 MEDIUM | Need dedicated project stats endpoint |

---

## 📋 RECOMMENDED FIX ORDER

1. **Create Project Stats API** (`/api/dashboard/project-stats` or `/api/projects/stats`)
2. **Create Project Dashboards API** to serve real data
3. **Fix PM Dashboard** - Replace hardcoded data with API calls
4. **Fix Financials Dashboard** - Replace hardcoded data with API calls
5. **Implement auto-progress calculation** - Based on milestones, BOQ, tasks
6. **Implement variance calculation** - budget - actualCost
7. **Fix Logistics Dashboard** - Replace with real inventory queries
8. **Fix QAQC Dashboard** - Replace with real inspection queries
9. **Fix auth in stock-issue** - Use session user instead of findFirst
