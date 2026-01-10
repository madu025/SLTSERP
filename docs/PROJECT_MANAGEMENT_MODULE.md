# Project Management Module Documentation

## 1. Overview
The Project Management Module in SLTSERP is designed to manage the full lifecycle of construction/engineering projects, from estimation (BOQ) to execution, material management, and financial tracking. It integrates closely with the Inventory system for real-time stock deductions and cost analysis.

## 2. Key Features

### 2.1 Project Administration
- **Create/Edit Projects**: Capture project details like Name, Code, Type (FTTH, UG, etc.), Location (Region/Province), and OPMC.
- **Team Assignment**: Assign Area Managers and Contractors to projects.
- **Status Tracking**: Track project status (PLANNED, IN_PROGRESS, COMPLETED, ON_HOLD) and overall progress percentage.

### 2.2 Bill of Quantities (BOQ)
- **Estimation**: Define required materials and services with estimated quantities and unit rates.
- **Budgeting**: Auto-calculates total estimated budget based on BOQ items.
- **Actuals Tracking**: Successfully tracks actual quantities used and costs incurred against the BOQ line items.
- **Categories**: Group items by Civil, Electrical, Material, Labor, etc.

### 2.3 Material Management (Inventory Integration)
The module features a robust **Approval-Based Workflow** for stock movement.

#### A. Material Issue (Store -> Project)
1.  **Request**: Authorized users request materials from a specific store via the "Issue Material" interface.
2.  **Status**: Created as `PENDING`. No stock is deducted yet.
3.  **Approval**: Store Managers/Admins approve the request.
4.  **Action**: 
    - Stock is deducted from the Inventory Store.
    - Project Actual Cost is updated.
    - Relevant BOQ Item's "Actual Quantity" is incremented (if linked).

#### B. Material Return (Project -> Store)
1.  **Request**: Unused materials are requested to be returned via the "Return Material" interface.
2.  **Status**: Created as `PENDING`.
3.  **Approval**: Store Managers approve the return.
4.  **Action**:
    - Stock is added back to the Inventory Store (if Condition is GOOD).
    - Project Actual Cost is credited (reduced).
    - BOQ Item "Actual Quantity" is decremented.

### 2.4 Financial Tracking
- **Budget vs Actual**: Real-time comparison of Approved Budget (BOQ) vs Actual Cost (Stock Issues + Expenses).
- **Expenses**: Track non-BOQ costs such as:
    - Labor Charges
    - Transport
    - Equipment Rental
    - Miscellaneous
- **Variance Analysis**: Visual indicators for over-budget projects.

### 2.5 Timeline & Milestones
- **Milestone Tracking**: Define key project phases (e.g., Foundation, Cabling, Testing).
- **Dates**: Track Target Date vs Completed Date.
- **Status**: Mark milestones as Pending, In Progress, Completed, or Delayed.

## 3. Database Schema Models

### `Project`
Core model linking all aspects.
- Fields: `name`, `projectCode`, `budget`, `actualCost`, `status`, `progress`.
- Relations: `contractor`, `areaManager`, `opmc`, `boqItems`, `stockIssues`, `projectReturns`.

### `ProjectBOQItem`
Line items for the bill of quantities.
- Fields: `itemCode`, `description`, `quantity` (Plan), `actualQuantity`, `unitRate`, `amount` (Plan), `actualCost`.
- Link: Optional link to `InventoryItem` (`materialId`).

### `StockIssue`
Records of material transfer requests.
- Fields: `issueNumber`, `status` (PENDING/APPROVED), `items` (JSON/Relation).
- Logic: Deducts stock upon approval.

### `ProjectMaterialReturn`
Records of material returns.
- Fields: `returnNumber`, `status`, `reason`, `items`.
- Logic: Restocks inventory upon approval.

### `ProjectMilestone` & `ProjectExpense`
Standard tracking models for time and detailed costs.

## 4. Workflows

### Creating a New Project
1. Navigate to **Projects** sidebar menu.
2. Click **Create New Project**.
3. Fill details (Name, Code, Contractor, etc.) and Save.

### Managing BOQ
1. Open Project Details.
2. Go to **BOQ & Material** tab.
3. Click **Add Item** to define budget lines.
4. Total Budget is updated automatically.

### Issuing Stock
1. Go to **Material Issues** tab.
2. Click **Issue Material**.
3. Select Source Store and Items.
4. Submit Request (Status: PENDING).
5. Admin clicks **Approve** to finalize transaction.

## 5. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET, POST | List all projects / Create new |
| `/api/projects/[id]` | GET | Get full project details |
| `/api/projects/boq` | POST, PATCH, DEL | Manage BOQ items |
| `/api/projects/stock-issue` | POST, GET | Create Issue Request / List Issues |
| `/api/projects/stock-issue/approve` | POST | Approve Issue (Deduct Stock) |
| `/api/projects/return` | POST, GET | Create Return Request / List Returns |
| `/api/projects/return/approve` | POST | Approve Return (Restock) |

## 6. Future Roadmap
- PDF Export for Project Reports.
- Service Order (SOD) direct linking.
- Mobile App interface for Site Supervisors.

---
*Documentation generated on 2026-01-07*
