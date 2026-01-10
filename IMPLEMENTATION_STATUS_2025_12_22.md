# Multi-Store Team Management - Implementation Status

## ✅ Completed (2025-12-22)

### **1. Database Schema**
- ✅ `TeamStoreAssignment` junction table created
- ✅ `ContractorTeam.storeAssignments` relation added
- ✅ `InventoryStore.teamAssignments` relation added
- ✅ `isPrimary` flag for primary store marking
- ✅ Database pushed successfully

### **2. Completion Modal Updates**
- ✅ Voice Number display added
- ✅ Contractor selection added
- ✅ Team selection with dynamic teams
- ✅ `contractorId` and `teamId` saved on completion
- ✅ Validation for contractor and team selection

### **3. Pending SOD Table**
- ✅ Contractor column removed from pending table
- ✅ Contractor selection moved to completion modal only

---

## ⏳ In Progress / To Do

### **Phase 1: API Development**

#### **1.1 Team Store Assignment API**
**File:** `src/app/api/contractors/teams/[teamId]/stores/route.ts`

```typescript
// GET - Get team's assigned stores
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  const team = await prisma.contractorTeam.findUnique({
    where: { id: params.teamId },
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
  
  return NextResponse.json(team);
}

// POST - Add store to team
export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  const { storeId, isPrimary } = await request.json();
  
  // Check user role
  const session = await getServerSession();
  if (!['STORES_MANAGER', 'STORES_ASSISTANT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // If isPrimary, unset other primary stores
  if (isPrimary) {
    await prisma.teamStoreAssignment.updateMany({
      where: { teamId: params.teamId },
      data: { isPrimary: false }
    });
  }
  
  const assignment = await prisma.teamStoreAssignment.create({
    data: {
      teamId: params.teamId,
      storeId,
      isPrimary
    }
  });
  
  return NextResponse.json(assignment);
}

// DELETE - Remove store from team
export async function DELETE(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  const { storeId } = await request.json();
  
  // Check user role
  const session = await getServerSession();
  if (!['STORES_MANAGER', 'STORES_ASSISTANT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  await prisma.teamStoreAssignment.deleteMany({
    where: {
      teamId: params.teamId,
      storeId
    }
  });
  
  return NextResponse.json({ success: true });
}
```

#### **1.2 Update Contractor Creation API**
**File:** `src/app/api/contractors/route.ts`

Update team creation to handle multiple stores:

```typescript
// In POST handler
for (const teamData of teams) {
  const team = await tx.contractorTeam.create({
    data: {
      name: teamData.name,
      contractorId: contractor.id,
      opmcId: teamData.opmcId,
      storeAssignments: {
        create: teamData.storeIds?.map((storeId: string) => ({
          storeId,
          isPrimary: storeId === teamData.primaryStoreId
        })) || []
      },
      members: {
        create: teamData.members?.map((member: any) => ({
          name: member.name,
          idCopyNumber: member.idCopyNumber,
          contractorIdCopyNumber: member.contractorIdCopyNumber,
          contractorId: contractor.id
        })) || []
      }
    }
  });
}
```

---

### **Phase 2: UI Components**

#### **2.1 Team Store Management Component**
**File:** `src/components/contractors/TeamStoreManager.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Star } from "lucide-react";

interface TeamStoreManagerProps {
  teamId: string;
  currentStores: Array<{
    id: string;
    storeId: string;
    isPrimary: boolean;
    store: {
      id: string;
      name: string;
      opmcs: Array<{ id: string; name: string }>;
    };
  }>;
  availableStores: Array<{
    id: string;
    name: string;
  }>;
  userRole: string;
}

export function TeamStoreManager({
  teamId,
  currentStores,
  availableStores,
  userRole
}: TeamStoreManagerProps) {
  const [selectedStore, setSelectedStore] = useState("");
  const canEdit = ['STORES_MANAGER', 'STORES_ASSISTANT'].includes(userRole);

  const handleAddStore = async () => {
    if (!selectedStore) return;
    
    await fetch(`/api/contractors/teams/${teamId}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: selectedStore,
        isPrimary: currentStores.length === 0
      })
    });
    
    // Refresh
    window.location.reload();
  };

  const handleRemoveStore = async (storeId: string) => {
    await fetch(`/api/contractors/teams/${teamId}/stores`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId })
    });
    
    // Refresh
    window.location.reload();
  };

  const handleSetPrimary = async (storeId: string) => {
    // Remove old primary
    await fetch(`/api/contractors/teams/${teamId}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        isPrimary: true
      })
    });
    
    // Refresh
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold mb-2">Assigned Stores</h4>
        <div className="space-y-2">
          {currentStores.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-2">
                {assignment.isPrimary && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
                <div>
                  <p className="font-medium">{assignment.store.name}</p>
                  <p className="text-xs text-slate-500">
                    OPMCs: {assignment.store.opmcs.map(o => o.name).join(', ')}
                  </p>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  {!assignment.isPrimary && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetPrimary(assignment.storeId)}
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemoveStore(assignment.storeId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select store to add..." />
            </SelectTrigger>
            <SelectContent>
              {availableStores
                .filter(s => !currentStores.some(cs => cs.storeId === s.id))
                .map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddStore}>
            <Plus className="w-4 h-4 mr-2" />
            Add Store
          </Button>
        </div>
      )}
    </div>
  );
}
```

#### **2.2 Update Contractor Registration Page**
**File:** `src/app/admin/contractors/page.tsx`

Add store selection in team creation:

```typescript
// In team form
{teams.map((team, index) => (
  <div key={index} className="border p-4 rounded">
    <Input
      placeholder="Team Name"
      value={team.name}
      onChange={(e) => updateTeam(index, 'name', e.target.value)}
    />
    
    {/* Store Selection - Only for Stores Manager/Assistant */}
    {['STORES_MANAGER', 'STORES_ASSISTANT'].includes(user.role) && (
      <div className="mt-4">
        <Label>Assigned Stores</Label>
        <MultiSelect
          options={stores}
          value={team.storeIds || []}
          onChange={(selected) => updateTeam(index, 'storeIds', selected)}
        />
        
        {team.storeIds?.length > 0 && (
          <div className="mt-2">
            <Label>Primary Store</Label>
            <Select
              value={team.primaryStoreId}
              onValueChange={(val) => updateTeam(index, 'primaryStoreId', val)}
            >
              {team.storeIds.map(storeId => {
                const store = stores.find(s => s.id === storeId);
                return (
                  <SelectItem key={storeId} value={storeId}>
                    {store?.name}
                  </SelectItem>
                );
              })}
            </Select>
          </div>
        )}
      </div>
    )}
    
    {/* Rest of team form... */}
  </div>
))}
```

---

### **Phase 3: SOD Completion Validation**

#### **3.1 Update Completion Modal**
**File:** `src/components/modals/DatePickerModal.tsx`

Already done - contractor and team selection implemented.

#### **3.2 Add OPMC Validation**
**File:** `src/app/api/service-orders/route.ts`

```typescript
// In PATCH handler (completion)
if (contractorId && teamId) {
  // Get team's allowed OPMCs
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
  
  // Get all allowed OPMC IDs
  const allowedOpmcIds = team.storeAssignments.flatMap(
    assignment => assignment.store.opmcs.map(opmc => opmc.id)
  );
  
  // Check if SOD's OPMC is allowed
  const serviceOrder = await prisma.serviceOrder.findUnique({
    where: { id },
    select: { opmcId: true }
  });
  
  if (!allowedOpmcIds.includes(serviceOrder.opmcId)) {
    return NextResponse.json(
      { error: 'Team cannot complete SODs in this OPMC area' },
      { status: 403 }
    );
  }
}
```

---

## 📋 Implementation Checklist

### **Backend:**
- [ ] Create team store assignment API endpoints
- [ ] Update contractor creation API
- [ ] Add role-based access control
- [ ] Add OPMC validation on SOD completion

### **Frontend:**
- [ ] Create TeamStoreManager component
- [ ] Update contractor registration page
- [ ] Add multi-select for stores
- [ ] Add role-based UI rendering
- [ ] Update contractor detail view

### **Testing:**
- [ ] Test team creation with multiple stores
- [ ] Test store assignment/removal
- [ ] Test primary store changing
- [ ] Test SOD completion validation
- [ ] Test role-based access

---

## 🎯 Current Status

**Completed:**
- ✅ Database schema
- ✅ Completion modal with contractor/team selection
- ✅ Pending table contractor column removed

**In Progress:**
- ⏳ API endpoints for team store management
- ⏳ UI components for store assignment
- ⏳ Role-based access control

**Estimated Completion Time:** 3-4 hours

---

## 🚀 Next Steps

1. Implement API endpoints
2. Create UI components
3. Add role-based access
4. Test complete workflow
5. Deploy and verify

---

**Status:** Ready for implementation
**Last Updated:** 2025-12-22 19:58
