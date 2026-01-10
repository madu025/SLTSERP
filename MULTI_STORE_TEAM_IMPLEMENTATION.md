# Contractor Registration - Multi-Store Team Assignment

## ✅ Database Schema Updated

### **New Structure:**

```prisma
ContractorTeam {
  id
  name
  contractorId
  storeAssignments[]  // Multiple stores
  opmcId              // Primary OPMC (optional)
  members[]
}

TeamStoreAssignment {
  id
  teamId
  storeId
  isPrimary           // Mark primary store
}

InventoryStore {
  id
  name
  teamAssignments[]
  opmcs[]
}
```

---

## 🎯 Contractor Registration Page Updates Needed

### **Current Flow:**
1. Register contractor basic info
2. Add teams with single OPMC
3. Add team members

### **New Flow:**
1. Register contractor basic info
2. Add teams with **multiple stores**
3. Select primary store
4. Add team members

---

## 📝 UI Changes Required

### **1. Team Creation Section:**

**Current:**
```tsx
<Select>
  <SelectLabel>Primary OPMC</SelectLabel>
  <SelectItem>OPMC Colombo</SelectItem>
  <SelectItem>OPMC Kandy</SelectItem>
</Select>
```

**New:**
```tsx
// Multi-select for stores
<div>
  <Label>Assigned Stores *</Label>
  <MultiSelect
    options={stores}
    value={selectedStores}
    onChange={setSelectedStores}
  />
</div>

// Primary store selection
<div>
  <Label>Primary Store *</Label>
  <Select value={primaryStore}>
    {selectedStores.map(store => (
      <SelectItem value={store.id}>{store.name}</SelectItem>
    ))}
  </Select>
</div>

// Optional: Primary OPMC
<div>
  <Label>Primary OPMC (Optional)</Label>
  <Select>
    {/* Show OPMCs from selected stores */}
  </Select>
</div>
```

---

## 🔧 API Changes Required

### **1. Create Team API (`POST /api/contractors`)**

**Current Request:**
```json
{
  "teams": [
    {
      "name": "Team Alpha",
      "opmcId": "opmc123",
      "members": [...]
    }
  ]
}
```

**New Request:**
```json
{
  "teams": [
    {
      "name": "Team Alpha",
      "storeIds": ["store1", "store2", "store3"],
      "primaryStoreId": "store1",
      "opmcId": "opmc123",  // optional
      "members": [...]
    }
  ]
}
```

**Backend Logic:**
```typescript
// For each team
const team = await prisma.contractorTeam.create({
  data: {
    name: teamData.name,
    contractorId: contractor.id,
    opmcId: teamData.opmcId,
    storeAssignments: {
      create: teamData.storeIds.map(storeId => ({
        storeId,
        isPrimary: storeId === teamData.primaryStoreId
      }))
    }
  }
});
```

---

## 📊 Display Changes

### **1. Contractor List/Detail View:**

**Show team stores:**
```tsx
<div>
  <h4>Team Alpha</h4>
  <div>
    <Badge variant="primary">Kaduwela Store (Primary)</Badge>
    <Badge>Homagama Store</Badge>
    <Badge>Gampaha Store</Badge>
  </div>
  <p>Can work in OPMCs: 1,2,3,4,5,6,7,8,9,10</p>
</div>
```

---

## 🎯 SOD Completion Validation

### **When completing SOD:**

```typescript
// Get selected team
const team = await prisma.contractorTeam.findUnique({
  where: { id: teamId },
  include: {
    storeAssignments: {
      include: {
        store: {
          include: {
            opmcs: true
          }
        }
      }
    }
  }
});

// Get all allowed OPMCs for this team
const allowedOpmcs = team.storeAssignments.flatMap(
  assignment => assignment.store.opmcs
);

// Check if SOD's OPMC is in allowed list
const sodOpmc = serviceOrder.opmcId;
const isAllowed = allowedOpmcs.some(opmc => opmc.id === sodOpmc);

if (!isAllowed) {
  throw new Error("Team cannot complete SODs in this OPMC area");
}
```

---

## 📝 Implementation Steps

### **Phase 1: Backend API** ✅ (Schema Done)

1. ✅ Update Prisma schema
2. ⏳ Update contractor creation API
3. ⏳ Update team creation logic
4. ⏳ Add validation for team-store assignments

### **Phase 2: Frontend UI**

1. ⏳ Add multi-select component for stores
2. ⏳ Update team creation form
3. ⏳ Add primary store selection
4. ⏳ Update team display to show multiple stores
5. ⏳ Update contractor detail view

### **Phase 3: SOD Completion**

1. ⏳ Add validation when selecting team
2. ⏳ Show allowed OPMCs for selected team
3. ⏳ Prevent completion in non-allowed OPMCs

---

## 🚀 Quick Implementation Guide

### **Step 1: Install Multi-Select Component**

```bash
npm install react-multi-select-component
# or use shadcn multi-select
```

### **Step 2: Update Contractor Registration Page**

File: `src/app/admin/contractors/page.tsx`

Add multi-select for stores in team creation section.

### **Step 3: Update API**

File: `src/app/api/contractors/route.ts`

Update team creation logic to handle multiple stores.

### **Step 4: Test**

1. Create contractor
2. Add team with multiple stores
3. Mark one as primary
4. Verify team can complete SODs in all assigned store OPMCs

---

## 💡 Example Workflow

### **Scenario:**

**Create Contractor:**
- Name: ABC Contractors

**Add Team:**
- Name: Team Beta
- Stores:
  - ✅ Kaduwela Store (Primary)
  - ✅ Homagama Store
- Primary OPMC: OPMC 5

**Result:**
- Team Beta can work in:
  - Kaduwela Store OPMCs: 1,2,3,4,5,6,7
  - Homagama Store OPMCs: 8,9,10

**SOD Completion:**
- SOD in OPMC 5: ✅ Allowed
- SOD in OPMC 8: ✅ Allowed
- SOD in OPMC 15: ❌ Not allowed (different store)

---

## 📋 Summary

**Current Status:**
- ✅ Database schema updated
- ✅ TeamStoreAssignment junction table created
- ⏳ UI needs refactoring
- ⏳ API needs updating

**Next Steps:**
1. Refactor contractor registration page
2. Add multi-store selection UI
3. Update API to handle multiple stores
4. Add validation in SOD completion

**Estimated Time:** 2-3 hours

---

**Ready to implement?** Let me know if you want me to start with the UI refactoring! 🚀
