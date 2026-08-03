---
name: page-blueprint
description: SLTSERP page blueprint workflow for building new pages. Use when the user provides a filled page blueprint, says "build this page from the blueprint", or asks to create a new SLTSERP page or major feature. Enforces design standards, TanStack Query, role checks, and the orchestrator pattern.
---

# SLTSERP Page Blueprint Workflow

Use this workflow every time a new page or major feature is built in SLTSERP. It ensures consistency, reduces rework, and enforces design standards.

When the developer provides a filled blueprint:

1. Acknowledge the blueprint and ask 1-2 clarifying questions if needed.
2. Generate the full page code following SLTSERP development standards (sidebar + header layout, compact table layout, TanStack Query, toast notifications, role checks).

## Step 1: Get the Blueprint Template

The template file is bundled with this skill: [PAGE_BLUEPRINT_TEMPLATE.md](PAGE_BLUEPRINT_TEMPLATE.md)

Copy it and fill in all sections relevant to the page.

## Step 2: Build From the Blueprint

When the user pastes a filled blueprint (e.g. "Build this page from the blueprint"), generate:

- `page.tsx` — orchestrator page with Sidebar + Header
- `hooks/use[Entity]Operations.ts` — TanStack Query mutations
- `components/[Entity]Table.tsx` — compact table component
- `components/[Entity]FormDialog.tsx` — create/edit dialog if needed

## Step 3: Review Generated Code

Before committing:

1. Check that the route matches what was specified.
2. Check RBAC roles are applied correctly.
3. Check API endpoints match the backend routes.
4. Run `npm run build` to verify no TypeScript errors.

## SLTSERP Design Standards Enforced Automatically

When building from a blueprint, always apply:

| Standard | Implementation |
|----------|---------------|
| Page wrapper | `h-screen flex bg-slate-50 overflow-hidden` |
| Content area | `flex-1 overflow-y-auto p-4` |
| Page title | `text-base font-bold text-slate-900` |
| Primary button | `bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 rounded-lg text-xs font-semibold` |
| Secondary button | `border border-slate-200 text-slate-600 hover:bg-slate-50 h-8 px-3 rounded-lg text-xs` |
| Search input | `h-8 bg-white border border-slate-200 rounded-lg text-xs pl-8` |
| Table header | sticky, `bg-slate-50`, `text-[10px] font-bold uppercase text-slate-500` |
| Table row | `hover:bg-slate-50 border-b border-slate-100 h-10` |
| Status badge (Active) | `bg-emerald-50 text-emerald-700 border border-emerald-200` |
| Status badge (Pending) | `bg-amber-50 text-amber-700 border border-amber-200` |
| Status badge (Rejected) | `bg-red-50 text-red-600 border border-red-200` |
| Loading state | Skeleton rows (3-5 animated placeholder rows) |
| Empty state | Centered icon + title + subtitle + action button |
| Data fetching | TanStack Query `useQuery` |
| Mutations | TanStack Query `useMutation` + `sonner` toast |
| Forms | React Hook Form + Zod validation |

## Example Blueprint to Page Output

Blueprint input:

```
Page Title: Store Management
Route: /admin/stores
Access: SUPER_ADMIN, ADMIN
Layout: Compact Table
Columns: Name | Code | Type | Location | Status | Actions
Actions: Edit, Delete
API: GET /api/stores | POST /api/stores | PUT /api/stores | DELETE /api/stores
Stats: Total / Active / Inactive
```

Output generated:

- `/src/app/admin/stores/page.tsx` — orchestrator
- `/src/app/admin/stores/hooks/useStoreOperations.ts` — mutations
- `/src/app/admin/stores/components/StoreTable.tsx` — compact table
- `/src/app/admin/stores/components/StoreFormDialog.tsx` — create/edit form
