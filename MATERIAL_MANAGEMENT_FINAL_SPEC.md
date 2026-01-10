# Material Management System - Final Specifications

## ✅ Clarified Requirements

### **1. Standard Materials per SOD** ✅

**Material Categories:**
- **OSP New Connection** - Standard materials for new connections
- **FAC (Fiber Access Cable)** - Fiber cables and related items

**Material Register Form:**
```
Category: OSP New Connection
Items:
  - ONT Device (1 nos per connection)
  - Fiber Dropwire (50m standard, max 100m)
  - Connectors (4 nos standard)
  - STB Box (1 nos if IPTV)
  - Mounting Kit (1 set)
```

**Implementation:**
- Materials auto-populate based on package type
- User can adjust quantities if needed
- System validates against standards

---

### **2. Wastage Rules** ✅

**Wastage Limits:**

| Material Type | Standard Usage | Max Wastage | Approval Required |
|--------------|----------------|-------------|-------------------|
| FAC (Fiber Dropwire) | Per connection | 5% of drum (100m per 2000m drum) | Yes, if >5% |
| ONT Device | 1 per SOD | 0% | Always (if wastage) |
| Connectors | 4 per SOD | 10% (0.4 per SOD) | Yes, if >10% |
| STB Box | 1 per SOD | 0% | Always (if wastage) |

**Wastage Validation:**
```typescript
// Example: Fiber Dropwire
Drum Size: 2000m
Max Wastage: 5% = 100m
Per Connection Standard: 50m
Per Connection Max Wastage: 5% of 50m = 2.5m

If wastage > 2.5m:
  - Require comment
  - Flag for approval
  - Store Manager reviews
```

**Comment Required When:**
- Wastage exceeds standard percentage
- High-value items (ONT, STB) have any wastage
- Unusual usage patterns

---

### **3. Material Return** ✅

**Return Process:**
```
Month End:
1. Contractor checks closing balance
2. If excess materials (>20% of monthly usage):
   - Can return to store
   - Store accepts and updates balance
   - Next month opening balance adjusted

Return Form:
  - Contractor: ABC Contractors
  - Month: January 2025
  - Items to Return:
    • Fiber Dropwire: 200m
    • Connectors: 10 nos
  - Reason: Over-estimation
```

---

### **4. Store-Wise Balance Sheets** ✅

**Separate Balance Sheet per Store:**

```
ABC Contractors
├── Kaduwela Store Balance Sheet (Jan 2025)
│    ├── Opening: 100 items
│    ├── Received: 500 items
│    ├── Used: 450 items
│    ├── Wastage: 20 items
│    └── Closing: 130 items
│
└── Homagama Store Balance Sheet (Jan 2025)
     ├── Opening: 50 items
     ├── Received: 300 items
     ├── Used: 280 items
     ├── Wastage: 10 items
     └── Closing: 60 items
```

**Consolidated Report:**
- Total across all stores
- Per-store breakdown
- Usage comparison

---

## 🗄️ Updated Database Schema

```prisma
// Material Categories
model MaterialCategory {
  id          String   @id @default(cuid())
  name        String   @unique // "OSP New Connection", "FAC"
  description String?
  items       InventoryItem[]
  standards   MaterialStandard[]
  createdAt   DateTime @default(now())
}

// Standard materials per package type
model MaterialStandard {
  id              String   @id @default(cuid())
  categoryId      String
  category        MaterialCategory @relation(fields: [categoryId], references: [id])
  
  packageType     String   // "VOICE_INT", "VOICE_IPTV", etc.
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  standardQty     Float    // Standard quantity per SOD
  maxQty          Float?   // Maximum allowed
  wastagePercent  Float    @default(5) // Max wastage %
  
  @@unique([categoryId, packageType, itemId])
}

// Material issued to contractor (per store)
model ContractorMaterialIssue {
  id              String   @id @default(cuid())
  contractorId    String
  contractor      Contractor @relation(fields: [contractorId], references: [id])
  storeId         String
  store           InventoryStore @relation(fields: [storeId], references: [id])
  
  issueDate       DateTime @default(now())
  month           String   // "2025-01"
  issuedBy        String?  // User ID
  
  items           ContractorMaterialIssueItem[]
  
  @@index([contractorId, storeId, month])
}

model ContractorMaterialIssueItem {
  id              String   @id @default(cuid())
  issueId         String
  issue           ContractorMaterialIssue @relation(fields: [issueId], references: [id], onDelete: Cascade)
  
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  quantity        Float
  unit            String
}

// Material used per SOD
model SODMaterialUsage {
  id              String   @id @default(cuid())
  serviceOrderId  String
  serviceOrder    ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  quantity        Float
  unit            String
  usageType       String   // "USED", "WASTAGE"
  
  // Wastage tracking
  wastagePercent  Float?   // Calculated wastage %
  exceedsLimit    Boolean  @default(false) // If wastage > standard
  comment         String?  @db.Text // Required if exceeds limit
  approvedBy      String?  // Store Manager approval
  approvedAt      DateTime?
  
  createdAt       DateTime @default(now())
  
  @@index([serviceOrderId])
}

// Material returns
model ContractorMaterialReturn {
  id              String   @id @default(cuid())
  contractorId    String
  contractor      Contractor @relation(fields: [contractorId], references: [id])
  storeId         String
  store           InventoryStore @relation(fields: [storeId], references: [id])
  
  returnDate      DateTime @default(now())
  month           String   // Month being returned for
  reason          String?  @db.Text
  
  items           ContractorMaterialReturnItem[]
  
  acceptedBy      String?  // Store Manager
  acceptedAt      DateTime?
  
  @@index([contractorId, storeId, month])
}

model ContractorMaterialReturnItem {
  id              String   @id @default(cuid())
  returnId        String
  return          ContractorMaterialReturn @relation(fields: [returnId], references: [id], onDelete: Cascade)
  
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  quantity        Float
  unit            String
  condition       String   @default("GOOD") // GOOD, DAMAGED
}

// Monthly balance sheet (per store)
model ContractorMaterialBalanceSheet {
  id              String   @id @default(cuid())
  contractorId    String
  contractor      Contractor @relation(fields: [contractorId], references: [id])
  storeId         String
  store           InventoryStore @relation(fields: [storeId], references: [id])
  
  month           String   // "2025-01"
  
  items           ContractorBalanceSheetItem[]
  
  totalValue      Float?
  usageRate       Float?   // Percentage
  wastageRate     Float?   // Percentage
  
  generatedAt     DateTime @default(now())
  generatedBy     String?  // User ID
  
  @@unique([contractorId, storeId, month])
  @@index([month])
}

model ContractorBalanceSheetItem {
  id              String   @id @default(cuid())
  balanceSheetId  String
  balanceSheet    ContractorMaterialBalanceSheet @relation(fields: [balanceSheetId], references: [id], onDelete: Cascade)
  
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  openingBalance  Float    // From previous month
  received        Float    // Issued this month
  returned        Float    @default(0) // Returned to store
  used            Float    // Used in SODs
  wastage         Float    // Wastage
  closingBalance  Float    // Opening + Received - Returned - Used - Wastage
  requiredNext    Float?   // Estimated for next month
  
  @@index([balanceSheetId])
}
```

---

## 🔄 Updated Workflow

### **1. Material Standards Setup**

```typescript
// Setup standard materials for OSP New Connection
const standards = [
  {
    category: "OSP New Connection",
    packageType: "VOICE_INT",
    items: [
      { name: "ONT Device", qty: 1, maxWastage: 0 },
      { name: "Fiber Dropwire", qty: 50, maxWastage: 5 },
      { name: "Connectors", qty: 4, maxWastage: 10 }
    ]
  },
  {
    category: "OSP New Connection",
    packageType: "VOICE_IPTV",
    items: [
      { name: "ONT Device", qty: 1, maxWastage: 0 },
      { name: "STB Box", qty: 1, maxWastage: 0 },
      { name: "Fiber Dropwire", qty: 50, maxWastage: 5 },
      { name: "Connectors", qty: 6, maxWastage: 10 }
    ]
  }
];
```

### **2. SOD Completion with Materials**

```typescript
// Auto-populate materials based on package type
const sodPackage = "VOICE_IPTV";
const standards = await getStandardMaterials(sodPackage);

// Pre-fill form
{
  materials: [
    { item: "ONT Device", qty: 1, wastage: 0 },
    { item: "STB Box", qty: 1, wastage: 0 },
    { item: "Fiber Dropwire", qty: 50, wastage: 0 },
    { item: "Connectors", qty: 6, wastage: 0 }
  ]
}

// User adjusts if needed
// System validates wastage
if (wastage > standard.wastagePercent) {
  requireComment = true;
  requireApproval = true;
}
```

### **3. Wastage Validation**

```typescript
function validateWastage(item, used, wastage) {
  const standard = getStandard(item);
  const wastagePercent = (wastage / used) * 100;
  
  if (wastagePercent > standard.maxWastagePercent) {
    return {
      valid: false,
      requiresComment: true,
      requiresApproval: true,
      message: `Wastage ${wastagePercent}% exceeds limit ${standard.maxWastagePercent}%`
    };
  }
  
  return { valid: true };
}

// Example: Fiber Dropwire
Used: 50m
Wastage: 5m
Wastage %: (5/50) * 100 = 10%
Standard Max: 5%
Result: ❌ Exceeds limit, comment required
```

### **4. Material Return Process**

```typescript
// Month end - contractor returns excess
POST /api/contractors/{id}/material-returns
{
  storeId: "store123",
  month: "2025-01",
  reason: "Over-estimation",
  items: [
    { itemId: "fiber-dropwire", quantity: 200, unit: "m", condition: "GOOD" },
    { itemId: "connectors", quantity: 10, unit: "nos", condition: "GOOD" }
  ]
}

// Store Manager accepts
PATCH /api/contractors/{id}/material-returns/{returnId}/accept
{
  acceptedBy: "user123"
}

// System updates:
1. Add returned qty to store stock
2. Deduct from contractor balance
3. Update balance sheet
```

### **5. Store-Wise Balance Sheets**

```typescript
// Generate per store
for (const store of contractor.assignedStores) {
  await generateBalanceSheet({
    contractorId,
    storeId: store.id,
    month: "2025-01"
  });
}

// Consolidated view
const consolidated = {
  contractor: "ABC Contractors",
  month: "2025-01",
  stores: [
    {
      name: "Kaduwela Store",
      totalValue: 150000,
      usageRate: 85%,
      wastageRate: 4%
    },
    {
      name: "Homagama Store",
      totalValue: 100000,
      usageRate: 90%,
      wastageRate: 3%
    }
  ],
  grandTotal: 250000
};
```

---

## 📱 Updated UI Components

### **SOD Completion with Auto-Populated Materials**

```
┌─────────────────────────────────────────────────────────┐
│  Complete SOD #12345                                    │
│  Package: VOICE_IPTV                                    │
├─────────────────────────────────────────────────────────┤
│  Contractor: ABC Contractors                            │
│  Team: Team Alpha                                       │
│  ONT Serial: [__________]                               │
│                                                         │
│  Materials Used (Auto-populated):                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Item           │ Used │ Wastage │ Max │ Status   │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ONT Device     │  1   │   0     │ 0%  │ ✓       │ │
│  │ STB Box        │  1   │   0     │ 0%  │ ✓       │ │
│  │ Fiber Dropwire │ 50m  │  2m     │ 5%  │ ✓       │ │
│  │ Connectors     │  6   │   1     │ 10% │ ⚠️ High │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ⚠️ Connector wastage (16.7%) exceeds limit (10%)     │
│  Comment Required: [_________________________]         │
│                                                         │
│  [Cancel]  [Complete SOD]                              │
└─────────────────────────────────────────────────────────┘
```

### **Material Return Form**

```
┌─────────────────────────────────────────────────────────┐
│  Return Materials to Store                              │
├─────────────────────────────────────────────────────────┤
│  Contractor: ABC Contractors                            │
│  Store: Kaduwela Store                                  │
│  Month: January 2025                                    │
│                                                         │
│  Current Balance:                                       │
│  • Fiber Dropwire: 650m                                │
│  • Connectors: 30 nos                                   │
│                                                         │
│  Items to Return:                                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Fiber Dropwire  [200] m    Condition: [GOOD ▼]   │ │
│  │ Connectors      [10] nos   Condition: [GOOD ▼]   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Reason: [Over-estimation for the month___________]    │
│                                                         │
│  [Cancel]  [Submit Return]                             │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Implementation Priority

### **Phase 1: Core Material Tracking** (Week 1)
1. ✅ Database schema
2. ✅ Material standards setup
3. ✅ SOD completion with materials
4. ✅ Wastage validation

### **Phase 2: Balance Sheets** (Week 2)
1. ✅ Material issue system
2. ✅ Auto-generate balance sheets
3. ✅ Store-wise reports
4. ✅ PDF export

### **Phase 3: Returns & Advanced** (Week 3)
1. ✅ Material return system
2. ✅ Wastage approval workflow
3. ✅ Analytics & trends
4. ✅ Cost tracking

---

**Status:** Specifications Complete, Ready for Implementation
**Estimated Time:** 3 weeks
**Next Step:** Database schema update

ඔබට මේ specifications එක හරිද? මම implementation එක start කරන්නද? 🚀
