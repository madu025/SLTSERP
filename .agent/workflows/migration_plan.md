---
description: Migration guide to convert the current Monolithic Next.js architecture to a Service-Repository Pattern.
---

# SLTSERP Migration Plan: Service-Repository Architecture

This document outlines the step-by-step plan to migrate the existing SLTSERP (20% developed) to a professional, scalable **Service-Repository Architecture**. This ensures no functionality is lost while significantly improving code quality, maintainability, and future-readiness (Mobile App support).

## 🎯 Objective
To decouple "Business Logic" from "API Routes" by introducing a dedicated **Service Layer**.

**Current Flow (The Problem):**
UI -> API Route (`route.ts` contains Validation + Logic + Database Calls) -> Database

**New Flow (The Solution):**
UI -> API Route (Controller) -> **Service Layer (Logic)** -> Database

---

## 🏗️ Phase 1: Foundation Setup (Architecture Scaffold)

Before migrating existing code, we must create the directory structure and types.

1.  **Create Directory Structure**
    *   Create `src/services/` (For Business Logic).
    *   Create `src/lib/api-response.ts` (Standardized JSON responses).
    *   Create `src/types/` (Shared TypeScript interfaces if not present).

2.  **Standardize API Responses**
    *   Create a helper function to ensure all API responses follow the format: `{ success: boolean, data: any, message: string, error?: any }`. This is crucial for Mobile Apps.

---

## 🚀 Phase 2: Module-by-Module Migration

We will migrate strict module by module to perform precise testing and ensure **0% functionality loss**.

### Step 1: Contractor Module (Priority: High)
*Current Status: Basic CRUD implemented, Logic mixed in `route.ts`.*

1.  **Create Service**: `src/services/contractor.service.ts`
    *   Move `createContractor` logic (Prisma create, Team creation loop) here.
    *   Move `updateContractor` logic (Prisma update, Team syncing logic) here.
    *   Move `getAllContractors` queries logic here.
    *   Move `deleteContractor` logic here.
2.  **Refactor API**: `src/app/api/contractors/route.ts`
    *   Delete direct Prisma calls.
    *   Import `ContractorService`.
    *   Call `ContractorService.create(...)`, etc.
    *   Wrap in `try-catch` blocks utilizing standard error responses.
3.  **Refactor Public API**: `src/app/api/contractors/public/route.ts`
    *   Move logic to `ContractorService.verifyPublicToken()` and `ContractorService.uploadDocuments()`.
4.  **Verify**: Test Create, Edit, Document Upload, and Approval flows.

### Step 2: Inventory Module (Priority: High)
*Current Status: Complex Logic in Stock Requests and Movements.*

1.  **Create Service**: `src/services/inventory.service.ts`
2.  **Migrate Logic**:
    *   **Stock In (GRN)**: Move logic that updates `InventoryStock` when `GRN` is created.
    *   **Stock Transfer**: Move logic that decrements `fromStore` and increments `toStore`.
    *   **Low Stock Alerts**: Implement logic to check `minLevel` inside the service functions.
3.  **Refactor APIs**: Update all `src/app/api/inventory/...` routes.

### Step 3: Service Order (SOD) Module (Priority: Medium)
*Current Status: SOD creation and Status updates.*

1.  **Create Service**: `src/services/sod.service.ts`
2.  **Migrate Logic**:
    *   Status change logic (e.g., if Status = COMPLETED, check mandatory fields).
    *   Material usage calculations.

### Step 4: User & Auth Module (Priority: Low - Already somewhat separated)
*Current Status: `auth.ts` exists, but can be improved.*

1.  **Create Service**: `src/services/user.service.ts`
2.  **Migrate Logic**: Role checks, User creation, and Profile updates.

---

## 📋 Coding Standards for New Architecture

**1. Service Rules:**
*   **No `NextResponse`**: Services must NEVER return `NextResponse`. They return plain Javascript Objects or throw Errors.
*   **Db Access**: Only Services are allowed to import `prisma`. API Routes should NEVER import `prisma`.
*   **Validation**: Zod schema validation should happen in the API Route *before* calling the Service, OR inside the Service method. (Recommendation: Inside Service for tighter security).

**2. Error Handling:**
*   Services should throw named errors: `throw new Error("CONTRACTOR_NOT_FOUND")`.
*   API Routes catch these and return `404` or `400` accordingly.

---

## ✅ Migration Checklist (To be used by Developer)

- [ ] **Setup**: Create `src/services` folder.
- [ ] **Contractor**: Migrate `POST /api/contractors`.
- [ ] **Contractor**: Migrate `PUT /api/contractors`.
- [ ] **Contractor**: Migrate `GET /api/contractors`.
- [ ] **Contractor Public**: Migrate `POST /api/contractors/public`.
- [ ] **Testing**: Verify Contractor Flow manually.
- [ ] **Inventory**: Identify all Inventory API routes.
- [ ] **Inventory**: Migrate Stock Logic to `inventory.service.ts`.
- [ ] **Testing**: Verify Stock Updates.

---

This document serves as the "Master Plan". We can now invoke the Agent to execute "Step 1: Contractor Module" immediately following this guide.
