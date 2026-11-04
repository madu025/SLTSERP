# SOD material: manual entry vs SLT-reported

## Rule
- **Manual entry is the source of truth.** Contractors (SOD page) and staff (order action modal) enter material.
  Only manual entries (`SODMaterialUsage`: `USED`, `USED_F1`, `USED_G1`, `WASTAGE`) move stock and post the
  consumption ledger.
- **SLT-reported material is reference data.** The extension push (`/api/service-orders/extension-push`,
  bridge sync) now stores material in `SODSltReportedMaterial` (`source = EXTENSION`). It never creates
  `SODMaterialUsage` rows, never moves stock, never posts to the ledger, and an unmapped SLT item no longer fails the sync.
- When SLT provides an API, record its data with `SODSltReportedMaterialService.record(..., { source: 'API' })`.
  Nothing else changes: the deviation logic compares the same two sets.

## Deviation report
`GET /api/service-orders/material-deviation` (permission `sod.invoice`, OPMC scoped), page
`/service-orders/material-deviation`. Per order and item:

| Result | Meaning |
|---|---|
| `QTY_MISMATCH` | both sides have the item, quantities differ |
| `NOT_ENTERED` | SLT reported it, nobody entered it (raised for COMPLETED orders only) |
| `NOT_REPORTED` | entered manually, SLT did not report it |
| `UNMAPPED` | SLT item has no inventory mapping; add an alias on the inventory item |

Wastage is shown beside the line and never counted as used. The report also gives a deviation rate per contractor.

## Notes
- Orders created before this change have no SLT-reported rows and are not compared.
- Existing `PORTAL_SYNC` usage rows are left as they were.
