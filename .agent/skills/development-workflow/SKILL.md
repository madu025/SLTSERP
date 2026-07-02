---
name: SLTSERP Development Workflow
description: Comprehensive development workflow for SLTSERP project including type safety, testing, and deployment procedures
---

# SLTSERP Development Workflow (Antigravity Standard)

This skill provides a systematic, "agentic-first" approach to developing features, fixing bugs, and maintaining elite code quality in the SLTSERP project. It follows the **Antigravity Development Standard**—a high-performance, modular, and aesthetically premium architecture.

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
├── services/              # Business logic layer
│   ├── inventory/        # Inventory management services
│   │   ├── stock.service.ts
│   │   ├── grn.service.ts (Goods Receipt Note)
│   │   ├── mrn.service.ts (Material Return Note)
│   │   ├── issue.service.ts
│   │   ├── wastage.service.ts
│   │   ├── stock-request.service.ts
│   │   ├── item.service.ts
│   │   ├── store.service.ts
│   │   ├── transaction.service.ts
│   │   └── types.ts
│   ├── contractor.service.ts
│   ├── sod.service.ts (Service Order Delivery)
│   ├── material.service.ts
│   ├── notification.service.ts
│   ├── invoice.service.ts
│   ├── audit.service.ts
│   ├── automation.service.ts
│   ├── slt-api.service.ts
│   ├── system.service.ts
│   └── user.service.ts
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
│   └── system.prisma        # Section, SystemRole, SystemConfig, DashboardStat
├── schema.prisma            # LEGACY — kept for reference, NOT active
├── schema.prisma.bak        # Backup of original monolith
├── migrations/              # Migration history (DB structure unchanged)
└── seed.js                  # Seed data
```

### Core Services

#### 1. Inventory Management System

The inventory system follows a **Service-Repository pattern** with the following services:

**StockService** (`inventory/stock.service.ts`):
- Manages inventory stock levels
- Implements FIFO batch picking
- Handles stock adjustments and transfers
- Provides stock availability checks

**GRNService** (`inventory/grn.service.ts`):
- Goods Receipt Note processing
- Batch creation and tracking
- Quality control integration
- Automatic stock updates

**MRNService** (`inventory/mrn.service.ts`):
- Material Return Note processing
- Return reason tracking
- Stock reversal logic
- Approval workflow

**IssueService** (`inventory/issue.service.ts`):
- Material issue to contractors
- Batch allocation (FIFO)
- Issue approval workflow
- Stock deduction

**StockRequestService** (`inventory/stock-request.service.ts`):
- Multi-stage approval workflow (ARM → Manager → Release)
- Inter-store transfers
- SLT procurement requests
- Local purchase requests

**WastageService** (`inventory/wastage.service.ts`):
- Wastage recording and tracking
- Approval workflow
- Stock write-off

**ItemService** (`inventory/item.service.ts`):
- Item master data management
- Category management
- Unit conversions

**StoreService** (`inventory/store.service.ts`):
- Store/warehouse management
- Store hierarchy
- Stock visibility by store

**TransactionService** (`inventory/transaction.service.ts`):
- Transaction history tracking
- Audit trail
- Reporting

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

### 4. API Route Structure

```typescript
// app/api/inventory/stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { StockService } from '@/services/inventory/stock.service';
import { validateBody, handleApiError } from '@/lib/api-utils';
import { stockIssueSchema } from '@/lib/validations/inventory';

export async function POST(req: NextRequest) {
    try {
        // Authentication check
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Role-based access control
        const role = req.headers.get('x-user-role');
        if (role !== 'ADMIN' && role !== 'STORES_MANAGER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Validate request body with Zod
        const body = await validateBody(req, stockIssueSchema);
        
        // Execute business logic
        const result = await StockService.createStockIssue(body);
        
        return NextResponse.json(result);
    } catch (error) {
        return handleApiError(error);
    }
}
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
- Use `validateBody(request, schema)` in API routes
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
// Role validation
const role = request.headers.get('x-user-role');
if (!['ADMIN', 'SUPER_ADMIN'].includes(role || '')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
}

// Identity verification for critical actions
const userId = request.headers.get('x-user-id');
if (action.performedBy !== userId) {
    return NextResponse.json({ message: 'Unauthorized action' }, { status: 403 });
}
```

#### B. Centralized Error Handling
```typescript
import { handleApiError, validateBody } from '@/lib/api-utils';

// In API route
try {
    const body = await validateBody(request, schema);
    // ... business logic
} catch (error) {
    return handleApiError(error); // Consistent error responses
}
```

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

3. **Create API Route:**
   ```typescript
   // app/api/feature/route.ts
   export async function POST(req: NextRequest) {
       // Implementation
   }
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


