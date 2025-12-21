---
description: Comprehensive guidelines for developing new features, pages, and APIs in the SLTSERP project, focusing on performance, security, and aesthetics.
---

# SLTSERP Development Standards & Best Practices

Use this document as the "Gold Standard" when implementing new features or refactoring existing code.

## 1. Frontend Architecture & Performance

### A. Component Modularization
- **Modals & Dialogs**: NEVER code large modals directly inside a page file. Extract them into strict components in `src/components/modals/`.
- **Complex UI Sections**: Break down complex pages into smaller, reusable components.

### B. Dynamic Imports (Code Splitting)
- Use `next/dynamic` to load heavy components (especially Modals and Charts) only when they are needed.
- This reduces the initial bundle size and improves First Contentful Paint (FCP).

```tsx
// Example
import dynamic from 'next/dynamic';
const MyHeavyModal = dynamic(() => import('@/components/modals/MyHeavyModal'), { ssr: false });
```

### C. State Management
- Keep state as local as possible.
- Use strict interfaces for all state variables and props.

### D. Navigation & Menu Management (NEW)
- **Centralized Config**: ALWAYS use `src/config/sidebar-menu.ts` to manage sidebar items. NEVER hardcode links in the Sidebar component.
- **Role-Based Visibility**: Use the predefined `ROLE_GROUPS` in the config to control who sees what.

## 2. Security & Access Control (RBAC)

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

## 3. Database & Data Integrity

### A. Prisma Best Practices
- Use `transaction` for operations that affect multiple records (e.g., syncing data).
- Always strictly type `where` clauses to prevent accidental bulk updates.
- Use `upsert` for synchronization logic to avoid duplicates.

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

## 6. Data Validation (Future Standard)

### A. Zod Implementation
- Use **Zod** schemas for both Frontend form validation and Backend API body validation.
- This ensures that invalid data never reaches the database and reduces runtime errors.
- Create shared schemas in `src/lib/validations/` (if folder exists) or `src/lib/schemas.ts`.

## 7. Advanced Data Fetching (Future Standard)

### A. React Query (TanStack Query)
- Transition from `useEffect` to **React Query** for server state management.
- **Benefits**: Automatic caching, background updates, and built-in loading/error states.
- This effectively prevents "layout shift" and makes the app feel instant to the user.

## 8. Reusable Logic (Custom Hooks)

### A. Logic Extraction
- Don't repeat `fetch` logic. Encapsulate common data fetching or logic into Custom Hooks.
- **Location**: `src/hooks/`
- **Example**: `useServiceOrders(opmcId)`, `useAuth()`.

## 9. API Security (Rate Limiting)

### A. Anti-Abuse Measures
- Implement Rate Limiting on public or sensitive API endpoints (like Login) to prevent brute-force attacks.
- Middleware should track request counts per IP address.
