# 📘 SLTS OSP Nexus - Ultimate System Manual & Documentation

---

## 📋 Table of Contents
1. **[1. System Overview & Architecture](#1-system-overview--architecture)**
2. **[2. File Index & Component Cross-Reference](#2-file-index--component-cross-reference)**
3. **[3. Deployment & Infrastructure Setup](#3-deployment--infrastructure-setup)**
4. **[4. Cloudflare Tunnel & Network Config](#4-cloudflare-tunnel--network-config)**
5. **[5. Essential Commands Guide](#5-essential-commands-guide)**
6. **[6. Scalability & Reliability Roadmap](#6-scalability--reliability-roadmap)**
7. **[7. Mobile Survey & QField Workflows](#7-mobile-survey--qfield-workflows)**
8. **[8. Procurement & Material Request Workflows](#8-procurement--material-request-workflows)**
9. **[9. SOD Revenue Configuration System](#9-sod-revenue-configuration-system)**
10. **[10. Vehicle Management Module](#10-vehicle-management-module)**

---

## 1. System Overview & Architecture

### 1.1 Project Purpose (පද්ධති හැඳින්වීම)
**SLTS OSP Nexus (SLTSERP)** යනු **Sri Lanka Telecom (Services) Ltd. (SLTS)** ආයතනයේ **Outside Plant (OSP)** සේවා ඇණවුම් (Service Orders - SOD), තොග කළමනාකරණය (Inventory Management), අනුබද්ධ කොන්ත්‍රාත්කරුවන් කළමනාකරණය (Contractor Management), ක්ෂේත්‍ර සමීක්ෂණ (Mobile Survey) සහ බිල්පත්කරණය (Invoicing) විධිමත් කිරීම සඳහා නිර්මාණය කර ඇති වෙබ් පාදක ERP (Enterprise Resource Planning) පද්ධතියකි.

* **Core Goal:** සේවා සපයන්නන් සහ කොන්ත්‍රාත්කරුවන් අතර සම්බන්ධතාවය විනිවිදභාවයකින් යුතුව පවත්වා ගැනීම. ද්‍රව්‍ය නිකුත් කිරීමේ සිට (Material Issue) ඒවා භාවිතය (Material Usage) සහ ඉතිරි ද්‍රව්‍ය නැවත භාරදීම (Material Return/Reconciliation) දක්වා වූ ක්‍රියාවලිය ස්වයංක්‍රීය කිරීම.
* **Architecture:** Next.js 15, Prisma ORM, PostgreSQL (PostGIS), Redis, Nginx, and GeoServer.

```mermaid
graph TD
    classDef focus fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px;
    classDef process fill:#f59e0b,stroke:#d97706,color:#fff,stroke-width:2px;
    classDef store fill:#10b981,stroke:#059669,color:#fff,stroke-width:2px;

    A[I-SHAMP Excel / Manual SOD Input] -->|Imports Service Orders| B(SOD Management Module):::focus
    B -->|Assigns SODs to Teams/Contractors| C(Contractors & Teams):::process
    
    D[Stores Manager] -->|Material Requests| E(Inventory / Store Module):::store
    F[OSP Manager] -->|Approves Requests| E
    
    E -->|Issues Stock to Contractor| C
    C -->|Executes SODs using issued items| B
    
    B -->|PAT Verification & Approval| G(Service Assurance Module):::process
    G -->|Triggers Auto Billing based on Revenue Config| H(Invoicing & Finance Module):::focus
    
    I[Office Admin Module] -->|Tracks Hired Vehicles, Fuel, Office Rent| H
```

### 1.2 Core System Modules (ප්‍රධාන මොඩියුලයන්)
1. **Inventory & Store Management:** ප්‍රධාන සහ ශාඛා ගබඩා (Main & Sub Stores) අතර ද්‍රව්‍ය හුවමාරුව සහ නිකුත් කිරීම් පාලනය කරයි (GRN, MRN, Request & Approval).
2. **SOD Management:** Excel Import (SLT I-SHAMP) සහ Contractor Assignment හරහා සේවා ඇණවුම් නිරීක්ෂණය සහ ආදායම් වින්‍යාස කිරීම.
3. **Contractor Management:** Self-Registration Portal (NIC, BR, Police Report, Payment Slip බාහිරව ඇතුලත් කිරීම) සහ කණ්ඩායම් (Teams) කළමනාකරණය.
4. **Service Assurance (PAT):** දෛනික වැඩ ප්‍රගතිය සහ සේවක ධාරිතාව (Pre-PAT, SLT PAT) නිරීක්ෂණය.
5. **Office Administration:** Hired Vehicles, Fuel limit allocation, සහ Office rent tracking.

---

## 2. File Index & Component Cross-Reference

| Feature Area | File Path | Purpose |
|:---|:---|:---|
| **Project CRUD** | `src/app/api/projects/route.ts`<br>`src/app/api/projects/[id]/route.ts`<br>`src/app/projects/page.tsx`<br>`src/app/projects/[id]/page.tsx` | Next.js API routes and frontend pages for Project lifecycle management. |
| **QFieldCloud Sync** | `src/services/qfieldcloud-sync.service.ts`<br>`src/app/api/projects/[id]/qfield-sync/route.ts`<br>`src/components/projects/QFieldConfigForm.tsx` | Sync service handling QFieldCloud delta APIs, layers, projects creation, and forms customization. |
| **Survey Sessions** | `src/app/api/projects/[id]/survey/sessions/route.ts`<br>`src/app/api/projects/[id]/survey/points/route.ts` | Captures multi-day surveyor points and manages sessions in DB. |
| **Map Approval** | `src/services/map-approval.service.ts`<br>`src/components/projects/ProjectSurveyApproval.tsx` | 3-step point approval engine (Verify → Approve → Reject/Flag). |
| **Auto-BOQ Engine** | `src/services/auto-boq.service.ts`<br>`src/app/api/projects/[id]/boq/generate/route.ts` | Calculates cables, poles, joints, and chambers using telecom routing formulas. |
| **Procurement Workflow** | `src/services/slt-material-workflow.md` (Archived)<br>`src/app/api/projects/requisitions/route.ts`<br>`src/app/api/projects/goods-receipts/route.ts` | Handles PR creation, RFC/Quotations, PO generation, and GRN comparison. |
| **Change Requests** | `src/services/change-request.service.ts`<br>`src/app/api/projects/[id]/change-requests/route.ts` | Dynamic financial threshold approvals (<100K/500K). |
| **Route Versioning** | `src/services/route-version.service.ts`<br>`src/app/api/projects/[id]/gis/[routeId]/versions/route.ts` | Mapped route version snapshots, histories, and rollbacks. |
| **PAT Verification** | `src/services/pat.service.ts`<br>`src/components/projects/ProjectPAT.tsx` | Mapped points PAT checklists and results. |
| **Invoicing & Finance** | `src/app/api/projects/invoices/route.ts`<br>`src/app/api/projects/payment-vouchers/route.ts` | 3-level payment approvals and retention tracking. |

---

## 3. Deployment & Infrastructure Architecture

Due to the extreme workload parameters of the SLTSERP system (**500 total users, 200 concurrent users, 200,000 JSON PAT pass writes/hour, 15-minute RTOM SOD syncs, Internal Reporting Services**), the architecture strictly utilizes sustained-CPU infrastructure with split read/write database nodes. AWS Lightsail is explicitly NOT recommended due to CPU burst-credit throttling under continuous load.

### 3.1 Recommended Production Architecture

#### Option A: Self-Hosted DigitalOcean Stack (Max Control)
- **VPS 1 (App Node):** DO Droplet (4GB RAM, 2 vCPUs) - Runs Next.js, Redis, Nginx.
- **VPS 2 (DB Write Master):** DO Droplet (4GB RAM) - Runs PostgreSQL Primary, handles the 200,000 JSON sync writes.
- **VPS 3 (DB Read Replica):** DO Droplet (4GB RAM) - Handles Dashboard analytical queries to prevent write-locking.
- **Storage:** DO Spaces (S3 Compatible).

#### Option B: Hybrid Managed Cloud (Zero Maintenance)
- **App Node:** DigitalOcean Droplet (4GB RAM, 2 vCPUs).
- **Primary DB Node:** Supabase Pro Managed PostgreSQL.
- **Replica DB Node:** Supabase Managed Read Replica.

### 3.2 Local Development Setup
1. **Start Services (Redis, etc):**
   ```bash
   docker compose up -d
   ```
2. **Configure local `.env`:**
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/sltserp"
   DIRECT_URL="postgresql://user:pass@localhost:5432/sltserp"
   ```
3. **Database Client generation:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

### 3.3 CI/CD Deployment via GitHub Actions
Every push to the `main` branch builds a **Next.js Standalone** package, bundles configs, copies via SCP to the DigitalOcean App Droplet, and restarts the runtimes.

### 3.4 QFieldCloud Self-Hosted Deployment
QFieldCloud runs in a dedicated stack on port `8100` via [docker-compose.qfield.yml](file:///d:/MyProject/SLTSERP/docker/qfieldcloud/docker-compose.qfield.yml):
* `qfield-db` (Postgres/PostGIS for cloud sync data - Port `8102`)
* `qfield-storage` (MinIO S3 for QGIS project `.qgz` files - Console Port `9001`)
* `qfield-api` (QFieldCloud Django API - Port `8100`)
* `qfield-worker` (Background sync tasks queue)

Start Stack:
```bash
cd docker/qfieldcloud
docker compose -f docker-compose.qfield.yml up -d
```

---

## 4. Cloudflare Tunnel & Network Config

### 4.1 Tunnel Configuration
To route mobile client requests securely to the QFieldCloud self-hosted stack without public port vulnerability, the system utilizes a Cloudflare Tunnel:
* **Public Domain:** `https://sltserp.vynorstore.com`
* **Windows Service Run Command:**
  ```powershell
  D:\MyProject\SLTSERP\cloudflared.exe tunnel run --token YOUR_CLOUDFLARE_TUNNEL_TOKEN
  ```

### 4.2 Critical Security Configurations

#### Django CSRF Security:
To prevent login issues from QField Mobile App due to domain validation failures, `qfieldcloud/settings.py` must trust the domain:
```python
CSRF_TRUSTED_ORIGINS = ["https://sltserp.vynorstore.com"]
```

#### Duplicate Tunnel Rule (Causes 502 Bad Gateway):
**NEVER** run `cloudflared` both on the Windows host and inside a Docker container with the same token simultaneously. The load-balancer will direct requests to the container, which does not have access to the app network, leading to mobile network errors.

#### Unlock locked surveyor account (Django Axes limit):
```bash
docker exec slt-qfield-api python3 manage.py axes_reset
```

---

## 5. Essential Commands Guide

### 5.1 Database Sync (Prisma Schema Updates)
Whenever you modify database tables inside `prisma/schema.prisma` or individual prisma schemas:
```bash
npm run db:sync
```
*(This pushes the schema changes to both the primary write DB and replica read DB).*

### 5.2 Server Deployment Commands
```bash
git add .
git commit -m "Describe code changes"
git push origin main
```
*(GitHub actions workflow will automatically handle the build and deployment on the server).*

### 5.3 System Health Checks
```bash
# Check compiler errors
npm run type-check
# View local container stats
docker stats
```

---

## 6. Scalability & Reliability Roadmap

### 6.1 Caching & Background Processing
* **Redis Caching:** Integrated permissions, OPMC area lists, and RTOM configs cache to relieve SQL queries.
* **Asynchronous Jobs:** Heavy computations (like Excel SOD uploads) queue in Redis via **BullMQ** so web requests never timeout.

### 6.2 Database Scaling
* **Read/Write DB Splitting:** Heavy read queries (reporting, statistics, exports) automatically route to a read-replica database to save write capacity on the primary.
* **Declarative Partitioning:** Planned database schemas for `ServiceOrder` table partitioning by Year/Quarter.
* **Trigram Indexing:** Enabled `pg_trgm` indexes for high-speed cross-field search strings.
* **Cursor Pagination:** Migrated from offset skip/take pagination to keyset cursor pagination to ensure fast list loading on 10M+ records.

---

## 7. Mobile Survey & QField Workflows

### 7.1 Mapped Layers Legend (12 Layers)

| Layer Name | Icon | Type | Mapped Material |
| :--- | :--- | :--- | :--- |
| **Existing Pole** | 🌳 | Point | Labor only (Reuse existing) |
| **New Pole** | 🔩 | Point | Concrete/GI pole + Labor |
| **Joint Closure** | 🔗 | Point | Splice joint closure + Splicing labor |
| **Enclosure/ODF** | 📦 | Point | Enclosure casing + ODF unit |
| **Cable Start (A-End)** | 🅰️ | Point | Cable length segment start |
| **Cable End (B-End)** | 🅱️ | Point | Cable length segment end |
| **Cable Mid-Point** | ➖ | Point | Intermediate route guide |
| **FDP Point** | 📍 | Point | Fiber Distribution Point |
| **Chamber** | 🕳️ | Point | Manhole chamber |
| **DP Location** | 🔀 | Point | Route change deviation point |
| **Road Crossing** | 🛣️ | Point | Special road crossing clearance |
| **Obstruction** | ⚠️ | Point | Obstacle indicator |

### 7.2 Core Field Survey Walkthrough (QField Mobile App)
1. **Download Project:** Open QField, connect to custom server `https://sltserp.vynorstore.com`, log in, and download the assigned project.
2. **Center GPS:** Tap the crosshair target icon. Walk to the first pole.
3. **Add Pole:** Turn on Edit Mode (pencil icon), select the `New Pole` layer, tap **Plus (+)** to mark the point, select specifications (e.g. `Concrete`, `7.5m`), and save.
4. **Draw Cables:** 
   * Switch the active edit layer to `Cable Start`. Mark the start point and assign a `section_number` (e.g. `1`), select cable type (`24F SM`).
   * Switch to `Cable Mid-Point`. Tap **Plus (+)** at every intermediate pole you walk past, entering `section_number = 1`.
   * At the termination point, switch to `Cable End`. Place a point, setting `section_number = 1`.
5. **Sync Data:** Tap the Menu button, click the Cloud Sync icon, and select **Synchronize (Push Changes)**.

---

## 8. Stores & Inventory Management Module

The Stores and Inventory module tracks the lifecycle of materials from procurement forecasting and goods receipt (GRN) to FIFO-based contractor issuing, virtual swaps, and material return notes (MRN).

```mermaid
graph TD
    A[Procurement Forecast] -->|PO Generation| B(Main Store / Sub Store)
    B -->|1. Physical Delivery & GRN| C{GRN Verification}
    C -->|Exact / Short / Extra| D[Inventory Stock Batches]
    D -->|2. Material Issue Request| E{FIFO Batch Picker}
    E -->|Auto-allocate oldest stock first| F[Contractor / Team Custody]
    F -->|3. Project Construction| G(SOD Material Usage)
    F -->|4. Unused Inventory Returns| H(Material Return Notes - MRN)
    F -->|5. Damaged Stock| I(Wastage Logging & Approval)
    F -->|6. Virtual Swap| J(Bulk Inventory Swaps)
```

### 8.1 Requisition & Goods Receipt Note (GRN) Verification
1. **Stock Request:** Stores Manager creates stock request mapping requested item IDs and quantities via `POST /api/inventory/requests` based on forecasted material limits.
2. **Approval Gate:** OSP Manager reviews and updates status to `APPROVED` or `REJECTED`.
3. **GRN Verification:** 
   When materials arrive physically, the Stores Manager inputs actual received quantities and the **SLT Delivery Note ID** (`sltReferenceId`). The system automatically compares the approved and received amounts:
   * **EXACT:** Received quantity matches approved request.
   * **SHORT:** Received quantity is less than approved (flags negative variance).
   * **EXTRA:** Received items are not in the approved request list.

### 8.2 FIFO-Based Stock Issuing (`pickStoreBatchesFIFO`)
To prevent stock from expiring or being misplaced, the inventory system strictly enforces **FIFO (First In First Out)** logic:
* When a contractor requests materials (cables, splices, poles), the system runs `pickStoreBatchesFIFO` or `pickContractorBatchesFIFO`.
* It auto-queries active `StockBatch` records sorted by `createdAt ASC`.
* It allocates the oldest batches first, decrementing store quantities and creating `StockTransaction` logs tracking batch history.

### 8.3 Virtual Swaps & Wastage Control
* **Virtual Swap (`executeBulkSwap`):** Allows bulk swap operations of physical items in contractor custody without manually rolling back individual SODs. It previews custody transitions to ensure no negative stock limits are reached.
* **Wastage Logging (`recordWastage`):** Enables tracking of damaged or unusable items on the field. Requires OSP manager approval (`approveWastage`/`rejectWastage`) before writing off stock balances.

### 8.4 Multi-Store Hierarchy & Inventory Auditing
* **Hierarchy:** Stock flows from the **Main Depot Store** to **Sub-Stores/OPMC Stores** (via Stock Requests), which is then issued to **Contractor Custody** (using FIFO allocation).
* **SLT-Direct Sourced Materials (ONT, STB, Phone):** Sourced directly from SLT to the **Area Coordinator**, bypassing the contractor's physical stores. The system logs their custody/serial codes (either one-by-one during construction/PAT or in bulk via Excel imports) to track allocation and verify usage.
* **Collected CPE Recovery & Handback Tracking:** Customer Premises Equipment (CPE) collected during installations (old routers, STBs, or phones) are logged in the SOD completion wizard. These are held in contractor custody (status: `PENDING_HANDBACK`) and later handed back to SLT monthly. Upon handback, their status is updated to `HANDED_BACK` with a recorded `handbackReference` code from the SLT receipt.
* **Inventory Transaction Logging (`TransactionService`):** Every single stock movement (GRN entry, contractor issue, MRN return, wastage write-off, virtual swap, SLT direct custody assignment) is logged in the `StockMovement` table to create a secure, immutable audit trail.

### 8.5 Re-Order Points (ROP) & Outstanding Valuation Reports
* **Low Stock Alerts (`checkLowStock`):** Monitored via the Re-Order Point (ROP) threshold. Triggered automatically when stock drops below the `minLevel` defined for an item.
* **Costing & Breakdown Reports:** Because each item in stock is linked to a specific `InventoryBatch` with a recorded `costPrice`, the AI and reporting engines can generate real-time financial summaries on:
  * **Outstanding Valuation:** Total millions of rupees of material currently in contractor custody (`quantity * batch.costPrice`).
  * **Breakdown Reports:** Grouped by Contractor, OPMC Region, Splicing/Fiber type, or aging intervals (0-30 days, 30-90 days, >90 days) to prevent material freezing.

---

## 9. SOD Revenue Configuration System

Administrators can configure the system to calculate different revenue rates per Service Order (SOD) based on regional office limits (RTOM) and circular date periods.

### 9.1 Priority-Based Lookup Logic
When an SOD is marked as PAT-passed, the billing engine resolves the revenue amount using this lookup precedence:
1. **RTOM-specific with active Date Range:** Highest priority (e.g. circular overrides).
2. **RTOM-specific permanent:** Regular rate for that specific RTOM.
3. **Default rate:** Global fallback (Rs. 10,500).

```typescript
async function getRevenueForSOD(rtomId: string, completedDate: Date): Promise<number> {
  // 1. RTOM-specific with active circular date range
  const rtomWithDate = await prisma.sODRevenueConfig.findFirst({
    where: {
      rtomId,
      effectiveFrom: { lte: completedDate },
      effectiveTo: { gte: completedDate },
      isActive: true
    }
  });
  if (rtomWithDate) return rtomWithDate.revenuePerSOD;
  
  // 2. RTOM-specific permanent rate
  const rtomPermanent = await prisma.sODRevenueConfig.findFirst({
    where: {
      rtomId,
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true
    }
  });
  if (rtomPermanent) return rtomPermanent.revenuePerSOD;
  
  // 3. Fallback to global default rate
  const defaultRate = await prisma.sODRevenueConfig.findFirst({
    where: { rtomId: null, isActive: true }
  });
  
  return defaultRate?.revenuePerSOD || 10500;
}
```

---

## 10. Vehicle Management Module

This module manages dispatch logs, expenses, driver overtime, and tax invoices for the hired/owned vehicle fleet.

### 10.1 Key Functionalities
1. **Vehicle Registration:** Supports cars, vans, cabs, double-cabs, mini-vans, lorries, boom trucks, and heavy trucks.
2. **Driver Shifts & Overtime (OT):** Tracks daily driver working hours. Automatically calculates OT hours and costs at multipliers (e.g. 1.5x, 2.0x) for shifts exceeding 8 hours/day or 40 hours/week.
3. **Insurance & Warranty Compliance:** Manages multiple policies per vehicle (theft, accident), sending alerts prior to policy renewals or warranty expiration limits.
4. **Hired Vehicles Fuel Limits:** Sets monthly fuel allocation quotas and tracks consumption efficiency (km/liter).
5. **Tax & Invoice Ledger:** Computes VAT, taxes, and rental periods (daily/monthly contracts), maintaining payments ledgers.

---

## 11. SOD Module Workflow & Lifecycle

The Service Order (SOD) module manages the end-to-end lifecycle of SLT service tasks, from import/sync to contractor completion, multi-stage PAT verification, and invoicing.

```mermaid
graph TD
    A[SLT External API] -->|1. Sync Service Orders / syncPatResults| B(SLTSERP Database - In Progress)
    B -->|2. Contractor Assignment| C(Contractor / Team Allocated)
    C -->|3. Field Execution & Completion| D(SOD Marked Completed)
    D -->|4. Materials Usage Tracking| E(SODMaterialUsage Recorded)
    D -->|5. Multi-Stage PAT Verification| F{All Stages Passed?}
    F -->|No: Rejected/Returned| H(SODMaterial Rollback & Ledger Reversal)
    F -->|Stage 1: OPMC PAT Pass| G1(opmcPatStatus = PAT_PASSED)
    G1 -->|Stage 2: Head Office PAT Pass| G2(hoPatStatus = PAT_PASSED)
    G2 -->|Stage 3: SLT HQ PAT Pass| G3(sltsPatStatus = PAT_PASSED)
    G3 -->|All 3 Passed| I(isInvoicable = true)
    I -->|6. Billing BOM Allocation| J(Contractor & Revenue Accounts Updated in Ledger)
```

### 11.1 Lifecycle States (`sltsStatus`)
1. **INPROGRESS:** Default state when synced/created. Managed by assigned contractor teams.
2. **COMPLETED:** Marked by contractor upon task execution. Triggers material deduction validations.
3. **SUSPENDED / DELAYED:** Flagged due to material shortages (e.g. `ontShortage`, `stbShortage`) or contractor delays.
4. **CANCELLED:** Order cancelled via SLT master API updates.

### 11.2 Periodic Sync Mechanism (`SODSyncService`)
* **Interval:** Runs every 15 minutes per OPMC area.
* **Pull Pipeline & External API Endpoints:** 
  1. Calls `sltApiService.fetchServiceOrders(rtom)` to retrieve active orders.
  2. Compares keys with local database (`soNum`).
  3. Inserts new entries (defaulting to `INPROGRESS`) and updates status/details of existing entries.
  4. Triggers `syncPatResults` by calling the following SLT portals to map third-party status overrides:
     * **OPMC PAT Status Endpoint:** `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=opmcpatrej&z=SLTS_[RTOM]` (e.g. `z=SLTS_R-MD` for regional OPMC checks).
     * **Head Office PAT Success Endpoint:** `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patsuccess&y=[DATE]&con=SLTS` (fetching successful/approved PATs globally or by date).
     * **Head Office PAT Rejected Endpoint:** `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patreject&y=[DATE]&con=SLTS` (fetching rejected PATs globally or by date).
* **Multi-Stage PAT Verification Rules:**
  - An SOD's `isInvoicable` flag is evaluated ONLY when the status is `COMPLETED` and it satisfies the **Three-Stage PAT Gate**:
    1. **OPMC PAT Pass (`opmcPatStatus === 'PAT_PASSED'`)**: Local/regional engineering check.
    2. **Head Office PAT Pass (`hoPatStatus === 'PAT_PASSED'`)**: SLTS Head Office review.
    3. **SLT HQ PAT Pass (`sltsPatStatus === 'PAT_PASSED'`)**: Sri Lanka Telecom HQ final sign-off.
  - **Billing BOM Entry:** Only when all three gates are `'PAT_PASSED'` does the order become `isInvoicable` and trigger ledger updates.
* **Financial & Material Alignment:**
  - If an order's status changes from `COMPLETED` to `CANCELLED` or is rejected during sync, the system triggers `rollbackMaterialUsage()` to return deducted inventory items and calls `rollbackSodTransaction()` to reverse ledger allocations.

