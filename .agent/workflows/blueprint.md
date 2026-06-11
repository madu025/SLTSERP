# SLTSERP Page Blueprint Workflow

---
description: Before building any new page in SLTSERP, fill in the Page Blueprint Template and submit it for AI code generation. This ensures consistency, reduces rework, and enforces design standards.
---

## When to Use This Workflow

Use this workflow **every time** you want to build a new page or major feature in SLTSERP.

**Command:** When the developer provides a filled blueprint, respond with:
1. Acknowledge the blueprint and ask 1-2 clarifying questions if needed
2. Generate the full page code following SLTSERP development standards (sidebar + header layout, compact table/chosen layout, TanStack Query, toast notifications, role checks)

---

## Step 1: Get the Blueprint Template

Open the template file:
```
d:\MyProject\SLTSERP\.agent\PAGE_BLUEPRINT_TEMPLATE.md
```

Copy it, fill in all sections relevant to your page.

---

## Step 2: Submit to AI

Paste your filled blueprint and say:

> **"Build this page from the blueprint"**

The AI will then:
- Generate `page.tsx` (Orchestrator page with Sidebar + Header)
- Generate `hooks/use[Entity]Operations.ts` (TanStack Query mutations)
- Generate `components/[Entity]Table.tsx` (compact table component)
- Generate `components/[Entity]FormDialog.tsx` (create/edit dialog if needed)

---

## Step 3: Review Generated Code

Before committing:
1. Check that route matches what you specified
2. Check RBAC roles are applied correctly
3. Check API endpoints match your backend routes
4. Run `npm run build` to verify no TypeScript errors

---

## SLTSERP Design Standards Enforced Automatically

When building from blueprint, AI will always apply:

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

---

## Example Blueprint → Page Output

**Blueprint input:**
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

**Output generated:**
- `/src/app/admin/stores/page.tsx` — orchestrator
- `/src/app/admin/stores/hooks/useStoreOperations.ts` — mutations
- `/src/app/admin/stores/components/StoreTable.tsx` — compact table
- `/src/app/admin/stores/components/StoreFormDialog.tsx` — create/edit form
