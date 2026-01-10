# Material Balance & Inventory Flow - Explanation

## 🔄 **Current System vs What Should Happen**

### **Current Implementation:**

```
1. Store Issues Materials to Contractor
   ✅ ContractorMaterialIssue record created
   ❌ Store inventory NOT deducted

2. Contractor Uses Materials in SOD
   ✅ SODMaterialUsage record created
   ✅ Contractor balance decreases (in balance sheet)
   ❌ Store inventory NOT updated

3. Contractor Returns Materials
   ✅ ContractorMaterialReturn record created
   ❌ Store inventory NOT increased
```

### **What SHOULD Happen:**

```
1. Store Issues Materials to Contractor
   ✅ ContractorMaterialIssue record created
   ✅ Store inventory DEDUCTED (InventoryStock)
   ✅ Contractor balance INCREASED

2. Contractor Uses Materials in SOD
   ✅ SODMaterialUsage record created
   ✅ Contractor balance DECREASED
   ❌ Store inventory stays same (material already with contractor)

3. Contractor Returns Materials
   ✅ ContractorMaterialReturn record created
   ✅ Store inventory INCREASED (back to store)
   ✅ Contractor balance DECREASED
```

## 📊 **Balance Sheet Explanation**

### **Contractor Balance Sheet Shows:**

| Column | Meaning |
|--------|---------|
| Opening Balance | Materials contractor had at start of month |
| Received | Materials issued FROM store TO contractor |
| Used | Materials used in SODs (consumed) |
| Wastage | Materials wasted during installation |
| Returned | Materials returned FROM contractor TO store |
| Closing Balance | Materials contractor has at end of month |

**Formula:**
```
Closing = Opening + Received - Used - Wastage - Returned
```

### **Store Inventory Shows:**

| Column | Meaning |
|--------|---------|
| Current Stock | Materials currently in store |
| Issued | Materials given to contractors (reduces stock) |
| Returned | Materials returned by contractors (increases stock) |
| GRN | Materials received from suppliers (increases stock) |
| MRN | Materials returned to suppliers (decreases stock) |

## 🔧 **What Needs to be Fixed:**

### **1. Material Issue API** (`/api/inventory/issue`)
**Current:** Only creates issue record
**Should:** Also deduct from store inventory

```typescript
// When issuing materials:
for (const item of items) {
    // Deduct from store stock
    await tx.inventoryStock.update({
        where: { storeId_itemId: { storeId, itemId: item.itemId } },
        data: { quantity: { decrement: item.quantity } }
    });
}
```

### **2. Material Return API** (`/api/inventory/returns`)
**Current:** Creates return record
**Should:** Also add back to store inventory

```typescript
// When returning materials:
for (const item of items) {
    // Add back to store stock
    await tx.inventoryStock.update({
        where: { storeId_itemId: { storeId, itemId: item.itemId } },
        data: { quantity: { increment: item.quantity } }
    });
}
```

### **3. SOD Material Usage**
**Current:** Creates usage record
**Already Correct:** Should NOT touch store inventory (material already with contractor)

## 🎯 **Summary:**

**Contractor Balance** = Materials with contractor
**Store Inventory** = Materials in store

When you issue materials:
- Store inventory ↓ (materials leave store)
- Contractor balance ↑ (contractor receives materials)

When contractor uses materials:
- Contractor balance ↓ (materials consumed)
- Store inventory = (no change, materials already gone)

When contractor returns materials:
- Contractor balance ↓ (materials leave contractor)
- Store inventory ↑ (materials back to store)

## ⚠️ **Current Issue:**

The balance sheet I created tracks contractor balances correctly, but store inventory is NOT being updated when materials are issued/returned. This needs to be fixed in the material issue and return APIs.

Would you like me to fix the material issue and return APIs to properly update store inventory?
