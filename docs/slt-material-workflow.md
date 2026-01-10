# SLT Material Request & GRN Workflow - සම්පූර්ණ ක්‍රියාවලිය

## සාරාංශය (Summary)

SLT වෙතින් materials ලබා ගැනීමේ සම්පූර්ණ workflow එක:

1. **Stores Manager** - Request list එකක් හදනවා
2. **OSP Manager** - Approve/Reject කරනවා + Remarks එකතු කරනවා
3. **Stores Manager** - Approve වුණාම SLT එකට email කරනවා
4. **SLT Delivery** - Materials එනවා delivery note එකක් සමඟ
5. **GRN Entry** - System එකට GRN enter කරනවා, request select කරලා compare කරනවා

---

## 1. Material Request Creation (Stores Manager)

**API Endpoint:** `POST /api/inventory/requests`

**Request Body:**
```json
{
  "fromStoreId": "main-store-id",  // Requesting store
  "toStoreId": null,  // null = External (SLT)
  "requestedById": "stores-manager-user-id",
  "items": [
    {
      "itemId": "item-1-id",
      "requestedQty": 500
    },
    {
      "itemId": "item-2-id",
      "requestedQty": 200
    }
  ]
}
```

**Response:**
```json
{
  "id": "req-xxx",
  "requestNr": "REQ-123456",
  "status": "PENDING",
  "fromStoreId": "...",
  "toStoreId": null,
  "requestedById": "...",
  "items": [...]
}
```

---

## 2. Request Approval/Rejection (OSP Manager)

**API Endpoint:** `PATCH /api/inventory/requests`

### Approve කරන විට:
```json
{
  "requestId": "req-xxx",
  "action": "APPROVE",
  "approvedById": "osp-manager-user-id",
  "remarks": "Approved for Q1 2025. Urgent delivery required.",
  "allocation": [
    {
      "itemId": "item-1-id",
      "approvedQty": 450  // Requested 500, approved 450
    },
    {
      "itemId": "item-2-id",
      "approvedQty": 200
    }
  ]
}
```

### Reject කරන විට:
```json
{
  "requestId": "req-xxx",
  "action": "REJECT",
  "approvedById": "osp-manager-user-id",
  "remarks": "Budget constraints. Resubmit next quarter."
}
```

**Response:**
```json
{
  "id": "req-xxx",
  "status": "APPROVED",  // or "REJECTED"
  "approvedById": "...",
  "approvedBy": {
    "name": "OSP Manager Name"
  },
  "remarks": "Approved for Q1 2025...",
  "items": [
    {
      "itemId": "...",
      "requestedQty": 500,
      "approvedQty": 450
    }
  ]
}
```

---

## 3. Email to SLT (Stores Manager Action)

Approve වුණ පසු Stores Manager:
1. Request details බලනවා (`GET /api/inventory/requests?storeId=xxx`)
2. Email template එකක් generate කරනවා approved items list එක සමඟ
3. SLT procurement team එකට email කරනවා

**Email Template Example:**
```
Subject: Material Request - REQ-123456

Dear SLT Procurement Team,

We request the following materials for [Store Name]:

Item Code | Item Name | Approved Quantity
----------|-----------|------------------
ITM-001   | Cable 5m  | 450 units
ITM-002   | Router    | 200 units

Requested By: [Stores Manager Name]
Approved By: [OSP Manager Name]
Approval Remarks: Approved for Q1 2025. Urgent delivery required.

Please arrange delivery at your earliest convenience.

Best regards,
[Store Name] Management
```

---

## 4. SLT Delivery

SLT materials deliver කරන විට:
- **Delivery Note/Report** එකක් එනවා (ID එකක් සමඟ, e.g., "SLT-DN-2025-001")
- Physical materials එනවා
- Stores Manager verify කරනවා

---

## 5. GRN Entry (Goods Receipt Note)

**API Endpoint:** `POST /api/inventory/grn`

### Request Select කරලා GRN කරන විට:
```json
{
  "storeId": "main-store-id",
  "sourceType": "SLT",
  "supplier": "SLT Materials Division",
  "receivedById": "stores-manager-user-id",
  "requestId": "req-xxx",  // Link to the approved request
  "sltReferenceId": "SLT-DN-2025-001",  // SLT delivery note ID
  "items": [
    {
      "itemId": "item-1-id",
      "quantity": 430  // Received 430 (Approved 450, Requested 500)
    },
    {
      "itemId": "item-2-id",
      "quantity": 200  // Received exactly as approved
    },
    {
      "itemId": "item-3-id",
      "quantity": 50  // Extra item not in request
    }
  ]
}
```

**What Happens:**
1. GRN record created
2. Stock added to store
3. Transaction logged
4. Request status → `COMPLETED`
5. `sltReferenceId` saved in request

---

## 6. Viewing GRN with Request Comparison

**API Endpoint:** `GET /api/inventory/grn?storeId=xxx`

**Response:**
```json
{
  "id": "grn-xxx",
  "grnNumber": "GRN-1735402800000",
  "storeId": "...",
  "sourceType": "SLT",
  "supplier": "SLT Materials Division",
  "receivedById": "...",
  "receivedBy": {
    "name": "Stores Manager Name"
  },
  "createdAt": "2025-12-28T16:00:00Z",
  "request": {
    "id": "req-xxx",
    "requestNr": "REQ-123456",
    "status": "COMPLETED",
    "sltReferenceId": "SLT-DN-2025-001",
    "requestedBy": {
      "name": "Stores Manager Name"
    },
    "approvedBy": {
      "name": "OSP Manager Name"
    },
    "remarks": "Approved for Q1 2025. Urgent delivery required.",
    "items": [
      {
        "itemId": "item-1-id",
        "item": { "code": "ITM-001", "name": "Cable 5m" },
        "requestedQty": 500,
        "approvedQty": 450
      },
      {
        "itemId": "item-2-id",
        "item": { "code": "ITM-002", "name": "Router" },
        "requestedQty": 200,
        "approvedQty": 200
      }
    ]
  },
  "items": [
    {
      "itemId": "item-1-id",
      "item": { "code": "ITM-001", "name": "Cable 5m" },
      "quantity": 430
    },
    {
      "itemId": "item-2-id",
      "item": { "code": "ITM-002", "name": "Router" },
      "quantity": 200
    },
    {
      "itemId": "item-3-id",
      "item": { "code": "ITM-003", "name": "Switch" },
      "quantity": 50
    }
  ]
}
```

---

## Frontend Comparison Table (UI Example)

```typescript
// Calculate comparison
const comparison = grn.request?.items.map(reqItem => {
  const grnItem = grn.items.find(i => i.itemId === reqItem.itemId);
  const received = grnItem?.quantity || 0;
  const approved = reqItem.approvedQty;
  
  return {
    itemCode: reqItem.item.code,
    itemName: reqItem.item.name,
    requested: reqItem.requestedQty,
    approved: approved,
    received: received,
    variance: received - approved,
    status: received === approved ? 'EXACT' : 
            received < approved ? 'SHORT' : 'EXCESS'
  };
});

// Extra items (not in request)
const extraItems = grn.items.filter(grnItem => 
  !grn.request?.items.some(reqItem => reqItem.itemId === grnItem.itemId)
);
```

**Display Table:**
```
Item Code | Item Name | Requested | Approved | Received | Variance | Status
----------|-----------|-----------|----------|----------|----------|--------
ITM-001   | Cable 5m  | 500       | 450      | 430      | -20      | SHORT
ITM-002   | Router    | 200       | 200      | 200      | 0        | EXACT
ITM-003   | Switch    | -         | -        | 50       | +50      | EXTRA
```

---

## Database Fields Summary

### StockRequest
- `requestNr` - Request number (auto-generated)
- `fromStoreId` - Requesting store (can be null)
- `toStoreId` - Provider store (null for external/SLT)
- `status` - PENDING, APPROVED, REJECTED, COMPLETED
- `requestedById` - Who created the request
- `approvedById` - Who approved/rejected
- `remarks` - **NEW** - OSP Manager comments
- `sltReferenceId` - **NEW** - SLT delivery note ID
- `items` - Requested items with quantities

### GRN
- `grnNumber` - GRN number (auto-generated)
- `storeId` - Receiving store
- `sourceType` - SLT, LOCAL_PURCHASE
- `supplier` - Supplier name
- `requestId` - **NEW** - Link to StockRequest
- `receivedById` - Who received the goods
- `items` - Received items with quantities

---

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

3. **Create UI Pages:**
   - Material Request Form (Stores Manager)
   - Request Approval Page (OSP Manager)
   - GRN Entry Form (with request dropdown)
   - GRN History with Comparison View

---

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/inventory/requests` | Create material request |
| PATCH | `/api/inventory/requests` | Approve/Reject request |
| GET | `/api/inventory/requests?storeId=xxx` | List requests |
| POST | `/api/inventory/grn` | Create GRN |
| GET | `/api/inventory/grn?storeId=xxx` | List GRNs with request details |

---

## සටහන් (Notes)

✅ OSP Manager ට remarks add කරන්න පුළුවන්
✅ SLT delivery note ID save වෙනවා
✅ Request select කරලා GRN කරන්න පුළුවන්
✅ Requested vs Received compare කරන්න පුළුවන්
✅ Extra items add කරන්න පුළුවන් (request එකේ නැති items)
✅ Approve කරන විට requested ප්‍රමාණයට වඩා අඩුවෙන් approve කරන්න පුළුවන්
