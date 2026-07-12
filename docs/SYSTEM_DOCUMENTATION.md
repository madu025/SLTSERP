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

## 3. Deployment & Infrastructure Setup

### 3.1 Local Development Setup (Docker)
1. **Start Services:**
   ```bash
   docker compose up -d
   ```
2. **Configure local `.env`:**
   ```env
   DATABASE_URL="postgresql://sltserp_user:YourSecurePassword123!@localhost:5432/sltserp_db?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://sltserp_user:YourSecurePassword123!@localhost:5432/sltserp_db"
   ```
3. **Database Client generation:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```
4. **Local pgAdmin Access:**
   * **URL:** `http://localhost:5050`
   * **Username:** `admin@sltserp.local` | **Password:** `admin123`
   * **Database Host:** `postgres`

### 3.2 Remote VPS Production Setup (Ubuntu/Debian)
1. **Connect via SSH:**
   ```bash
   ssh -i /path/to/sltserpkey.pem ubuntu@your-server-ip
   ```
2. **Docker Installation Commands:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y apt-transport-https ca-certificates curl software-properties-common unzip
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
   sudo systemctl start docker && sudo systemctl enable docker
   sudo usermod -aG docker $USER
   ```
3. **Firewall (UFW):**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

### 3.3 CI/CD Deployment via GitHub Actions
GitHub Repository Secrets required:
* `SERVER_IP`, `SERVER_USER`, `SSH_PRIVATE_KEY`
* `DATABASE_URL`, `DIRECT_URL`
* `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`

Every push to the `main` branch builds a **Next.js Standalone** package, bundles configs/Dockerfiles, copies via SCP, and restarts production compose stacks on the VPS:
```bash
sudo docker compose -f docker-compose.prod.yml up -d --build
```

### 3.4 Production Database Administration

#### Seeding Initial Admin Account:
```bash
docker exec sltserp-app node prisma/seed.js
# Admin Username: admin
# Admin Password: Admin@123 (Change immediately!)
```

#### Automated Daily Backups Script (Cron):
1. **Script Path:** `~/slts-erp/backup.sh`
   ```bash
   #!/bin/bash
   BACKUP_DIR=~/slts-erp/backups
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_FILE="$BACKUP_DIR/sltserp_backup_$DATE.sql"
   docker exec sltserp-postgres pg_dump -U sltserp_user sltserp_db > "$BACKUP_FILE"
   gzip "$BACKUP_FILE"
   find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
   ```
2. **Cron Entry (`crontab -e`):**
   ```cron
   0 2 * * * ~/slts-erp/backup.sh >> ~/slts-erp/backup.log 2>&1
   ```

#### PostgreSQL Performance Tuning (4GB+ RAM):
Connect to DB shell `docker exec -it sltserp-postgres psql -U sltserp_user -d sltserp_db` and run:
```sql
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
SELECT pg_reload_conf();
```

#### Migrating Data from Supabase (Optional):
```bash
# Dump from Supabase
pg_dump "postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres" > supabase_backup.sql
# Import to Docker PostgreSQL container
docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < supabase_backup.sql
```

#### Backing Up Uploads Storage Volume:
```bash
docker run --rm -v sltserp_uploads_data:/data -v $(pwd):/backup alpine tar czf /backup/uploads_backup_$(date +%Y%m%d).tar.gz -C /data .
```

#### Securing & Exposing Remote PostgreSQL (for QGIS Desktop):
1. **Expose Port in `docker-compose.prod.yml`:**
   ```yaml
   ports:
     - "5432:5432"
   ```
2. **UFW Restrictions:**
   ```bash
   sudo ufw allow from YOUR_OFFICE_IP to any port 5432
   ```
3. **Generate SSL Certs & Configure:**
   ```bash
   openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key -subj "/CN=sltserp-postgres"
   docker cp server.crt sltserp-postgres:/var/lib/postgresql/
   docker cp server.key sltserp-postgres:/var/lib/postgresql/
   docker exec -u root sltserp-postgres chown postgres:postgres /var/lib/postgresql/server.crt /var/lib/postgresql/server.key
   docker exec -u root sltserp-postgres chmod 600 /var/lib/postgresql/server.key
   docker exec -it sltserp-postgres bash -c 'echo "ssl = on" >> /var/lib/postgresql/data/postgresql.conf'
   docker exec -it sltserp-postgres bash -c 'echo "ssl_cert_file = '\''/var/lib/postgresql/server.crt'\''" >> /var/lib/postgresql/data/postgresql.conf'
   docker exec -it sltserp-postgres bash -c 'echo "ssl_key_file = '\''/var/lib/postgresql/server.key'\''" >> /var/lib/postgresql/data/postgresql.conf'
   docker compose -f docker-compose.prod.yml restart postgres
   ```

### 3.5 QFieldCloud Self-Hosted Deployment
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

## 8. Procurement & Material Request Workflows

### 8.1 Material Request & Approval Process
1. **Request:** Stores Manager creates a requisition list mapping the requested item IDs and quantities via `POST /api/inventory/requests`.
2. **Approval:** OSP Manager reviews the request. They can edit quantities and add remarks:
   * **Approved:** Status updates to `APPROVED` (if external) or `COMPLETED` (if internal store transfer).
   * **Rejected:** Status updates to `REJECTED`.
3. **Ordering:** Stores Manager exports the approved item list to email and triggers the request to the SLT Procurement team.

### 8.2 Goods Receipt Note (GRN) Verification
When materials arrive physically:
1. Stores Manager opens the GRN form and selects the linked `StockRequest`.
2. Inputs the actual received quantities and the **SLT Delivery Note ID** (`sltReferenceId`).
3. **Prisma Compare Logic:**
   The frontend automatically calculates the variance between approved quantities and actual received quantities to display a verification status:
   * **EXACT:** Received quantity equals approved quantity.
   * **SHORT:** Received quantity is less than approved quantity (shows negative variance).
   * **EXTRA:** Received items are not in the approved request list.

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
