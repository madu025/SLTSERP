# Contractor, Team & Store Management - Complete Guide

## 🏗️ Current System Structure

### **1. Contractor Model**
```prisma
model Contractor {
  id                    String   @id @default(cuid())
  name                  String
  registrationNumber    String   @unique
  address               String?
  brNumber              String?
  status                ContractorStatus @default(PENDING)
  
  // Financial
  registrationFeePaid   Boolean  @default(false)
  agreementSigned       Boolean  @default(false)
  agreementDate         DateTime?
  bankAccountNumber     String?
  bankBranch            String?
  
  // Relations
  storeId               String?
  store                 InventoryStore? @relation(fields: [storeId], references: [id])
  teams                 TeamMember[]
  serviceOrders         ServiceOrder[]
  invoices              Invoice[]
}
```

### **2. Team Model**
```prisma
model TeamMember {
  id            String      @id @default(cuid())
  contractorId  String
  contractor    Contractor  @relation(fields: [contractorId], references: [id])
  
  name          String      // Team name (e.g., "Team Alpha")
  opmcId        String?
  opmc          OPMC?       @relation(fields: [opmcId], references: [id])
  
  members       Json?       // Array of team member details
}
```

### **3. OPMC Model**
```prisma
model OPMC {
  id              String   @id @default(cuid())
  name            String
  code            String   @unique
  area            String
  rtom            String?
  
  // Relations
  storeId         String?  @unique
  store           InventoryStore? @relation(fields: [storeId], references: [id])
  contractorTeams TeamMember[]
  serviceOrders   ServiceOrder[]
}
```

### **4. Inventory Store Model**
```prisma
model InventoryStore {
  id          String   @id @default(cuid())
  name        String
  type        StoreType // MAIN, BRANCH, CONTRACTOR
  location    String?
  
  // Relations
  managerId   String?  @unique
  manager     User?    @relation(fields: [managerId], references: [id])
  
  contractors Contractor[]
  opmcs       OPMC[]
  stock       InventoryStock[]
  requests    StockRequest[]
  grns        GRN[]
  transactions InventoryTransaction[]
}
```

---

## 🔄 Current Workflow

### **Scenario 1: Contractor with Multiple Teams**

**Example:**
```
ABC Contractors (Contractor)
  ├── Team Alpha → OPMC Colombo (Store: Colombo Main)
  ├── Team Beta  → OPMC Kandy (Store: Kandy Main)
  └── Team Gamma → OPMC Galle (Store: Galle Main)
```

**How it works:**
1. Contractor registers
2. Admin creates teams for the contractor
3. Each team is assigned to an OPMC
4. Each OPMC has its own main store
5. When team completes SOD, materials are issued from that OPMC's store

---

## ❓ Issues & Questions

### **Issue 1: OPMC with Multiple Store Branches**

**Current:** Each OPMC has ONE main store
**Requirement:** OPMC may need multiple store branches

**Example:**
```
OPMC Colombo
  ├── Store Branch 1 (Colombo East)
  ├── Store Branch 2 (Colombo West)
  └── Store Branch 3 (Colombo Central)
```

**Solution Needed:**
- Allow OPMC to have multiple stores
- Team should specify which store branch they use
- Materials issued from specific branch

---

### **Issue 2: Team Working in Non-Assigned OPMC Area**

**Scenario:**
```
Team Alpha (assigned to OPMC Colombo)
  └── Temporarily working in OPMC Kandy area
```

**Current Problem:**
- Team can only work in assigned OPMC
- Cannot complete SODs in other areas

**Possible Solutions:**

**Option A: Flexible Team Assignment**
- Allow team to work in multiple OPMCs
- Change `opmcId` from single to array
```prisma
model TeamMember {
  // Current
  opmcId  String?
  
  // Proposed
  opmcIds String[] // Multiple OPMCs
}
```

**Option B: Temporary Assignment**
- Add temporary OPMC assignment
```prisma
model TeamMember {
  primaryOpmcId   String?  // Main OPMC
  tempOpmcId      String?  // Temporary OPMC
  tempStartDate   DateTime?
  tempEndDate     DateTime?
}
```

**Option C: Per-SOD Assignment**
- Don't assign team to OPMC
- Assign per service order completion
```prisma
model ServiceOrder {
  contractorId  String?
  teamId        String?
  completedAt   DateTime?
  // Team can complete any SOD regardless of OPMC
}
```

---

### **Issue 3: Materials Issue from Store Branches**

**Current Flow:**
```
1. Team completes SOD
2. Materials issued from OPMC's main store
3. No branch selection
```

**Required Flow:**
```
1. Team completes SOD in OPMC area
2. Select which store branch to issue materials from
3. Materials deducted from that specific branch
4. Track which branch issued materials
```

**Implementation:**

**Step 1: Update Schema**
```prisma
model OPMC {
  id              String   @id
  name            String
  
  // Remove single store
  // storeId      String?  @unique
  // store        InventoryStore?
  
  // Add multiple stores
  stores          InventoryStore[]
}

model InventoryStore {
  id          String   @id
  name        String
  type        StoreType // MAIN, BRANCH
  
  // Add OPMC relation
  opmcId      String?
  opmc        OPMC?    @relation(fields: [opmcId], references: [id])
}

model ServiceOrder {
  // Add store branch tracking
  issuedFromStoreId  String?
  issuedFromStore    InventoryStore? @relation(fields: [issuedFromStoreId], references: [id])
}
```

**Step 2: Update Completion Modal**
```typescript
// When completing SOD
{
  contractor: "ABC Contractors",
  team: "Team Alpha",
  opmc: "OPMC Colombo",
  storeBranch: "Colombo East Branch", // NEW
  materials: [...]
}
```

---

## 🎯 Recommended Solution

### **Phase 1: Current System (Already Implemented)**
✅ Contractor → Multiple Teams
✅ Team → Single OPMC
✅ OPMC → Single Store
✅ Materials issued from OPMC store

### **Phase 2: Enhanced System (Recommended)**

**Changes:**
1. **OPMC Multiple Stores:**
   ```prisma
   OPMC
     └── stores[] (multiple branches)
   ```

2. **Flexible Team Assignment:**
   ```prisma
   TeamMember
     ├── primaryOpmcId (main area)
     └── Can complete SODs in any OPMC
   ```

3. **Store Branch Selection:**
   ```typescript
   // On SOD completion
   - Select contractor
   - Select team
   - Select store branch (from OPMC's stores)
   - Materials issued from selected branch
   ```

4. **Material Tracking:**
   ```prisma
   ServiceOrder
     ├── contractorId
     ├── teamId
     └── issuedFromStoreId (which branch)
   ```

---

## 📊 Database Schema Changes Needed

### **Option 1: Simple (Recommended for Now)**
```prisma
// Keep current structure
// Add flexibility in completion
model ServiceOrder {
  contractorId       String?
  teamId             String?
  // Team can complete any SOD
  // Materials issued from SOD's OPMC store
}
```

### **Option 2: Full Featured**
```prisma
// OPMC can have multiple stores
model OPMC {
  stores  InventoryStore[]
}

model InventoryStore {
  opmcId  String?
  opmc    OPMC? @relation(fields: [opmcId], references: [id])
}

// Track which store issued materials
model ServiceOrder {
  issuedFromStoreId  String?
  issuedFromStore    InventoryStore?
}

// Team can work in multiple areas
model TeamMember {
  primaryOpmcId   String?
  allowedOpmcIds  String[] // Can work in these OPMCs
}
```

---

## 🚀 Implementation Steps

### **Immediate (Already Done):**
✅ Contractor registration
✅ Team creation with OPMC assignment
✅ Team selection on SOD completion
✅ Basic material tracking

### **Next Steps (If Needed):**

**Step 1: OPMC Multiple Stores**
1. Update schema to allow OPMC → stores[]
2. Update OPMC registration to add multiple stores
3. Update completion modal to select store branch

**Step 2: Flexible Team Assignment**
1. Allow team to complete SODs in any OPMC
2. Track which OPMC the SOD was completed in
3. Issue materials from that OPMC's store

**Step 3: Enhanced Tracking**
1. Track which store branch issued materials
2. Reports by store branch
3. Stock levels per branch

---

## 💡 Current Best Practice

**For Now (Without Schema Changes):**

1. **Contractor Registration:**
   - Register contractor
   - Assign to main store (optional)

2. **Team Creation:**
   - Create teams under contractor
   - Assign each team to primary OPMC
   - Team members list

3. **SOD Completion:**
   - Select contractor
   - Select team (from that contractor)
   - Complete SOD
   - Materials issued from SOD's OPMC store

4. **Flexibility:**
   - Team can complete SODs in any OPMC
   - Just select the team during completion
   - System tracks contractor + team + SOD OPMC

---

## 📝 Summary

### **Current System:**
- ✅ Works well for basic contractor management
- ✅ Teams assigned to OPMCs
- ✅ Materials tracked per OPMC

### **Limitations:**
- ❌ OPMC can only have one store
- ❌ No store branch selection
- ❌ Team locked to one OPMC (but can complete any SOD)

### **Recommendation:**
1. **Keep current system** for now
2. **Allow teams to complete any SOD** (already implemented)
3. **Future:** Add OPMC multiple stores when needed
4. **Future:** Add store branch selection on completion

---

**Status:** Current system is functional. Enhanced features can be added when business requirements are clearer.

**Next Discussion:** Do you need OPMC multiple stores immediately, or can we proceed with current structure?
