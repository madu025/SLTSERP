# GRN Request Workflow - Implementation Summary

## Overview
The system now supports a complete Material Request → Approval → GRN workflow with full traceability.

## Database Schema Changes

### StockRequest Model (Updated)
- `fromStoreId`: Now **optional** (nullable) - for external purchases, this can be null
- `toStoreId`: Now **optional** (nullable) - for external purchases, this is null
- `grn`: Added relation to GRN (one-to-one)

### GRN Model (Updated)
- `requestId`: Added **optional** field to link GRN to a StockRequest
- `request`: Added relation to StockRequest

## Workflow

### 1. Material Request Creation
**Endpoint:** `POST /api/inventory/requests`

**For External Purchase:**
```json
{
  "fromStoreId": "store-id-requesting",
  "toStoreId": null,  // null indicates external supplier
  "requestedById": "user-id",
  "items": [
    { "itemId": "item-1", "requestedQty": 100 },
    { "itemId": "item-2", "requestedQty": 50 }
  ]
}
```

**For Internal Transfer:**
```json
{
  "fromStoreId": "branch-store-id",
  "toStoreId": "main-store-id",
  "requestedById": "user-id",
  "items": [...]
}
```

### 2. Request Approval
**Endpoint:** `PATCH /api/inventory/requests`

```json
{
  "requestId": "request-id",
  "action": "APPROVE",
  "approvedById": "approver-user-id",
  "allocation": [
    { "itemId": "item-1", "approvedQty": 90 },  // Can approve less than requested
    { "itemId": "item-2", "approvedQty": 50 }
  ]
}
```

**Behavior:**
- **External Purchase:** Status → `APPROVED` (no stock movement, awaiting GRN)
- **Internal Transfer:** Status → `COMPLETED` (immediate stock transfer between stores)

### 3. GRN Entry (Goods Receipt)
**Endpoint:** `POST /api/inventory/grn`

```json
{
  "storeId": "receiving-store-id",
  "sourceType": "LOCAL_PURCHASE",  // or "SLT"
  "supplier": "Supplier Name",
  "receivedById": "user-id",
  "requestId": "linked-request-id",  // OPTIONAL - links to approved request
  "items": [
    { "itemId": "item-1", "quantity": 85 },  // Actual received quantity
    { "itemId": "item-2", "quantity": 50 },
    { "itemId": "item-3", "quantity": 10 }   // Can receive items NOT in request
  ]
}
```

**What Happens:**
1. GRN record created
2. Stock added to the store
3. Transaction logged (type: `GRN_IN`)
4. If `requestId` provided, request status → `COMPLETED`

### 4. Viewing GRN with Request Details
**Endpoint:** `GET /api/inventory/grn?storeId=xxx`

**Response includes:**
```json
{
  "id": "grn-id",
  "grnNumber": "GRN-123456",
  "storeId": "...",
  "store": { "name": "..." },
  "receivedBy": { "name": "..." },
  "createdAt": "2025-12-28...",
  "request": {  // NULL if not linked to a request
    "requestNr": "REQ-123",
    "requestedBy": { "name": "..." },
    "approvedBy": { "name": "..." },
    "items": [
      {
        "itemId": "...",
        "item": { "name": "Item 1" },
        "requestedQty": 100,
        "approvedQty": 90
      }
    ]
  },
  "items": [
    {
      "itemId": "...",
      "item": { "name": "Item 1" },
      "quantity": 85  // Actual received
    }
  ]
}
```

## Data Tracking

The system now tracks:
1. **Who requested** (`requestedBy`)
2. **Who approved** (`approvedBy`)
3. **Requested quantity** (`requestedQty`)
4. **Approved quantity** (`approvedQty`)
5. **Received quantity** (GRN `items.quantity`)
6. **When received** (GRN `createdAt`)
7. **Which store** (GRN `storeId`)
8. **Supplier** (GRN `supplier`)
9. **Receiver** (GRN `receivedById`)

## Comparison Logic (Frontend)

To show "Requested vs Received":
```typescript
const comparison = grn.request?.items.map(reqItem => {
  const grnItem = grn.items.find(i => i.itemId === reqItem.itemId);
  return {
    itemName: reqItem.item.name,
    requested: reqItem.requestedQty,
    approved: reqItem.approvedQty,
    received: grnItem?.quantity || 0,
    variance: (grnItem?.quantity || 0) - reqItem.approvedQty
  };
});
```

## Next Steps

1. **Restart dev server** for Prisma changes to take effect
2. **Create UI** for:
   - Material Request form (with option for external/internal)
   - Request approval page
   - GRN entry form (with request selection dropdown)
   - GRN history view (showing comparison table)

## Notes

- GRN can be created **without** a request (ad-hoc purchases)
- GRN can include items **not in the request** (extra items received)
- Request approval for external purchases doesn't move stock (only GRN does)
- All operations are logged in `InventoryTransaction` for audit trail
