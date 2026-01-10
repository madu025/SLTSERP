# SLTSERP System Map

This document serves as a comprehensive reference for the SLTSERP project structure, including all pages, API routes, services, and core components.

## 1. Project Overview & Architecture
- **Framework**: Next.js 15
- **ORM**: Prisma (with Supabase connection pooling)
- **Database**: PostgreSQL (Supabase)
- **Charts**: Recharts (with TS fixes)
- **Authentication**: NextAuth.js
- **Design Pattern**: Service-Repository Pattern (Migrating)
- **UI Components**: Shadcn/UI (Radix UI)

---

## 2. Frontend Pages (`src/app`)

### Administration Area (`/admin`)
- **/admin**: Main Admin Dashboard Dashboard overview.
- **/admin/access-rules**: Policy-based access management.
- **/admin/contractors**: Master management for contractors and approvals.
- **/admin/inventory**: Store-specific inventory management.
- **/admin/opmcs**: Area/OPMC configuration.
- **/admin/roles**: System-wide role definition.
- **/admin/sections**: Functional section/module management.
- **/admin/users**: User account management and category assignment.
- **/admin/user-permissions**: Granular page access control.
- **/admin/user-assignments**: Assigning users to sections/roles.

### Functional Modules
- **/dashboard**: General landing page after login.
- **/projects**: Project lifecycle management.
    - `/[id]`: Project details, BOQ, milestones, and material issues.
- **/service-orders**: Field service order tracking.
- **/restore-requests**: Managing service restoration tasks.
- **/inventory**: Material stock monitoring and stock requests.
- **/procurement**: Purchase request and approval workflow.
- **/invoices**: Finance/billing tracking.
- **/reports**: Operational and management analytics.
    - `/manager`: Executive dashboard. (Fixed chart type errors & missing imports)
- **/service-orders**: Field service order tracking. (Fixed ScheduleModal Zod types)

---

## 3. API Routes (`src/app/api`)

### Core Data APIs
- **/api/users**: CRUD for user data.
- **/api/auth**: NextAuth authentication handlers.
- **/api/opmcs**: RTOM/OPMC master data.
- **/api/banks**: Bank and branch details.
- **/api/inventory/items**: Master item list for materials.

### Business Logic APIs
- **/api/admin/sections/[id]**: Section management (Async Params fixed).
- **/api/admin/users/[userId]/permissions**: User permission overrides. (Fixed unknown[] type error)
- **/api/contractors/public-register/[token]**: Public portal for contractor self-registration.
- **/api/projects/[id]**: Project details retrieval.
- **/api/projects/stock-issue/approve**: Approving material issues to projects. (Fixed nullable projectId build error)

---

## 4. Services Layer (`src/services`)
(Current migration status: In Progress)
- **ContractorService**: Handles contractor enrollment, link generation, and team management.
- **InventoryService**: (Planned) Handles stock movements and requests.
- **ProjectService**: (Planned) Centralized project logic.

---

## 5. Database Schema (`prisma/schema.prisma`)
### Core Models
- **User**: Authentication and profile.
- **Contractor**: Legal and contact info for external firms.
- **ContractorTeam**: Groups of laborers under a contractor.
- **Project**: High-level task (e.g., OSP deployment).
- **SOD (Service Order Details)**: Individual tasks within projects.
- **InventoryItem**: Master items (cables, connectors, etc.).
- **InventoryStore**: Physical locations for items.
- **StockRequest**: Requests for materials from stores.

---

## 6. Known Deployment Constraints (Vercel)
- **Next.js 15 Compatibility**: All dynamic routes MUST await `params`.
- **Case Sensitivity**: Component names (e.g., `tabs.tsx`) must match exactly in Git.
- **Prisma Client**: Must use `postinstall: prisma generate`.
- **Scripts**: Excluded from TS build in `tsconfig.json` to prevent global scope clashes.

---

## 7. Missing/Required UI Components
- [x] **Tabs** (Added as `tabs-new.tsx`)
- [x] **Switch** (Recently added)
- [ ] **DropdownMenu** (To be verified if needed)
- [ ] **Tooltip** (To be verified if needed)

## 8. Next Priorities
1. **Monitor Vercel Build**: Ensure the current deployment finishes successfully.
2. **Post-Deployment Migration**: Run `npx prisma db push` or migrations on the live database.
3. **Verify Async Params**: Double-check any remaining dynamic routes.
*Last Updated: 2026-01-10*
