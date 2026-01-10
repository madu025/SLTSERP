# Contractor Material Balance Sheet Implementation Plan

## Overview
Implement a system to track contractor material balances when materials are added to SODs and provide a balance sheet view.

## Database Schema (Already Exists)
✅ `SODMaterialUsage` - Tracks materials used in each SOD
✅ `ContractorMaterialBalanceSheet` - Monthly balance sheet per contractor/store
✅ `ContractorBalanceSheetItem` - Individual item balances

## Implementation Steps

### 1. Backend API Endpoints

#### A. Generate Balance Sheet API
**Endpoint:** `POST /api/contractors/balance-sheet/generate`
- Generate balance sheet for a contractor for a specific month
- Calculate:
  - Opening balance (from previous month's closing)
  - Received (from material issues)
  - Used (from SOD material usage)
  - Wastage (from SOD material usage where usageType='WASTAGE')
  - Returned (from material returns)
  - Closing balance = Opening + Received - Used - Wastage - Returned

#### B. Get Balance Sheet API
**Endpoint:** `GET /api/contractors/balance-sheet?contractorId=xxx&month=2025-01`
- Retrieve existing balance sheet
- If not exists, auto-generate

#### C. Update SOD Material Usage
**Current:** Material usage is saved when completing SOD
**Enhancement:** Ensure contractor balance is updated when:
- SOD is completed with material usage
- Material usage is edited
- SOD is deleted/reverted

### 2. Frontend Components

#### A. Balance Sheet Page
**Location:** `/contractors/balance-sheet`
**Features:**
- Contractor selector
- Month selector
- Generate button
- Table showing:
  - Item name/code
  - Opening balance
  - Received
  - Used
  - Wastage
  - Returned
  - Closing balance
- Export to PDF/Excel

#### B. Integration with DatePickerModal
**Current:** Material usage is entered in extended view
**Enhancement:** 
- When material usage is saved, it should:
  1. Create SODMaterialUsage records
  2. Update contractor's material balance (if balance sheet exists for current month)
  3. Show warning if contractor balance is insufficient

### 3. Business Logic

#### Material Deduction Flow:
1. Contractor receives materials (Material Issue) → Increases balance
2. SOD is completed with material usage → Decreases balance
3. Contractor returns materials → Decreases balance
4. Balance sheet is generated monthly to track all movements

#### Balance Calculation:
```
Closing Balance = Opening Balance + Received - Used - Wastage - Returned
```

## Files to Create/Modify

### New Files:
1. `/src/app/api/contractors/balance-sheet/route.ts` - GET balance sheets
2. `/src/app/api/contractors/balance-sheet/generate/route.ts` - Generate balance sheet
3. `/src/app/contractors/balance-sheet/page.tsx` - Balance sheet UI

### Files to Modify:
1. `/src/app/api/service-orders/route.ts` - Update PATCH to handle material balance
2. `/src/components/modals/DatePickerModal.tsx` - Already handles material usage

## Priority Tasks
1. ✅ Verify schema (DONE - schema exists)
2. Create balance sheet generation API
3. Create balance sheet view API
4. Create balance sheet UI page
5. Test material flow from SOD → Balance Sheet

## Notes
- Balance sheets should be generated monthly
- Auto-generate on first access if not exists
- Consider adding a cron job to auto-generate at month-end
- Add validation to prevent negative balances
- Add audit trail for balance changes
