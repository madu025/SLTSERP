---
description: Comprehensive guidelines for developing new features, pages, and APIs in the SLTSERP project, focusing on performance, security, and aesthetics, using Shadcn/UI and React Hook Form.
---

# SLTSERP Development Standards & Best Practices

Use this document as the "Gold Standard" when implementing new features or refactoring existing code.

## 1. Frontend Architecture & Performance

### A. Component Modularization
- **Component Library**: ALWAYS use **Shadcn/UI** components from `src/components/ui/` for basic elements (Buttons, Inputs, Cards, etc.). Do not use raw Tailwind utility classes for these elements unless creating a completely custom component not available in Shadcn.
- **Modals & Dialogs**: Use **Shadcn Dialog** component. Extract them into strict components in `src/components/modals/`.
- **Complex UI Sections**: Break down complex pages into smaller, reusable components.

### B. Dynamic Imports (Code Splitting)
- Use `next/dynamic` to load heavy components (especially Modals, Charts, and heavy Shadcn components) only when they are needed.
- This reduces the initial bundle size and improves First Contentful Paint (FCP).

```tsx
// Example
import dynamic from 'next/dynamic';
const MyHeavyModal = dynamic(() => import('@/components/modals/MyHeavyModal'), { ssr: false });
```

### C. State Management
- Keep state as local as possible.
- Use strict interfaces for all state variables and props.

### D. Navigation & Menu Management
- **Centralized Config**: ALWAYS use `src/config/sidebar-menu.ts` to manage sidebar items. NEVER hardcode links in the Sidebar component.
- **Role-Based Visibility**: Use the predefined `ROLE_GROUPS` in the config to control who sees what.

## 2. Forms & Data Validation (NEW STANDARD)

### A. React Hook Form & Zod
- **Forms**: ALL forms (Login, Registration, Data Entry) MUST use **React Hook Form** for state management and submission handling.
- **Validation**: Use **Zod** schemas for validation. Define schemas in the component file (if small) or in `src/lib/schemas.ts` (if shared).
- **Integration**: Use `@hookform/resolvers/zod` to connect Zod schemas to React Hook Form.
- **UI Components**: Use the standard `Form`, `FormControl`, `FormField`, `FormItem`, `FormLabel`, `FormMessage` components from Shadcn/UI to render form fields.

```tsx
// Example
const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
})
```

## 3. Security & Access Control (RBAC)

### A. API Route Protection
- **Role Validation**: Every write operation (POST, PUT, PATCH, DELETE) MUST verify the user's role using the `x-user-role` header (injected by middleware).
- **Identity Verification**: For strict actions (e.g., approvals), verify that the action performer matches the authenticated user (`x-user-id`).

```typescript
// Example RBAC Check
const role = request.headers.get('x-user-role');
if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
}
```

### B. Middleware
- Ensure `src/middleware.ts` is up to date and correctly verifying JWT tokens for all `/api/` routes and protected pages.

## 4. UI/UX Design System

### A. Aesthetics (Glassmorphism & Modern UI)
- **Visuals**: Use "Premium" design tokens.
    - Backgrounds: Subtle application of `backdrop-blur`, semi-transparent whites (`bg-white/80`), and shadows (`shadow-xl`).
    - Animations: Add subtle transitions (`transition-all duration-200`) to interactive elements.
- **Responsiveness**: ALL pages must be fully responsive (Mobile -> Tablet -> Desktop). Use Tailwind's `md:`, `lg:` prefixes effectively.
- **Loading States**: Always show skeletons or loading spinners during data fetching.

### B. User Feedback
- Use clear success/error alerts (or toasts) for all user actions.
- Disable buttons and show loading indicators during async operations (`isSubmitting` state).

## 5. Coding Style

- **TypeScript**: No `any` types unless absolutely necessary. Define interfaces for Models, Props, and API Responses.
- **Clean Code**: Remove `console.log` in production code. Use descriptive variable names.

## 6. Advanced Data Fetching (Future Standard)

### A. React Query (TanStack Query)
- Transition from `useEffect` to **React Query** for server state management.
- **Benefits**: Automatic caching, background updates, and built-in loading/error states.
- This effectively prevents "layout shift" and makes the app feel instant to the user.

## 7. Reusable Logic (Custom Hooks)

### A. Logic Extraction
- Don't repeat `fetch` logic. Encapsulate common data fetching or logic into Custom Hooks.
- **Location**: `src/hooks/`
- **Example**: `useServiceOrders(opmcId)`, `useAuth()`.

## 8. API Security (Rate Limiting)

### A. Anti-Abuse Measures
- Implement Rate Limiting on public or sensitive API endpoints (like Login) to prevent brute-force attacks.
- Middleware should track request counts per IP address.

## 9. Database Performance & Optimization (STANDARD)

### A. Strategic Indexing (MUST)
- **Rule**: Every field used in a `where` clause, `orderBy`, or as a Foreign Key in a relation MUST have an index.
- **Implementation**: Add `@@index([fieldName])` to the model in `prisma/schema.prisma`.
- **Target**: IDs (Foreign Keys), Status fields, Dates, and common filter categories (e.g., `opmcId`, `contractorId`).

### B. Selective Querying
- **Rule**: Avoid fetching unneeded data. NEVER use a plain `findMany()` without filters or specific selects for large tables.
- **Implementation**: Use Prisma's `select` to pluck specific fields instead of fetching entire rows if only a few columns are needed for a list view.

### C. Connection Pooling
- **Standard**: Always use connection pooling in production (Prisma Accelerate / PgBouncer) to handle concurrent user spikes without exhausting database connections.

### D. Data Retention & Cleanup
- **Standard**: For high-volume transaction logs or notifications, implement a 30-day (or relevant) auto-cleanup policy using the `cleanup` methods provided in the service layer.

## 10. Real-time Communication (STANDARD)

### A. Server-Sent Events (SSE) Over Polling (MUST)
- **Standard**: Avoid traditional "Polling" (sending requests every few seconds) for live updates. This causes unnecessary network load.
- **Implementation**: ALWAYS use **Server-Sent Events (SSE)** for features requiring real-time reactivity (e.g., Notification Bell, Live Dashboard Stats, Active Stock Monitoring).
- **Pattern**:
    1.  Emit an event in the Service Layer when data changes (`lib/events.ts`).
    2.  Create a stream API route (`/api/.../stream`) to push updates.
    3.  Use `EventSource` in the React component to listen and update the individual Query Cache.

### B. Instant UI Updates
- **Standard**: When a real-time event is received, update the UI state (e.g., `queryClient.setQueryData`) immediately instead of waiting for a manual page refresh.
