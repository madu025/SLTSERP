# SLTSERP Page Blueprint Template

## How to Use
1. Copy this template
2. Fill in ALL sections below
3. Paste it to the AI with: "Build this page from the blueprint"
4. AI will generate the complete page code following SLTSERP development standards

---

# PAGE BLUEPRINT: [Page Name]

## 1. OVERVIEW
- **Page Title:** (shown in browser tab & page header)
- **Route:** `/path/to/page`
- **Description:** (1-2 sentences — what does this page do?)
- **Who can access:** (roles: SUPER_ADMIN / ADMIN / STORES_MANAGER / etc.)

---

## 2. LAYOUT
- **Sidebar:** Yes (standard Sidebar + Header layout)
- **Page type:** List | Form | Dashboard | Detail | Report
- **Layout variant:**
  - [ ] Compact Table (dense data, Excel-style rows)
  - [ ] Card Grid (visual cards per item)
  - [ ] Single Form (create/edit one record)
  - [ ] Dashboard (stats + charts + summary)
  - [ ] Split View (list left + detail right)

---

## 3. DATA

### 3a. API Endpoints (what data does the page consume?)
| Method | URL | Purpose |
|--------|-----|---------|
| GET    | `/api/...` | Fetch list |
| POST   | `/api/...` | Create record |
| PUT    | `/api/...` | Update record |
| DELETE | `/api/...` | Delete record |

### 3b. Main Data Entity (fields to show in the table/card)
| Field Name | Display Label | Type | Notes |
|------------|--------------|------|-------|
| `id`       | —            | string | hidden |
| `name`     | Name         | string | bold, primary |
| `status`   | Status       | enum   | colored badge |
| ...        | ...          | ...    | ... |

### 3c. Status Values (if applicable)
| Value | Label | Color |
|-------|-------|-------|
| `ACTIVE` | Active | Green |
| `PENDING` | Pending | Amber |
| `REJECTED` | Rejected | Red |

---

## 4. TOOLBAR / FILTERS
- **Search:** Yes / No — searches on which fields?
- **Filter tabs:** (e.g., All / Active / Pending)
- **Date range filter:** Yes / No
- **Export button:** Yes / No
- **Primary action button:** (e.g., "+ Add New [Entity]")
- **Secondary action button:** (e.g., "Quick Invite")

---

## 5. TABLE / LIST COLUMNS (for table layout)
| # | Column Header | Field | Width | Notes |
|---|--------------|-------|-------|-------|
| 1 | Name | `name` | auto | bold |
| 2 | Code | `registrationNumber` | 120px | mono font |
| 3 | Status | `status` | 100px | badge |
| 4 | Actions | — | 120px | icon buttons |

---

## 6. ROW ACTIONS (what can user do per row?)
- [ ] View / Open detail
- [ ] Edit (opens form dialog)
- [ ] Delete (confirm dialog)
- [ ] Approve
- [ ] Reject
- [ ] Custom: _______________

---

## 7. FORM DIALOG (if page has a create/edit form)
- **Dialog type:** Single step / Multi-step wizard
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | text | Yes | |
| Status | select | Yes | values: ACTIVE, PENDING |
| ... | ... | ... | ... |

---

## 8. SUMMARY STATS (optional — top stat cards)
| Label | Value source | Color |
|-------|-------------|-------|
| Total Contractors | `contractors.length` | Blue |
| Active | `status === ACTIVE` | Green |
| Pending Approval | `status === PENDING` | Amber |

---

## 9. EMPTY STATE
- **Icon:** (e.g., Building2, Package, Users)
- **Title:** "No [entity] found"
- **Subtitle:** "Click [button] to add your first [entity]"

---

## 10. SPECIAL REQUIREMENTS / NOTES
- (Any extra business logic, validations, or edge cases)
- Example: "Only ADMIN can approve. STORES_MANAGER can only view."
- Example: "Pagination: 50 per page, server-side"
- Example: "Show warning if stock < 10"

---

## EXAMPLE (filled in):

```
# PAGE BLUEPRINT: Inventory Items

## 1. OVERVIEW
- Page Title: Material Registry
- Route: /inventory/items
- Description: View and manage all registered inventory materials/items
- Who can access: SUPER_ADMIN, ADMIN, STORES_MANAGER

## 2. LAYOUT
- Page type: List
- Layout variant: [x] Compact Table

## 3. DATA
| GET | /api/inventory/items | Fetch all items |
| POST | /api/inventory/items | Create new item |

Main fields: id, code, name, unit, category, status, stockQuantity

## 4. TOOLBAR
- Search: Yes (name, code)
- Filter: All / Active / Low Stock
- Primary: "+ Add Item"

## 5. TABLE COLUMNS
1. Code (mono, 100px)
2. Name (bold, auto)
3. Unit (80px)
4. Category (tag, 120px)
5. Stock Qty (right-align, 80px)
6. Status (badge, 100px)
7. Actions (80px): Edit, Delete

## 6. ROW ACTIONS: Edit, Delete

## 7. FORM: Single step
Fields: code (text), name (text), unit (select), category (select), status (select)

## 8. STATS: Total Items | Active | Low Stock

## 9. EMPTY STATE: Package icon, "No items registered yet"
```
