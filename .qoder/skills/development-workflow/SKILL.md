---
name: development-workflow
description: SLTSERP production development workflow covering service-layer architecture, apiHandler route standards, strict typing, Prisma schema rules, type safety, testing, and deployment procedures. Use when writing or modifying any code, API route, Prisma model, or page in the SLTSERP project.
---

# SLTSERP Development Workflow (Antigravity Standard)

This skill provides a systematic, "agentic-first" approach to developing features, fixing bugs, and maintaining elite code quality in the SLTSERP project. It follows the **Antigravity Development Standard**—a high-performance, modular, and aesthetically premium architecture.

## 🏆 Production-Level Development Guidelines
When writing or modifying code in this workspace, all agents must adhere to the following rules to ensure production-level quality:
1. **Decouple Controllers and Services**: Never import `prisma` or run database queries directly in dynamic API routes (`src/app/api/.../route.ts`). All business logic must be encapsulated in the Service layer (`src/services/`). API routes should only validate requests, invoke services, and return responses.
2. **Unified Route Handling (`apiHandler`)**: Every API endpoint handling mutations (POST, PUT, PATCH, DELETE) or complex reads must be wrapped in the `apiHandler` helper to ensure proper request validation (Zod schema checking), Role-Based Access Control (RBAC), automatic audit trail logging, and standardized JSON outputs.
3. **Strict Database Schema Relations**: Do not use "soft relationships" (saving mismatched keys/IDs without DB constraints). Ensure Prisma schemas define exact relational keys, mapping types correctly (e.g. `projectInvoiceId` referencing `ProjectInvoice`).
4. **Strategic Performance Indexing**: Add `@@index` annotations to any lookup or sorting fields in Prisma models that will be queried in loops or tables.
5. **Server-Side Pagination & Caching Checks**: Implement offset or cursor pagination at the database level for list pages. Prevent static caching issues on dynamic Next.js API routes by exporting `dynamic = 'force-dynamic'`.
6. **Codebase Structural Map Integration**: Always consult the codebase map file `.agent/CODEMAP.md` to locate services, functions, database models, and API routes before performing broad searches or loading entire files. To conserve tokens, do not read the entire map file directly; instead, use `grep_search` to pinpoint the matching line numbers and load only the required slice. Run `npm run codemap:update` after making any structural changes to keep the map in sync.
7. **Zero `any` Type Tolerance**: Never use `any` or `any[]` types. All variables, API payloads, error catches, and return types must be strictly typed using interfaces, `Record<string, unknown>`, `unknown`, or Zod validation schemas. Using `any` is strictly prohibited and violates code quality standards.
8. **Algorithmic Efficiency (Big-O)**: Avoid $O(N^2)$ loops (e.g., nested `find` or database queries inside a loop). Utilize $O(1)$ Hash Maps, Sets, and Prisma `$transaction` batch operations to optimize time and space complexity.
9. **Store Issue Note Numbers & Auditable Ledger Standards**: Every material issue, dispatch, transfer, or return MUST feature an explicit Store Material Issue Note Number (`issueNumber` / MIN / MRN Ref) displayed on both store and mobile views, writing an immutable SHA-256 checksum ledger entry in `InventoryLedger`.
10. **Email Template Auto-Wiring (MANDATORY)**: Whenever you add or modify any code that sends an email (`EmailService.sendMail(...)`), you MUST automatically wire it to the DB notification template system WITHOUT waiting for a user reminder. Do all of: (a) register a template code in `src/config/notification-templates.ts` (`TEMPLATE_CODES`) with label, description, category, placeholders, defaultEntityType; (b) seed a default styled HTML template for that code in `prisma/seed-notification-templates.ts`; (c) call `NotificationTemplateEngineService.renderEmailByCode(CODE, vars)` at the send site and fall back to hardcoded HTML only when no active DB template exists. The admin dropdown at `/admin/settings/notification-templates` is registry-driven and picks up new codes automatically. After touching email-sending code, run `npm run check:email-templates` — it fails if any `EmailService.sendMail` call site lacks `renderEmailByCode` wiring.
11. **Sidebar Menu Conventions (`src/config/sidebar-menu.ts`)**: When adding or modifying sidebar menu items in `SIDEBAR_MENU`: (a) every top-level section MUST have a **unique** `permissionId` — duplicate IDs break the access-policies admin page which deduplicates by ID; (b) top-level sections MUST use **distinct** icons — never reuse the same `lucide-react` icon for multiple top-level sections (collapsed sidebar becomes unreadable); (c) always reference `ROLE_GROUPS` constants from `src/config/roles.ts` instead of hardcoding role arrays — hardcoded lists become stale when roles change; (d) for menus with >10 submenus, use category comments (`// — Group Name —`) to organize items logically (matching the Inventory section pattern). The sidebar IS the single source of truth for route RBAC (`route-permissions.ts` derives all middleware rules from it).


## Project Overview

SLTSERP is a Next.js-based ERP system for SLT (Sri Lanka Telecom) Outside Plant (OSP) operations with the following tech stack:
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: Next.js API Routes, Service Layer Architecture
- **Database**: PostgreSQL with streaming replication (Primary + Replica)
- **ORM**: Prisma 6.19.1
- **State Management**: React Context API
- **Authentication**: NextAuth.js with role-based access control
- **Caching**: Redis for session and data caching
- **Background Jobs**: Bull Queue for async processing

## System Architecture

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── admin/             # Admin pages
│   ├── inventory/         # Inventory management pages
│   ├── service-orders/    # Service order management
│   └── contractors/       # Contractor management
├── components/            # Reusable React components
├── contexts/              # React Context providers
├── lib/                   # Utility libraries
│   ├── prisma.ts         # Prisma client with extensions
│   ├── auth.ts           # Authentication utilities
│   ├── events.ts         # Event emitter system
│   ├── cache.service.ts  # Redis caching layer
│   ├── queue.ts          # Background job queue
│   ├── stats.service.ts  # Statistics aggregation
│   └── validations/      # Zod validation schemas
├── services/              # Business logic layer (Facade + Sub-service Structure)
│   ├── contractor.service.ts # Contractor Facade
│   ├── contractor/        # Contractor sub-services
│   ├── sod.service.ts     # Service Order Facade
│   ├── sod/               # Service Order sub-services
│   ├── inventory.service.ts # Inventory Facade
│   ├── inventory/         # 26 inventory sub-services (stock, grn, mrn, issue, wastage, audit, cycle-count etc.)
│   ├── project.service.ts # Project Facade (redirects to subfolder)
│   ├── project/           # Project sub-services (core, boq, tasks, survey etc.)
│   ├── gis.service.ts     # GIS Facade (redirects to subfolder)
│   ├── gis/               # GIS sub-services (auto-plan, parser, road network etc.)
│   ├── finance/           # 38 finance sub-services (ledger, payment-voucher, bank, tax, ar-ap, capex, osp etc.)
│   ├── user.service.ts
│   └── notification.service.ts
└── workers/               # Background job workers

prisma/
├── schema/                  # Multi-file schema (Prisma 6 native multi-schema)
│   ├── _base.prisma         # generator + datasource ONLY
│   ├── enums.prisma         # All enums (Role, ContractorStatus, VM* etc.)
│   ├── user.prisma          # User, Staff, Notification, AuditLog
│   ├── opmc.prisma          # OPMC
│   ├── service-order.prisma # ServiceOrder, SOD*, PAT*, RestoreRequest
│   ├── contractor.prisma    # Contractor, Teams, Members, Performance
│   ├── inventory.prisma     # InventoryStore/Item/Stock/Batch/Serial
│   ├── stock-management.prisma # StockRequest/Issue, GRN, MRN, Contractor materials
│   ├── project-core.prisma  # Project, Job, BOQ, Tasks, Timesheets
│   ├── project-finance.prisma  # Invoice, PO, GR, Payment, Vendors
│   ├── project-workflow.prisma # Workflow engine models
│   ├── project-advanced.prisma # EVM, Risks, AI Predictions, Assets
│   ├── gis.prisma           # GISRoute, Pole, Chamber, Closure, Cable
│   ├── survey.prisma        # Survey, Field Tasks, OTDR, HSE
│   ├── permits.prisma       # AuthorityEntity, PermitType, ProjectPermit
│   ├── vehicle-management.prisma # VM* models (21 models)
│   ├── petty-cash.prisma    # PettyCashAccount, PettyCashVoucher, PettyCashReimbursement
│   └── system.prisma        # Section, SystemRole, SystemConfig, DashboardStat
├── schema.prisma            # Combined schema file
├── schema.prisma.bak        # Backup of original monolith
├── migrations/              # Migration history (DB structure unchanged)
└── seed.js                  # Seed data
```

### Core Services

#### 1. Inventory Management System (26 services)

The inventory system follows a **Service-Repository pattern** under `src/services/inventory/`.

**Core Stock Operations:**
- **StockService** (`stock.service.ts`) — Stock levels, FIFO batch picking, transfers, availability checks, negative stock guard
- **GRNService** (`grn.service.ts`) — Goods Receipt Note processing, batch creation, QC integration, auto stock updates
- **MRNService** (`mrn.service.ts`) — Material Return Note processing, return reason tracking, stock reversal, approval workflow
- **IssueService** (`issue.service.ts`) — Material issue to contractors, FIFO batch allocation, issue approval, stock deduction
- **WastageService** (`wastage.service.ts`) — Wastage recording, approval gate (draft vs approved), stock write-off
- **TransactionService** (`transaction.service.ts`) — Transaction history, audit trail, stock movement reporting

**Master Data & Stores:**
- **ItemService** (`item.service.ts`) — Item master data, categories, unit conversions
- **StoreService** (`store.service.ts`) — Store/warehouse management, hierarchy, multi-store DB functions, stock visibility
- **LocatorService** (`locator.service.ts`) — Store/warehouse location mapping
- **CpeService** (`cpe.service.ts`) — Customer Premises Equipment tracking
- **RopService** (`rop.service.ts`) — Re-Order Point calculations

**Material Requests & Approvals:**
- **StockRequestService** (`stock-request.service.ts`) — Multi-stage approval (ARM → Manager → Release), inter-store transfers, SLT/local procurement, SoD checks
- **VirtualSwapService** (`virtual-swap.service.ts`) — Virtual stock swap between stores without physical movement

**Contractor & Audit:**
- **ContractorInventoryService** (`contractor-inventory.service.ts`) — Contractor-held stock tracking, DB-optimized summary via `fn_contractor_stock_summary`
- **AuditLedgerService** (`audit-ledger.service.ts`) — SHA-256 checksum InventoryLedger chain, immutability verification
- **AiAuditService** (`ai-audit.service.ts`) — AI-driven material usage anomaly detection
- **ConsumableAuditService** (`consumable-audit.service.ts`) — Consumable material reconciliation
- **MaterialAuditReportService** (`material-audit-report.service.ts`) — Material audit report generation
- **StoreVarianceReconciliationService** (`store-variance-reconciliation.service.ts`) — Physical vs system stock variance analysis
- **CycleCountService** (`cycle-count.service.ts`) — Periodic physical stock count scheduling and reconciliation
- **PreErpReconciliationService** (`pre-erp-reconciliation.service.ts`) — Legacy data reconciliation before ERP migration
- **MaterialExcelImportService** (`material-excel-import.service.ts`) — Bulk material data import from Excel

**Analytics & Forecasting:**
- **AbcService** (`abc.service.ts`) — ABC classification (Pareto analysis) of inventory items
- **DynamicReportService** (`dynamic-report.service.ts`) — Configurable inventory reports
- **ForecastService** (`forecast.service.ts`) — Demand forecasting for reorder planning

#### 2. Service Order Management

**ServiceOrderService** (`sod.service.ts`):
- Service order lifecycle management
- PAT (Physical Acceptance Test) tracking
- Contractor assignment
- Material usage tracking
- Revenue and payment calculation
- Status workflow management

#### 3. Contractor Management

**ContractorService** (`contractor.service.ts`):
- Contractor registration and approval
- Team and member management
- Document verification
- Payment tracking
- Performance monitoring

#### 4. Material Reconciliation

**MaterialService** (`material.service.ts`):
- Contractor material reconciliation
- SOD material usage tracking
- Monthly balance sheet generation
- Material return processing

#### 5. Notification System

**NotificationService** (`notification.service.ts`):
- Role-based notifications
- Email notifications
- In-app notifications
- Notification preferences
- Bulk notifications

#### 6. Supporting Services

**AuditService** (`audit.service.ts`):
- Action logging
- Change tracking
- Compliance reporting

**AutomationService** (`automation.service.ts`):
- Scheduled tasks
- Automated workflows
- Data synchronization

**SLTApiService** (`slt-api.service.ts`):
- Integration with SLT systems
- PAT result synchronization
- Service order data sync

**InvoiceService** (`invoice.service.ts`):
- Invoice generation
- Payment tracking
- Revenue reporting

#### 7. Finance & Accounting System (38 services)

The finance system lives under `src/services/finance/` with double-entry ledger discipline.

**General Ledger & Journal Entries:**
- **LedgerService** (`ledger.service.ts`) — Double-entry journal posting, debit/credit balancing, immutable posted entries, reversing entry corrections
- **LedgerReportService** (`ledger-report.service.ts`) — GL report generation with date filtering
- **ChartOfAccountsService** (`chart-of-accounts.service.ts`) — CoA CRUD, account hierarchy management
- **FiscalPeriodService** (`fiscal-period.service.ts`) — Fiscal period open/close lifecycle
- **AccountingPostingRegistryService** (`accounting-posting-registry.service.ts`) — Centralized posting rules and validation

**Payment & Receivables:**
- **PaymentVoucherService** (`payment-voucher.service.ts`) — PV creation, approval workflow, cumulative validation against invoice net payable
- **ArApService** (`ar-ap.service.ts`) — AR aging/collections and AP aging/payables
- **InvoiceService** (`invoice.service.ts`) — Contractor invoice generation and management
- **InvoiceApprovalService** (`invoice-approval.service.ts`) — Invoice approval workflow
- **BillingService** (`billing.service.ts`) — Contractor billing operations
- **BomInvoiceService** (`bom-invoice.service.ts`) — BOM-based invoice generation from SLT portal sync

**Banking & Cash:**
- **BankService** (`bank.service.ts`) — Bank registry CRUD, bank account management
- **BankCashService** (`bank-cash.service.ts`) — Cash book and bank ledger operations
- **BankReconciliationService** (`bank-reconciliation.service.ts`) — Auto bank statement matching and reconciliation
- **PettyCashService** (`petty-cash.service.ts`) — Imprest (fixed-float) model, expense voucher reconciliation, float top-up

**Tax & Compliance:**
- **TaxService** (`tax.service.ts`) — VAT return and WHT certificate/tax register
- **TaxConfigService** (`tax-config.service.ts`) — Tax rate configuration
- **LdPenaltyService** (`ld-penalty.service.ts`) — Liquidated damages penalty management
- **RetentionService** (`retention.service.ts`) — Project retention held amounts, release on milestone completion

**Corporate Finance:**
- **CapexOpexDashboardService** (`capex-opex-dashboard.service.ts`) — CAPEX/OPEX split visualization
- **CapexOpexLedgerService** (`capex-opex-ledger.service.ts`) — CAPEX/OPEX journal posting and ledger
- **BudgetAllocationService** (`budget-allocation.service.ts`) — Budget allocation and tracking
- **BudgetTrackingService** (`budget-tracking.service.ts`) — Budget vs actual variance monitoring
- **FpaDashboardService** (`fpa-dashboard.service.ts`) — FP&A variance dashboard
- **FixedAssetService** (`fixed-asset.service.ts`) — Fixed asset register and depreciation schedules
- **PayrollExpenseService** (`payroll-expense.service.ts`) — HO payroll expense allocation
- **PeriodCloseService** (`period-close.service.ts`) — Financial period close and year-end procedures
- **QuotationService** (`quotation.service.ts`) — Vendor quotation management
- **CostAllocationService** (`cost-allocation.service.ts`) — Project cost allocation across cost centers
- **FxService** (`fx.service.ts`) — Multi-currency exchange rate management
- **SodWipRevenueService** (`sod-wip-revenue.service.ts`) — WIP revenue and unbilled billing pipeline
- **VendorService** (`vendor.service.ts`) — Vendor registry CRUD, bulk import

**OSP Accounting:**
- **OspAccountCrudService** (`osp-account-crud.service.ts`) — IOUs, advances, rents, fleet ledger CRUD
- **OspAccountIngestionService** (`osp-account-ingestion.service.ts`) — Bulk OSP account data ingestion
- **OspAccountReportService** (`osp-account-report.service.ts`) — OSP dashboard and reporting
- **OspLedgerService** (`osp-ledger.service.ts`) — OSP-specific ledger entries

**SF Audit:**
- **SfAuditService** (`sf-audit.service.ts`) — SF audit governance, pricing audit, header mapping, payment split config

**Dashboard:**
- **DashboardService** (`dashboard.service.ts`) — Finance dashboard metrics with OPMC scope isolation

### Database Architecture

**Schema is split into 17 module files** under `prisma/schema/`. Total: 176 models, 19 enums.

| Module File | Domain | Key Models |
|---|---|---|
| `_base.prisma` | Config | generator, datasource |
| `enums.prisma` | Enums | Role, ContractorStatus, VehicleTypeEnum… |
| `user.prisma` | Users | User, Staff, Notification, AuditLog |
| `opmc.prisma` | Org | OPMC |
| `service-order.prisma` | SOD | ServiceOrder, SODForensicAudit, PATSession… |
| `contractor.prisma` | Contractors | Contractor, ContractorTeam, TeamMember… |
| `inventory.prisma` | Inventory | InventoryStore, InventoryItem, InventoryStock… |
| `stock-management.prisma` | Stock flows | GRN, MRN, StockIssue, ContractorMaterial… |
| `project-core.prisma` | Projects | Project, Job, ProjectBOQItem, ProjectTask… |
| `project-finance.prisma` | Finance | Invoice, ProjectPurchaseOrder, PaymentVoucher… |
| `project-workflow.prisma` | Workflows | WorkflowTemplate, ProjectStageInstance… |
| `project-advanced.prisma` | Advanced | ProjectEVM, AiPrediction, ProjectRisk… |
| `gis.prisma` | GIS | GISRoute, GISPole, GISChamber, GISCableSegment… |
| `survey.prisma` | Field/Survey | SurveyRequest, FieldTask, OTDRTest, HSESafetyLog… |
| `permits.prisma` | Permits | AuthorityEntity, PermitType, ProjectPermit… |
| `vehicle-management.prisma` | Vehicles | VMVehicle, VMDriver, VMTrip, VMFuelLog… |
| `system.prisma` | System | Section, SystemRole, SystemConfig, DashboardStat… |

**Database Features:**
- Streaming replication (Primary + Replica)
- Full-text search with `pg_trgm` extension
- Composite indexes for query optimization
- JSON fields for flexible data storage
- Audit trails with timestamps

## Communication Guidelines (MANDATORY)

To ensure maximum efficiency and token conservation (saving user money), all interactions MUST follow these rules:
1. **NO EMOJIS**: Strictly avoid all emojis in technical and conversational responses.
2. **NO FLAGS**: Do not use flag characters or strings of flags (e.g., 🏁, 🚩).
3. **NO REPEATING CHARACTERS**: Do not repeat characters for decoration (e.g., "=====", "🏁🏁🏁").
4. **EXTREME CONCISENESS**: Provide only essential technical answers. Minimize conversational filler and summaries.
5. **PROFESSIONAL DIRECTNESS**: Respond like a senior engineer-to-engineer. Do not use decorative formatting or unnecessary greetings.
6. **NO REPETITIVE STATUS CHECKING**: Do NOT call `command_status` repeatedly with the same ID without significant new output or clear manual request. NEVER start an autonomous "checking loop" that repeats more than 2 times.

**FAILURE TO COMPLY WASTES USER TOKENS AND FUNDS.**

## Antigravity Development Standards (ADS)

### 1. Type Safety

**Always maintain strict TypeScript compliance:**

```typescript
// ❌ BAD - Using 'any'
function processData(data: any) {
    return data.value;
}

// ✅ GOOD - Explicit types
interface DataInput {
    value: string;
    timestamp: Date;
}

function processData(data: DataInput): string {
    return data.value;
}
```

**Key Rules:**
- Never use `any` type - use proper interfaces or `unknown` with type guards
- Use `Prisma.TypeNameWhereInput` for query filters
- Use `TransactionClient` type for Prisma transactions
- Define interfaces for all data structures

### 2. Prisma Best Practices

**Transaction Handling:**

```typescript
import { TransactionClient } from './inventory/types';

// ✅ Correct transaction typing
await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.inventoryStock.update({
        where: { id: stockId },
        data: { quantity: { increment: amount } }
    });
});
```

**Query Optimization:**
- Use `select` to fetch only required fields
- Use `include` judiciously to avoid N+1 queries
- Implement cursor-based pagination for large datasets
- Use database indexes for frequently queried fields

### 3. Service Layer Architecture

**Follow the Service-Repository pattern:**

```typescript
// services/inventory/stock.service.ts
export class StockService {
    static async createStockIssue(data: StockIssueInput): Promise<StockIssue> {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            // Business logic here
        });
    }
}
```

**Service Guidelines:**
- Keep services focused on single responsibility
- Use static methods for stateless operations
- Implement proper error handling with custom error types
- Add comprehensive JSDoc comments

### 4. API Route Structure (apiHandler — MANDATORY)

All API routes handling mutations or complex reads MUST use `apiHandler`. It provides Zod validation, RBAC, audit logging, request context, and standardized error responses in a single wrapper.

```typescript
// app/api/inventory/stock/route.ts
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { StockService } from '@/services/inventory/stock.service';

const stockIssueSchema = z.object({
    itemId: z.string().uuid(),
    storeId: z.string().uuid(),
    quantity: z.number().positive(),
});

// apiHandler handles: auth, RBAC, Zod validation, audit, error mapping
export const POST = apiHandler(
    async (req, { session, body }) => {
        // Business logic — throw AppError for typed errors
        const result = await StockService.createStockIssue(body);
        return result;
    },
    {
        roles: ['ADMIN', 'STORES_MANAGER'],  // RBAC enforced automatically
        body: stockIssueSchema,               // Zod validation enforced automatically
        audit: { action: 'STOCK_ISSUE', entity: 'InventoryStock' },
    }
);
```

**Key rules:**
- NEVER use raw `try/catch` + `handleApiError` in new routes — use `apiHandler`
- NEVER use `throw new Error()` — use typed `AppError` factories (see Section 7B)
- `apiHandler` maps AppError to correct HTTP status, Prisma errors to typed responses, ZodError to 422
- Only 4 routes in the codebase legitimately skip apiHandler (binary WMS proxy, Prometheus metrics, public invoices, stub)

**apiHandler Response Contract (CRITICAL):**
- Routes MUST return a **plain object** (or `void`), NEVER `Response.json(data)`
- `apiHandler` wraps the return value as `{ success, data: <return>, timestamp, duration }`
- Returning `Response.json()` causes double-wrapping: the Response object serializes to `{}` inside the envelope, producing `{ success: true, data: {} }` — this was the root cause of the `/finance` page crash
- **Client-side safe extraction** — always unwrap the apiHandler envelope:
```typescript
const res = await fetch('/api/endpoint');
const json = await res.json();
// Safe extraction: handles { data: <actual> } envelope from apiHandler
const data = json.data?.data ?? json.data ?? json;
```

### 5. Frontend Orchestrator Architecture

To ensure maximum maintainability and performance, all new modules must follow the **Orchestrator-Component-Hook** pattern.

#### A. Orchestrator Page (`page.tsx`)
- **Thin Layer**: The main page should only serve as an orchestrator.
- **Composition**: It should import reusable components and pass necessary data/handlers.
- **Layout**: Use standard `Sidebar` and `Header` wrappers.

#### B. Functional Hooks (`hooks/use[Entity]Operations.ts`)
- **Action Centralization**: Encapsulate all mutations (create, update, delete, merge) in a custom hook.
- **TanStack Query**: Use `useMutation` for side effects, ensuring strict `onSuccess` query invalidation and `onError` feedback.
- **Feedback**: Use `sonner` for high-fidelity situational feedback.

#### C. Component Categorization
- **Registry Tables** (`components/[Entity]Table.tsx`): Advanced data tables with built-in filtering, search, and bulk selection.
- **Form Dialogs** (`components/[Entity]FormDialog.tsx`): High-fidelity modals using **React Hook Form** and **Zod**.
- **Utility Modals**: Separate modals for complex operations like "Merging Entities" or "Bulk Status Updates".

### 6. High-Fidelity Aesthetic Mandate

The SLTSERP system must maintain a **Premium/Enterprise+** visual identity. Every new interface must "wow" the user.

- **Glassmorphism**: Use `backdrop-blur-lg` and `bg-white/80` for elevated surfaces (modals, cards).
- **Depth & Shadows**: Implement multi-layered shadows (`shadow-2xl shadow-slate-200/50`) to create a sense of hierarchy.
- **Typography & Weights**: Use high-contrast font weights (Black/900 for titles, Bold/700 for labels) and strictly uppercase tracking for metadata.
- **Micro-Animations**: Add subtle transitions (`transition-all duration-300`) and hover states (e.g., `-translate-y-1` on interactive cards).
- **Vibrant Status Indicators**: Use curated HSL color palettes for status badges (Emerald for Active, Rose for Critical, Amber for Pending).

### 6. Forms & Data Validation

#### A. React Hook Form & Zod (MANDATORY)
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define schema in src/lib/validations/
const formSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    quantity: z.number().positive('Quantity must be positive'),
});

// Use in component
const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        name: '',
        email: '',
        quantity: 0,
    },
});

// Render with Shadcn Form components
<Form {...form}>
    <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
            <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                    <Input {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
</Form>
```

**Validation Standards:**
- ALL forms MUST use React Hook Form
- ALL API inputs MUST have Zod schemas in `src/lib/validations/`
- Use `apiHandler` with a `body: zodSchema` option for automatic Zod validation (preferred)
- Use Shadcn Form components for consistent UI

#### B. Server-Side Pagination & Filtering (CRITICAL)
```typescript
// ❌ BAD - Fetching all records
const allOrders = await prisma.serviceOrder.findMany();

// ✅ GOOD - Server-side pagination
const orders = await prisma.serviceOrder.findMany({
    where: {
        status: { in: statusFilter },
        soNum: { contains: searchTerm, mode: 'insensitive' },
    },
    select: {
        id: true,
        soNum: true,
        status: true,
        // Only needed fields
    },
    take: limit,
    skip: (page - 1) * limit,
    orderBy: { createdAt: 'desc' },
});
```

**Pagination Rules:**
- For tables with >100 records, NEVER fetch all data
- Execute pagination on database level
- Perform search/filtering on database level
- Frontend passes `page`, `limit`, `search` params

### 7. Security & Access Control (RBAC)

#### A. API Route Protection
```typescript
// In apiHandler — RBAC is declarative via the roles array
export const GET = apiHandler(
    async (req, { session }) => {
        // Only reachable if user has one of the allowed roles
        const data = await SensitiveService.getData();
        return data;
    },
    { roles: ['ADMIN', 'SUPER_ADMIN'] }
);

// For identity-gated actions inside the handler:
import { AppError } from '@/lib/error';
export const DELETE = apiHandler(
    async (req, { session, params }) => {
        const userId = session.user.id;
        if (action.performedBy !== userId) {
            throw AppError.forbidden('Unauthorized action on this resource');
        }
        // ...
    },
    { roles: ['ADMIN'] }
);
```

#### B. Centralized Error Handling (AppError — MANDATORY)
```typescript
import { AppError } from '@/lib/error';

// Service / repository layer — throw typed AppError, NEVER throw new Error()
if (!record) throw AppError.notFound('Record not found');
if (!canAccess) throw AppError.forbidden('Insufficient permissions');
if (stock < requested) {
    throw new AppError(
        `Insufficient stock: have ${stock}, need ${requested}`,
        ErrorCode.INSUFFICIENT_STOCK,
        400
    );
}
if (duplicateExists) throw AppError.conflict('Record already exists');
if (badInput) throw AppError.badRequest('Invalid input data');

// apiHandler maps these automatically:
// AppError.unauthorized() → 401
// AppError.forbidden()    → 403
// AppError.notFound()     → 404
// AppError.badRequest()   → 400
// AppError.conflict()     → 409
// AppError.validation()   → 422
// Prisma P2002            → 409 (unique constraint)
// Prisma P2025            → 404 (record not found)
// Prisma P2003            → 400 (FK constraint)
// Generic Error           → 500 (SANITIZED — no source leak to client)
// ZodError                → 422
```

**CRITICAL rules:**
- NEVER `throw new Error('message')` in server-side code — it maps to generic 500 with no user-visible message
- NEVER return raw `error.message` to clients — CWE-209 information exposure
- `apiHandler` is the ONLY central error boundary — no other error handler exists
- Legacy `handleApiError`/`ApiError` in `api-utils.ts` is used by 1 route only (gis/map-data) — do not use in new code

### 8. UI/UX Design System

#### A. Aesthetics (Glassmorphism & Modern UI)
```tsx
// Premium design tokens
<div className="bg-white/80 backdrop-blur-lg shadow-xl rounded-lg 
                border border-gray-200/50 transition-all duration-200
                hover:shadow-2xl hover:scale-[1.02]">
    {/* Content */}
</div>
```

**Design Standards:**
- Use subtle `backdrop-blur` and semi-transparent backgrounds
- Add smooth transitions to interactive elements
- Implement responsive design (Mobile → Tablet → Desktop)
- Show loading skeletons during data fetching

#### B. User Feedback
- Clear success/error toasts for all actions
- Disable buttons during async operations
- Show loading indicators (`isSubmitting` state)
- Implement optimistic UI updates

### 9. Database Performance & Optimization

#### A. Strategic Indexing (MANDATORY)
```prisma
model ServiceOrder {
    id          String   @id @default(cuid())
    opmcId      String
    status      String
    contractorId String?
    createdAt   DateTime @default(now())
    
    // Indexes for frequently queried fields
    @@index([opmcId, status])
    @@index([contractorId])
    @@index([createdAt])
    @@index([status])
}
```

**Indexing Rules:**
- Every field in `where` clause needs an index
- Every field in `orderBy` needs an index
- All foreign keys need indexes
- Composite indexes for common filter combinations

#### B. Selective Querying
```typescript
// ❌ BAD - Fetching entire rows
const users = await prisma.user.findMany();

// ✅ GOOD - Select only needed fields
const users = await prisma.user.findMany({
    select: {
        id: true,
        name: true,
        email: true,
    },
});
```

#### C. Connection Pooling
- Use Prisma Accelerate or PgBouncer in production
- Configure connection limits appropriately
- Monitor connection usage

### 10. Real-time Communication

#### A. Server-Sent Events (SSE) Over Polling
```typescript
// Server: /api/notifications/stream/route.ts
export async function GET(req: NextRequest) {
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            
            // Listen to events
            const handler = (data: any) => {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
            };
            
            eventEmitter.on('notification', handler);
            
            // Cleanup
            req.signal.addEventListener('abort', () => {
                eventEmitter.off('notification', handler);
                controller.close();
            });
        },
    });
    
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

// Client: React component
useEffect(() => {
    const eventSource = new EventSource('/api/notifications/stream');
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Update UI immediately
        queryClient.setQueryData(['notifications'], data);
    };
    
    return () => eventSource.close();
}, []);
```

**Real-time Standards:**
- Use SSE for live updates (NOT polling)
- Emit events in service layer (`lib/events.ts`)
- Update UI state immediately on event receipt

### 11. Audit Logging & Traceability

#### A. Audit Mandate
```typescript
import { AuditService } from '@/services/audit.service';

// Log every mutation
await AuditService.log({
    userId: session.user.id,
    action: 'UPDATE',
    entity: 'ServiceOrder',
    entityId: orderId,
    oldValue: oldOrder,
    newValue: updatedOrder,
});
```

**Audit Rules:**
- Log ALL mutations (Create, Update, Delete, Status Change)
- Include `userId`, `action`, `entity`, `entityId`
- Provide both `oldValue` and `newValue` in JSON
- Goal: Full accountability of "Who changed What and When"

### 12. Advanced Data Fetching

#### A. React Query (TanStack Query)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch data with caching
const { data, isLoading, error } = useQuery({
    queryKey: ['serviceOrders', opmcId],
    queryFn: () => fetchServiceOrders(opmcId),
    staleTime: 5 * 60 * 1000, // 5 minutes
});

// Mutations with optimistic updates
const queryClient = useQueryClient();
const mutation = useMutation({
    mutationFn: updateServiceOrder,
    onMutate: async (newData) => {
        // Optimistic update
        await queryClient.cancelQueries(['serviceOrders']);
        const previous = queryClient.getQueryData(['serviceOrders']);
        queryClient.setQueryData(['serviceOrders'], newData);
        return { previous };
    },
    onError: (err, newData, context) => {
        // Rollback on error
        queryClient.setQueryData(['serviceOrders'], context?.previous);
    },
});
```

**Benefits:**
- Automatic caching and background updates
- Built-in loading/error states
- Prevents layout shift
- Makes app feel instant

## Development Workflow

### Step 1: Feature Planning

1. **Understand Requirements:**
   - Review user stories or feature requests
   - Identify affected services and components
   - Check existing similar implementations

2. **Design Database Schema (MULTI-FILE — IMPORTANT):**
   ```bash
   # Schema is split into prisma/schema/ folder.
   # DO NOT edit prisma/schema.prisma (legacy, inactive).
   # Edit the correct module file:
   #
   #   New project feature?   → prisma/schema/project-core.prisma
   #   New finance model?     → prisma/schema/project-finance.prisma
   #   New inventory model?   → prisma/schema/inventory.prisma
   #   New GIS model?         → prisma/schema/gis.prisma
   #   New user/auth model?   → prisma/schema/user.prisma
   #   New vehicle model?     → prisma/schema/vehicle-management.prisma
   #   New enum?              → prisma/schema/enums.prisma
   #   Completely new domain? → create prisma/schema/your-domain.prisma
   ```

3. **Create Migration:**
   ```bash
   npx prisma migrate dev --name descriptive_migration_name
   # Prisma automatically reads all files in prisma/schema/
   ```

### Step 2: Backend Development

1. **Define Types/Interfaces:**
   ```typescript
   // services/types.ts or service-specific types
   export interface NewFeatureInput {
       field1: string;
       field2: number;
       // ... other fields
   }
   ```

2. **Implement Service Layer:**
   ```typescript
   // services/feature.service.ts
   export class FeatureService {
       static async createFeature(data: NewFeatureInput) {
           // Implementation
       }
   }
   ```

3. **Create API Route (apiHandler — MANDATORY):**
   ```typescript
   // app/api/feature/route.ts
   import { apiHandler } from '@/lib/api-handler';
   import { FeatureService } from '@/services/feature.service';

   export const POST = apiHandler(
       async (req, { body }) => {
           const result = await FeatureService.create(body);
           return result; // plain object, NOT Response.json()
       },
       { roles: ['ADMIN'], body: featureSchema, audit: { action: 'CREATE', entity: 'Feature' } }
   );
   ```

### Step 3: Frontend Development

1. **Create UI Components:**
   - Use Shadcn/UI components as base
   - Follow existing design patterns
   - Implement proper form validation with React Hook Form

2. **Implement State Management:**
   - Use React Context for global state
   - Use local state for component-specific data
   - Implement optimistic updates where appropriate

3. **Add Error Handling:**
   - Display user-friendly error messages
   - Implement proper loading states
   - Add success notifications

### Step 4: Testing & Quality Assurance

1. **Type Checking:**
   ```bash
   npx tsc --noEmit
   ```

2. **Linting:**
   ```bash
   npx eslint . --ext .ts,.tsx
   ```

3. **Manual Testing:**
   - Test all CRUD operations
   - Verify permissions and role-based access
   - Test edge cases and error scenarios

### Step 5: Database Synchronization

1. **Sync Primary Database:**
   ```bash
   npx prisma db push
   ```

2. **Sync Replica Database:**
   ```bash
   $env:DATABASE_URL=$env:DIRECT_URL; npx prisma db push
   ```

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

### Step 6: Git Workflow

1. **Check Status:**
   ```bash
   git status
   ```

2. **Stage Changes:**
   ```bash
   git add .
   ```

3. **Commit with Conventional Commits:**
   ```bash
   git commit -m "feat: add new feature description"
   # or
   git commit -m "fix: resolve specific bug"
   # or
   git commit -m "refactor: improve code structure"
   ```

4. **Push to Repository:**
   ```bash
   git push origin main
   ```

## Common Tasks

### Adding a New Service

1. Create service file: `services/new-service.service.ts`
2. Define interfaces in the same file or `services/types.ts`
3. Implement service methods with proper typing
4. Export service from `services/index.ts` if needed
5. Create corresponding API routes
6. Add frontend components and integration

### Fixing Type Errors

1. **Identify the error:**
   ```bash
   npx tsc --noEmit
   ```

2. **Common fixes:**
   - Replace `any` with proper types
   - Use `Prisma.TypeName` for Prisma-generated types
   - Add `TransactionClient` for transaction callbacks
   - Define custom interfaces for complex data structures

3. **Verify fix:**
   ```bash
   npx eslint path/to/file.ts
   ```

### Database Schema Changes (MULTI-FILE SCHEMA)

> CRITICAL: The schema is split across `prisma/schema/` module files.
> Never edit the legacy `prisma/schema.prisma` — it is inactive.

1. **Identify the correct module file** (see table in Database Architecture section)
   and add/edit the model there:
   ```prisma
   // Example: prisma/schema/project-core.prisma
   model NewProjectFeature {
       id        String   @id @default(cuid())
       projectId String
       field1    String
       createdAt DateTime @default(now())
       project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

       @@index([projectId])
   }
   // Also add the relation back-reference in Project model within project-core.prisma
   ```

2. **Validate schema** (catches errors across all module files):
   ```bash
   npx prisma validate
   # Expected: "The schemas at prisma\schema are valid"
   ```

3. **Create migration:**
   ```bash
   npx prisma migrate dev --name add_new_model
   ```

4. **Sync both databases:**
   ```bash
   # Primary
   npx prisma db push

   # Replica
   $env:DATABASE_URL=$env:DIRECT_URL; npx prisma db push
   ```

5. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

## Code Quality Checklist

Before committing code, ensure:

- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint errors (`npx eslint . --ext .ts,.tsx`)
- [ ] All imports are used (no unused imports)
- [ ] No `any` types (use proper interfaces)
- [ ] Proper error handling implemented
- [ ] Database transactions used where needed
- [ ] API routes have authentication checks
- [ ] User-facing errors are handled gracefully
- [ ] Code follows existing patterns
- [ ] Comments added for complex logic

## Performance Optimization

### Database Queries

1. **Use selective fields:**
   ```typescript
   // ❌ BAD - Fetches all fields
   const users = await prisma.user.findMany();
   
   // ✅ GOOD - Fetches only needed fields
   const users = await prisma.user.findMany({
       select: { id: true, name: true, email: true }
   });
   ```

2. **Implement pagination:**
   ```typescript
   const items = await prisma.item.findMany({
       take: limit,
       skip: (page - 1) * limit,
       orderBy: { createdAt: 'desc' }
   });
   ```

3. **Use database indexes:**
   ```prisma
   model ServiceOrder {
       // ... fields
       @@index([opmcId, status])
       @@index([contractorId])
   }
   ```

### Frontend Optimization

1. Use React.memo for expensive components
2. Implement virtualization for long lists
3. Lazy load routes and components
4. Optimize images with Next.js Image component

## Troubleshooting

### Common Issues

1. **Prisma Client out of sync:**
   ```bash
   npx prisma generate
   ```

2. **Database connection issues:**
   - Check `.env` file for correct DATABASE_URL
   - Verify database is running
   - Check network connectivity

3. **Type errors after schema changes:**
   ```bash
   npx prisma generate
   npm run dev  # Restart dev server
   ```

4. **Build errors:**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

5. **Schema validation error (multi-file):**
   ```bash
   npx prisma validate
   # Pinpoints which module file and line has the error.
   # Common cause: Added a relation field but forgot the back-reference
   # in the related model (which may be in a DIFFERENT module file).
   ```

6. **Model not found / wrong module file:**
   - Use the module table in the Database Architecture section to find
     which `prisma/schema/*.prisma` file contains a given model.
   - Cross-module relations are fully supported — Prisma merges all files
     at migrate/generate time automatically.

7. **`package.json#prisma` deprecation warning:**
   - This is a Prisma 6→7 notice. It is harmless until Prisma 7.
   - The `"schema": "prisma/schema"` config in `package.json` is correct and working.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Shadcn/UI Components](https://ui.shadcn.com/)

## Notes

- Always test changes locally before pushing
- Keep commits atomic and focused
- Write descriptive commit messages
- Update documentation when adding new features
- Review code before committing

## Core Domain Rules & Business Logic Gotchas (CRITICAL FOR AGENTS)

To prevent code regressions or architectural misunderstandings, any AI Agent working on this codebase must adhere to the following business logic and technical specifications:

### 1. Material Sourcing & Reconciliation Flow
* **SLT Sourced (Parent Company Inventory):**
  * Materials issued from the Sri Lanka Telecom parent store.
  * These are **NOT** billed to the contractor, but at the end of each month, SLT generates a "BOM Created" report of completed Service Orders (SODs) and deducts these costs from the SLTS invoice.
  * The system must track these completions for manual/automated monthly reconciliation.
* **SLTS Sourced (Our Stock/Inventory):**
  * Materials purchased and owned by SLTS (SLT Services).
  * Issued to contractor teams from SLTS stores.
  * **Contractors do not purchase or get any materials themselves.** They only consume what is issued to them from the SLTS warehouse.
  * All consumption and wastage of SLTS stock are reconciled against their completions.

### 2. Prisma Extended Client Type Resolution Gotcha
* The client exported as `prisma` in `src/lib/prisma.ts` is wrapped in `$extends` to handle read/write splitting, query tracing, and profiling.
* Due to compiler or IDE type-resolution limits, typescript types for newly added tables/models (such as `Penalty`) might show as missing on the extended `prisma` type, leading to IDE error warnings or developers using `as any` casts.
* **Solution:** For database writes, updates, deletions, and all Prisma transaction clients (`tx`), import and use **`primaryClient`** directly from `@/lib/prisma`. This utilizes the raw `PrismaClient` type, ensuring absolute type-safety without any IDE resolution failures or the need for `any` type casting.

### 3. Invoice Penalties Approval Matrix
* **Proposing Penalties:** QC Officers, Area Coordinators, or other field staff propose penalties on service order invoices due to QC failures, delays, or mismatches.
* **Approving/Rejecting Penalties:** Restricted to `AREA_MANAGER`, `ADMIN`, and `SUPER_ADMIN` roles.
* **Recalculation Trigger:** Whenever a penalty is created (auto-approved if by Area Manager), updated (approved/rejected), or deleted, the system **MUST** immediately trigger `InvoiceGeneratorService.recalculateInvoiceSplits` inside the same database transaction.

### 4. OSP Project Management & WBS Progress Propagation Flow
* **Concurrency Protection:** Invoice status updates, payment voucher allocations, and task edits **MUST** execute within Prisma transactions (`prisma.$transaction`) to block concurrency race conditions and enforce billing ledger accuracy.
* **WBS Progress updates:** Sub-task progress edits **MUST** run a transaction and call a recursive helper `updateParentProgress` to dynamically propagate the weighted or flat completion average up the WBS (Work Breakdown Structure) hierarchy all the way to root-level parent tasks.
* **Frontend Component Standards:** Frontend modules within the project section (tasks, finance, procurement, closure) **MUST** remain strictly typed (zero `any` types), wrap all state fetchers with `useCallback` to avoid stale closures, and declare proper interfaces matching development standards.

### 5. GIS Map & OpenLayers Sizing Standards (CRITICAL FOR MAP BLANK ISSUE)
* **Explicit Heights**: OpenLayers requires target divs to have defined heights. Wrap the map target `div` with a container that has explicit pixel height (e.g., `height` prop or `minHeight: '300px'`) and styles `display: block; position: relative; width: '100%'`.
* **Auto-Resizing Observer**: Always register a `ResizeObserver` inside a `useEffect` that listens to target div mutations and calls `map.updateSize()` immediately to refresh canvas tiles on size changes.
* **Deferred Geometry Fitting**: When zooming to extents using `map.getView().fit(...)`, the call **must be deferred** by at least 100ms using a `setTimeout` to allow browser DOM layout styles to settle, followed by `map.updateSize()`.
* **MapBrowserEvent Generic PointerEvent Constraints**: OpenLayers click and hover move events (`MapBrowserEvent`) must specify generic type parameters as `PointerEvent | KeyboardEvent | WheelEvent` (or standard `PointerEvent`), rather than general `UIEvent` which is incompatible with OpenLayers type constraints.
* **Render Loop State Rule**: Never read `.current` properties of React `useRef` directly during JSX rendering. Synchronize all computed values to React state hooks inside event handlers, and render from states instead.

### 6. Next.js Route Caching & State Refresh Standards
* **Force Dynamic GET Routes**: All Next.js API GET routes that list entities (e.g., `/api/projects`, `/api/gis`) must disable Route Handler static caching by exporting `dynamic = 'force-dynamic'`.
* **Client-Side Cache Busting**: When performing fetch calls to retrieve lists of items, always append a timestamp parameter (e.g., `_t=${Date.now()}`) and set `{ cache: 'no-store' }` to bypass browser and CDN caches.
* **Optimistic Client State Management**: Always perform optimistic state updates on the client (e.g., filter out a deleted item from local state arrays immediately in the delete success handler) so the UI responds instantly without waiting for network reloads.


