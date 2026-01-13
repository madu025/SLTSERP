# SOD Revenue Configuration System

## Overview
This system allows administrators to configure revenue amounts per Service Order (SOD) based on RTOM and time periods. It supports circular-based revenue changes and provides a flexible configuration interface.

## Features

### 1. **Default Revenue**
- Base revenue: **Rs. 10,500** per SOD
- Applied to all RTOMs by default
- Can be updated from Admin Settings

### 2. **RTOM-Specific Revenue**
- Configure different revenue amounts for specific RTOMs
- Example: Colombo-01 = Rs. 12,555, Gampaha-01 = Rs. 11,200

### 3. **Time-Based Revenue (Circular Support)**
- Set revenue for specific time periods
- Example: "Rs. 12,555 from Jan-Jun 2026 as per Circular 2026/01"
- Automatically reverts to default/permanent rate after period ends

### 4. **Priority-Based Lookup**
Revenue is calculated in this order:
1. **RTOM-specific with date range** (highest priority)
2. **RTOM-specific permanent**
3. **Default rate** (fallback)

## Database Schema

```prisma
model SODRevenueConfig {
  id            String   @id @default(cuid())
  rtomId        String?  // null = Default for all RTOMs
  rtom          OPMC?    @relation(fields: [rtomId], references: [id])
  revenuePerSOD Float    // Rs. 10,500, Rs. 12,555, etc.
  effectiveFrom DateTime? // null = Always active
  effectiveTo   DateTime? // null = No end date
  circularRef   String?  // "Circular No. 2026/01"
  notes         String?
  isActive      Boolean  @default(true)
  createdBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## API Endpoints

### 1. Get All Configurations
```
GET /api/admin/sod-revenue
Authorization: SUPER_ADMIN, ADMIN, OSP_MANAGER
```

### 2. Create Configuration
```
POST /api/admin/sod-revenue
Authorization: SUPER_ADMIN, ADMIN
Body: {
  rtomId?: string,
  revenuePerSOD: number,
  effectiveFrom?: string,
  effectiveTo?: string,
  circularRef?: string,
  notes?: string
}
```

### 3. Update Configuration
```
PUT /api/admin/sod-revenue
Authorization: SUPER_ADMIN, ADMIN
Body: {
  id: string,
  revenuePerSOD?: number,
  effectiveFrom?: string,
  effectiveTo?: string,
  circularRef?: string,
  notes?: string,
  isActive?: boolean
}
```

### 4. Delete Configuration
```
DELETE /api/admin/sod-revenue?id={configId}
Authorization: SUPER_ADMIN, ADMIN
```

### 5. Calculate Revenue (Utility)
```
GET /api/admin/sod-revenue/calculate?rtomId={id}&date={YYYY-MM-DD}
Authorization: Any authenticated user
Returns: { revenue: 12555, rtomId, date }
```

## Admin UI

### Access
- **Path**: `/admin/sod-revenue`
- **Roles**: SUPER_ADMIN, ADMIN
- **Menu**: Administration → SOD Revenue Config

### Features
- View default revenue
- Create/Edit/Delete configurations
- RTOM selection dropdown
- Date range picker with toggle
- Circular reference field
- Active/Inactive status toggle
- Sortable table view

## Usage Examples

### Example 1: Simple Default
```
All RTOMs: Rs. 10,500 (permanent)
```

### Example 2: RTOM-Specific (Permanent)
```
Default: Rs. 10,500
Colombo-01: Rs. 12,000 (permanent)
Gampaha-01: Rs. 11,500 (permanent)
```

### Example 3: Circular-Based Change
```
Default: Rs. 10,500

Circular 2026/01 (Jan-Jun 2026):
  - Colombo-01: Rs. 12,555
  - Gampaha-01: Rs. 11,800

After June 2026:
  - Colombo-01: Back to Rs. 10,500 (default)
  - Gampaha-01: Back to Rs. 10,500 (default)
```

### Example 4: Mixed Configuration
```
Default: Rs. 10,500
Colombo-01: Rs. 12,000 (permanent)

Circular 2026/05 (Jul-Dec 2026):
  - Colombo-01: Rs. 12,555 (overrides permanent)
  
After Dec 2026:
  - Colombo-01: Back to Rs. 12,000 (permanent rate)
```

## Revenue Calculation Logic

```typescript
async function getRevenueForSOD(rtomId: string, completedDate: Date): Promise<number> {
  // 1. Check RTOM-specific with date range
  const rtomWithDate = await prisma.sODRevenueConfig.findFirst({
    where: {
      rtomId,
      effectiveFrom: { lte: completedDate },
      effectiveTo: { gte: completedDate },
      isActive: true
    }
  });
  if (rtomWithDate) return rtomWithDate.revenuePerSOD;
  
  // 2. Check RTOM-specific permanent
  const rtomPermanent = await prisma.sODRevenueConfig.findFirst({
    where: {
      rtomId,
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true
    }
  });
  if (rtomPermanent) return rtomPermanent.revenuePerSOD;
  
  // 3. Get default rate
  const defaultRate = await prisma.sODRevenueConfig.findFirst({
    where: { rtomId: null, isActive: true }
  });
  
  return defaultRate?.revenuePerSOD || 10500;
}
```

## Integration with Dashboard

The revenue calculation will be integrated into:
- **Dashboard Revenue Metrics**: Total revenue by RTOM
- **Contractor Performance**: Revenue per contractor
- **Monthly Reports**: Revenue breakdown by month
- **Invoice Generation**: Automatic revenue calculation

## Migration Steps

1. ✅ Database schema created (`SODRevenueConfig` model)
2. ✅ API endpoints implemented
3. ✅ Admin UI page created
4. ✅ Menu item added to sidebar
5. ✅ Default configuration seed script created
6. ⏳ Integration with dashboard (next phase)
7. ⏳ Integration with invoice generation (next phase)

## Next Steps

1. **Seed Default Configuration**:
   ```sql
   -- Run: prisma/seed-sod-revenue.sql
   ```

2. **Test Configuration**:
   - Create RTOM-specific rates
   - Test date range configurations
   - Verify priority logic

3. **Dashboard Integration**:
   - Update revenue calculation in dashboard
   - Add revenue metrics by RTOM
   - Show revenue trends

4. **Invoice Integration**:
   - Use revenue config in invoice generation
   - Display revenue breakdown in invoices

## Notes

- Revenue is calculated based on **PAT pass date** (not completion date)
- Inactive configurations are ignored in calculations
- Date ranges can overlap (most recent creation takes priority)
- Circular references are for documentation only (not enforced)

---

**Created**: 2026-01-13
**Version**: 1.0
**Status**: ✅ Implemented
