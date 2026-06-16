# Material Return Note (MRN) - Implementation Guide

## සාරාංශය (Summary)

MRN (Material Return Note) feature එක add කළා defective, excess, හෝ unused materials return කරන්න.

## Database Schema

### MRN Model
```prisma
model MRN {
  id          String   @id @default(cuid())
  mrnNumber   String   @unique
  storeId     String   
  returnType  String   // DEFECTIVE, EXCESS, UNUSED, WRONG_DELIVERY
  returnTo    String?  // SLT, SUPPLIER, MAIN_STORE
  supplier    String?  
  reason      String?  @db.Text
  grnId       String?  // Link to original GRN
  returnedById String
  status      String   @default("PENDING") // PENDING, APPROVED, COMPLETED
  approvedById String?
  items       MRNItem[]
}
```

## Workflow

### 1. Create MRN
**Endpoint:** `POST /api/inventory/mrn`

```json
{
  "storeId": "store-id",
  "returnType": "DEFECTIVE",  // DEFECTIVE, EXCESS, UNUSED, WRONG_DELIVERY
  "returnTo": "SLT",  // SLT, SUPPLIER, MAIN_STORE
  "supplier": "Supplier Name",
  "reason": "General reason for return",
  "returnedById": "user-id",
  "items": [
    {
      "itemId": "item-1",
      "quantity": 10,
      "reason": "Item-specific reason"
    }
  ]
}
```

**Status:** `PENDING` (Awaiting approval)

### 2. Approve/Reject MRN
**Endpoint:** `PATCH /api/inventory/mrn`

**Approve:**
```json
{
  "mrnId": "mrn-id",
  "action": "APPROVE",
  "approvedById": "approver-user-id"
}
```

**What Happens:**
1. MRN status → `COMPLETED`
2. Stock reduced from store
3. Transaction logged (type: `RETURN`)

**Reject:**
```json
{
  "mrnId": "mrn-id",
  "action": "REJECT",
  "approvedById": "approver-user-id"
}
```

### 3. View MRNs
**Endpoint:** `GET /api/inventory/mrn?storeId=xxx&status=PENDING`

## Return Types

| Type | Description |
|------|-------------|
| `DEFECTIVE` | Defective/damaged materials |
| `EXCESS` | Excess materials not needed |
| `UNUSED` | Unused materials from completed work |
| `WRONG_DELIVERY` | Wrong items delivered |

## Return Destinations

| Destination | Description |
|-------------|-------------|
| `SLT` | Return to SLT |
| `SUPPLIER` | Return to original supplier |
| `MAIN_STORE` | Return to main store (internal) |

## UI Pages

### MRN Creation Form
**Path:** `/admin/inventory/mrn/create`

**Features:**
- Store selection
- Return type dropdown
- Return destination
- Supplier field
- General reason textarea
- Item-by-item addition with individual reasons
- Compact table layout

**Access:** `SUPER_ADMIN`, `ADMIN`, `STORES_MANAGER`, `STORES_ASSISTANT`

## Sidebar Menu

Added under "Inventory / Stores":
- **MRN (Material Return)** → `/admin/inventory/mrn/create`

## Database Migration

Run these commands:
```bash
npx prisma db push
npx prisma generate
```

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/inventory/mrn` | Create MRN |
| GET | `/api/inventory/mrn?storeId=xxx` | List MRNs |
| PATCH | `/api/inventory/mrn` | Approve/Reject MRN |

## Comparison: Material Request vs Material Return

| Feature | Material Request | Material Return (MRN) |
|---------|-----------------|----------------------|
| Purpose | Request materials from SLT/Supplier | Return materials to SLT/Supplier |
| Status Flow | PENDING → APPROVED → COMPLETED | PENDING → APPROVED/REJECTED → COMPLETED |
| Stock Impact | Increases (on GRN) | Decreases (on approval) |
| Approval Required | Yes (OSP Manager) | Yes (Manager) |
| Link to GRN | Yes (GRN references Request) | Optional (MRN can reference GRN) |

## Next Steps

1. **Run Prisma Commands:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

2. **Restart Dev Server:**
   ```bash
   npm run dev
   ```

3. **Create Additional Pages (Optional):**
   - MRN List/History page
   - MRN Approval page
   - MRN Details view

## Notes

✅ MRN requires approval before stock reduction
✅ Each item can have individual reason
✅ General reason for entire MRN
✅ Can link to original GRN
✅ Supports multiple return types and destinations
✅ Transaction logging for audit trail

---

**Material Request (SLT Request):** `/admin/inventory/requests/create`
**Material Return (MRN):** `/admin/inventory/mrn/create`
