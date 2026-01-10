# Contractor Material Management System

## 🎯 Complete Workflow

### **Monthly Material Cycle:**

```
Month Start (e.g., January 2025)
  ↓
1. Contractor requests materials from Store
  ↓
2. Store issues materials to Contractor
  ↓
3. Contractor uses materials for SODs
  ↓
4. System tracks usage per SOD
  ↓
5. Wastage/損耗 tracked separately
  ↓
Month End
  ↓
6. Auto-generate Material Balance Sheet
  ↓
7. Calculate: Opening + Received - Used - Wastage = Closing
  ↓
Next Month: Closing Balance → Opening Balance
```

---

## 📊 Material Balance Sheet Structure

### **Monthly Report Format:**

```
CONTRACTOR MATERIAL BALANCE SHEET
Contractor: ABC Contractors
Month: January 2025
Store: Kaduwela Store

┌─────────────────────────────────────────────────────────────────────────┐
│ Item Name    │ Opening │ Received │ Used │ Wastage │ Closing │ Required │
│              │ Balance │ (Store)  │(SODs)│         │ Balance │(Next Mo.)│
├─────────────────────────────────────────────────────────────────────────┤
│ ONT Device   │   10    │    50    │  45  │    2    │   13    │    40    │
│ Fiber Cable  │  500m   │  1000m   │ 800m │   50m   │  650m   │   500m   │
│ STB Box      │    5    │    30    │  28  │    1    │    6    │    25    │
│ Connectors   │   20    │   100    │  85  │    5    │   30    │    70    │
└─────────────────────────────────────────────────────────────────────────┘

Summary:
- Total Items: 4
- Total Value: LKR 250,000
- Usage Rate: 85%
- Wastage Rate: 5%
```

---

## 🗄️ Database Schema

### **New Tables Needed:**

```prisma
// Material issued to contractor
model ContractorMaterialIssue {
  id              String   @id @default(cuid())
  contractorId    String
  contractor      Contractor @relation(fields: [contractorId], references: [id])
  storeId         String
  store           InventoryStore @relation(fields: [storeId], references: [id])
  
  issueDate       DateTime @default(now())
  month           String   // "2025-01" format
  
  items           ContractorMaterialIssueItem[]
  
  createdAt       DateTime @default(now())
  
  @@index([contractorId, month])
  @@index([storeId])
}

model ContractorMaterialIssueItem {
  id              String   @id @default(cuid())
  issueId         String
  issue           ContractorMaterialIssue @relation(fields: [issueId], references: [id])
  
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  quantity        Float
  unit            String
  
  @@index([issueId])
}

// Material used per SOD
model SODMaterialUsage {
  id              String   @id @default(cuid())
  serviceOrderId  String
  serviceOrder    ServiceOrder @relation(fields: [serviceOrderId], references: [id])
  
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  quantity        Float
  unit            String
  usageType       String   // "USED", "WASTAGE"
  
  createdAt       DateTime @default(now())
  
  @@index([serviceOrderId])
  @@index([itemId])
}

// Monthly balance sheet (auto-generated)
model ContractorMaterialBalanceSheet {
  id              String   @id @default(cuid())
  contractorId    String
  contractor      Contractor @relation(fields: [contractorId], references: [id])
  storeId         String
  store           InventoryStore @relation(fields: [storeId], references: [id])
  
  month           String   // "2025-01" format
  
  items           ContractorBalanceSheetItem[]
  
  totalValue      Float?
  usageRate       Float?   // Percentage
  wastageRate     Float?   // Percentage
  
  generatedAt     DateTime @default(now())
  
  @@unique([contractorId, storeId, month])
  @@index([month])
}

model ContractorBalanceSheetItem {
  id              String   @id @default(cuid())
  balanceSheetId  String
  balanceSheet    ContractorMaterialBalanceSheet @relation(fields: [balanceSheetId], references: [id])
  
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  
  openingBalance  Float    // From previous month's closing
  received        Float    // Issued from store this month
  used            Float    // Used in SODs
  wastage         Float    // Wastage/損耗
  closingBalance  Float    // Opening + Received - Used - Wastage
  requiredNext    Float?   // Estimated requirement for next month
  
  @@index([balanceSheetId])
}
```

---

## 🔄 Complete Process Flow

### **1. Material Request & Issue**

**Contractor requests materials:**
```typescript
// Contractor submits request
POST /api/contractors/{contractorId}/material-requests
{
  storeId: "store123",
  items: [
    { itemId: "item1", quantity: 50, unit: "nos" },
    { itemId: "item2", quantity: 1000, unit: "m" }
  ]
}

// Store Manager approves and issues
POST /api/contractors/{contractorId}/material-issues
{
  storeId: "store123",
  month: "2025-01",
  items: [
    { itemId: "item1", quantity: 50, unit: "nos" },
    { itemId: "item2", quantity: 1000, unit: "m" }
  ]
}
```

### **2. SOD Completion with Material Usage**

**When completing SOD:**
```typescript
// Existing completion data + material usage
POST /api/service-orders (PATCH)
{
  id: "sod123",
  sltsStatus: "COMPLETED",
  contractorId: "contractor123",
  teamId: "team123",
  
  // NEW: Material usage
  materialUsage: [
    {
      itemId: "ont-device",
      quantity: 1,
      unit: "nos",
      usageType: "USED"
    },
    {
      itemId: "fiber-cable",
      quantity: 50,
      unit: "m",
      usageType: "USED"
    },
    {
      itemId: "fiber-cable",
      quantity: 5,
      unit: "m",
      usageType: "WASTAGE"
    }
  ]
}
```

### **3. Auto-Generate Monthly Balance Sheet**

**Cron job or manual trigger:**
```typescript
// Run at month end
POST /api/contractors/{contractorId}/balance-sheet/generate
{
  month: "2025-01",
  storeId: "store123"
}

// System calculates:
1. Get opening balance (previous month's closing)
2. Get total received (material issues this month)
3. Get total used (from SOD completions)
4. Get total wastage (from SOD completions)
5. Calculate closing = opening + received - used - wastage
6. Estimate required for next month (based on usage pattern)
```

---

## 📱 UI Components

### **1. Material Issue Form (Store Manager)**

```
┌─────────────────────────────────────────┐
│  Issue Materials to Contractor          │
├─────────────────────────────────────────┤
│  Contractor: [ABC Contractors ▼]        │
│  Month: [January 2025 ▼]               │
│                                         │
│  Materials:                             │
│  ┌───────────────────────────────────┐ │
│  │ ONT Device    Qty: [50] nos      │ │
│  │ Fiber Cable   Qty: [1000] m      │ │
│  │ STB Box       Qty: [30] nos      │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Cancel]  [Issue Materials]           │
└─────────────────────────────────────────┘
```

### **2. SOD Completion with Materials**

```
┌─────────────────────────────────────────┐
│  Complete SOD #12345                    │
├─────────────────────────────────────────┤
│  Contractor: ABC Contractors            │
│  Team: Team Alpha                       │
│  ONT Serial: [__________]               │
│                                         │
│  Materials Used:                        │
│  ┌───────────────────────────────────┐ │
│  │ ☑ ONT Device      1 nos          │ │
│  │ ☑ Fiber Cable    50 m            │ │
│  │ ☑ STB Box         1 nos          │ │
│  │ ☑ Connectors      4 nos          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Wastage (if any):                      │
│  ┌───────────────────────────────────┐ │
│  │ Fiber Cable: [5] m               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Cancel]  [Complete SOD]              │
└─────────────────────────────────────────┘
```

### **3. Monthly Balance Sheet View**

```
┌─────────────────────────────────────────────────────────────┐
│  Material Balance Sheet - ABC Contractors                   │
│  Month: January 2025  |  Store: Kaduwela Store             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Item         │Open│Recv│Used│Wast│Close│Required Next││ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ ONT Device   │ 10 │ 50 │ 45 │  2 │ 13  │    40       ││ │
│  │ Fiber Cable  │500m│1km │800m│50m │650m │   500m      ││ │
│  │ STB Box      │  5 │ 30 │ 28 │  1 │  6  │    25       ││ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Summary:                                                    │
│  • Total Value: LKR 250,000                                 │
│  • Usage Rate: 85%                                          │
│  • Wastage Rate: 5%                                         │
│                                                              │
│  [Download PDF]  [Generate Next Month]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 Automation Logic

### **Auto-Calculate Balance Sheet:**

```typescript
async function generateMonthlyBalanceSheet(
  contractorId: string,
  storeId: string,
  month: string // "2025-01"
) {
  // 1. Get previous month's closing balance
  const prevMonth = getPreviousMonth(month);
  const prevSheet = await prisma.contractorMaterialBalanceSheet.findUnique({
    where: {
      contractorId_storeId_month: {
        contractorId,
        storeId,
        month: prevMonth
      }
    },
    include: { items: true }
  });

  // 2. Get materials issued this month
  const issued = await prisma.contractorMaterialIssue.findMany({
    where: {
      contractorId,
      storeId,
      month
    },
    include: { items: true }
  });

  // 3. Get materials used in SODs this month
  const used = await prisma.sODMaterialUsage.findMany({
    where: {
      serviceOrder: {
        contractorId,
        completedDate: {
          gte: new Date(`${month}-01`),
          lt: new Date(getNextMonth(month) + `-01`)
        }
      },
      usageType: "USED"
    }
  });

  // 4. Get wastage this month
  const wastage = await prisma.sODMaterialUsage.findMany({
    where: {
      serviceOrder: {
        contractorId,
        completedDate: {
          gte: new Date(`${month}-01`),
          lt: new Date(getNextMonth(month) + `-01`)
        }
      },
      usageType: "WASTAGE"
    }
  });

  // 5. Calculate for each item
  const items = [];
  for (const item of allItems) {
    const opening = prevSheet?.items.find(i => i.itemId === item.id)?.closingBalance || 0;
    const received = sumQuantity(issued, item.id);
    const usedQty = sumQuantity(used, item.id);
    const wastageQty = sumQuantity(wastage, item.id);
    const closing = opening + received - usedQty - wastageQty;
    const requiredNext = estimateRequirement(usedQty); // Based on usage pattern

    items.push({
      itemId: item.id,
      openingBalance: opening,
      received,
      used: usedQty,
      wastage: wastageQty,
      closingBalance: closing,
      requiredNext
    });
  }

  // 6. Create balance sheet
  await prisma.contractorMaterialBalanceSheet.create({
    data: {
      contractorId,
      storeId,
      month,
      items: {
        create: items
      },
      totalValue: calculateTotalValue(items),
      usageRate: calculateUsageRate(items),
      wastageRate: calculateWastageRate(items)
    }
  });
}
```

---

## 📝 Implementation Steps

### **Phase 1: Database Schema** (1-2 hours)
1. Add new models to schema.prisma
2. Run migrations
3. Test relationships

### **Phase 2: Material Issue System** (2-3 hours)
1. Create material issue API
2. Create material issue UI (Store Manager)
3. Track issued materials

### **Phase 3: SOD Material Tracking** (2-3 hours)
1. Update SOD completion modal
2. Add material usage fields
3. Track usage and wastage
4. Save to database

### **Phase 4: Balance Sheet Generation** (3-4 hours)
1. Create auto-generation logic
2. Create balance sheet API
3. Create balance sheet UI
4. Add PDF export

### **Phase 5: Reports & Analytics** (2-3 hours)
1. Monthly reports
2. Usage trends
3. Wastage analysis
4. Cost tracking

**Total Estimated Time: 10-15 hours**

---

## ❓ Questions & Clarifications

### **Q1: Material Standard per SOD Type?**
**Question:** එක් SOD එකක් complete කරන්න standard materials තියෙනවාද?

**Example:**
- VOICE_INT package = 1 ONT + 50m Fiber + 4 Connectors
- VOICE_IPTV package = 1 ONT + 1 STB + 50m Fiber + 6 Connectors

**Answer Needed:** Auto-populate කරන්නද නැත්නම් manual enter කරන්නද?

### **Q2: Wastage Approval?**
**Question:** Wastage එකක් report කරන විට approval එකක් ඕනේද?

**Options:**
- Auto-accept (trust contractor)
- Store Manager approval
- Threshold-based (>5% needs approval)

### **Q3: Material Return?**
**Question:** Contractor හට materials return කරන්න පුළුවන්ද?

**Example:** Month end එකේ excess materials store එකට return කරනවා.

### **Q4: Multiple Stores per Contractor?**
**Question:** Contractor එකක් stores කීපයකින් materials ගන්නවාද?

**Current:** Team → Multiple Stores
**Question:** Each store separate balance sheet එකක්ද?

---

## 🎯 Next Steps

1. **Clarify Questions** above
2. **Update Database Schema**
3. **Implement Material Issue System**
4. **Update SOD Completion**
5. **Create Balance Sheet Auto-Generation**
6. **Build Reports**

---

**Status:** Design Complete, Ready for Implementation
**Estimated Time:** 10-15 hours
**Priority:** High (Core Business Logic)
