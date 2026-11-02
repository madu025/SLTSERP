# Inventory deep gap audit — 2026-11-02

## Scope

This review compared Store Operations, the executive/CSO dashboard, Project Logistics, material requests/GRN/MRN queues, inventory APIs, database reporting functions, RBAC scope, and stock-initialization behavior.

## Authoritative rules

- `InventoryStock.quantity` is physical on-hand quantity.
- `InventoryStock.allocatedQuantity` is already committed and must be subtracted before showing available stock.
- A positive store `minLevel` overrides the item default; otherwise the item minimum is used.
- Reorder is required when available quantity is negative or at/below the effective minimum.
- A pending GRN is a `StockRequest` in `GRN_PENDING` or `STORE_RECEIVING`. A `GRN` row is a receipt that has already been recorded and must not be counted as a pending delivery.
- Store and OPMC scope is enforced server-side through canonical permissions and accessible-store resolution.

## Gaps found and corrected

1. The executive dashboard checked physical quantity only, so reservations could make a store appear healthy when its available stock was below the minimum. A shared rule now drives dashboard and alert calculations.
2. Main dashboard “Pending GRNs” counted `ProjectGoodsReceipt` records, while the Store Command Center counted completed `GRN` rows. Both were misleading. The dashboard now reports separate queues: pending material requests, requests awaiting GRN, recorded GRNs, MRNs, project receipts, and contractor returns.
3. The global Inventory KPI route used legacy display-role names for global valuation and could translate an unassigned scoped user into an empty Prisma filter, exposing all stores. It now uses OPMC scope, canonical inventory-read permission, accessible stores, and a deny-all UUID sentinel when no store is accessible.
4. Inventory stock reads and pending-balance reads lacked complete store-scope enforcement. The API now validates the requested store against the caller’s accessible stores.
5. Stock initialization trusted a client header for the actor and had no UI permission guard. It now uses the authenticated API context and requires the canonical inventory-write permission.
6. Project Logistics counted inventory globally and used physical stock for low-stock alerts. It now limits inventory stores to the caller’s OPMC scope and shows available, on-hand, allocated, and minimum quantities.
7. `fn_bulk_stock_initialize` decremented every FIFO batch by the full adjustment amount instead of each batch’s picked amount and could reduce stock below allocations. The migration adds row locking, per-batch pick quantities, array validation, negative-quantity rejection, and an allocated-quantity floor.
8. Store SQL functions used different minimum/availability rules and cost fallbacks. The consistency migration aligns low-stock, material-balance, dashboard-summary, and valuation behavior.

## Verification

Local checks for this change:

```powershell
pnpm exec tsx --test tests/unit/inventory-dashboard-metrics.test.ts
pnpm run test:types
pnpm run lint
```

The database migration must be applied through the normal release pipeline before production claims are made. After deployment, verify `/api/health/live`, an authenticated inventory dashboard read, a scoped store read, and a browser read-back of on-hand/allocated/available values.

## Remaining follow-up

- Run the authenticated browser lifecycle test against a disposable QA database after the migration is applied.
- Reconcile any historical rows where `allocatedQuantity` is negative or greater than `quantity`; the dashboard now surfaces these as data-quality exceptions but does not silently rewrite business data.
- Review AI/context reporting queries that still use a hard-coded quantity threshold; they are not used by the operational dashboard path and should be migrated to the shared rule in a separate change.
