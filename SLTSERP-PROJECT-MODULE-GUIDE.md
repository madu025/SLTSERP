# 🏗️ SLTS ERP - Project Module A-to-Z Tutorial Guide
## සම්පූර්ණ ව්‍යාපෘති කළමනාකරණ මාර්ගෝපදේශය | Complete Project Management Tutorial

---

**📌 මෙය අලුතෙන් එන කෙනෙකුට පවා ව්‍යාපෘතියක් create කරලා, එක එක stage වලදී මොනවා කරන්න ඕනද කියලා step-by-step ඉගෙන ගන්න පුළුවන් විදියට ලියා ඇත.**
*(This guide is written so that even a newcomer can learn how to create a project and know what to do at each stage, step by step.)*

---

## 📑 පටුන | Table of Contents

1. [Introduction - මේ Guide එක මොකක්ද?](#1-introduction)
2. [Understanding the Tab System - Tab system එක හඳුනා ගැනීම](#2-understanding-the-tab-system)
3. [Workflow Types & Stages - Workflow වර්ග සහ පියවර](#3-workflow-types--stages)
4. [Step 1: Project එකක් Create කරන හැටි](#4-step-1-project-එකක්-create-කරන-හැටි)
5. [Step 2: Project Details Page - Overview](#5-step-2-project-details-page---overview)
6. [Step 3: Always-Visible Tabs (Overview & Workflow Pipeline)](#6-step-3-always-visible-tabs)
7. [Stage-by-Stage: Survey & Feasibility Stage](#7-stage-by-stage-survey--feasibility-stage)
8. [Stage-by-Stage: Permit Acquisition Stage](#8-stage-by-stage-permit-acquisition-stage)
9. [Stage-by-Stage: Material Issuance Stage](#9-stage-by-stage-material-issuance-stage)
10. [Stage-by-Stage: Installation & Cabling Stage](#10-stage-by-stage-installation--cabling-stage)
11. [Stage-by-Stage: Testing & OTDR Stage](#11-stage-by-stage-testing--otdr-stage)
12. [Stage-by-Stage: QA/QC Inspection Stage](#12-stage-by-stage-qa-qc-inspection-stage)
13. [Stage-by-Stage: Handover & Closure Stage](#13-stage-by-stage-handover--closure-stage)
14. [Detailed Engineering Stage (Cluster workflow)](#14-detailed-engineering-stage-cluster-workflow)
15. [Complete Tab Reference - සියලුම Tab වල විස්තරය](#15-complete-tab-reference)
16. [Project Statuses - ව්‍යාපෘති තත්ත්වයන්](#16-project-statuses)
17. [Tips & Best Practices](#17-tips--best-practices)
18. [FAQ - නිතර අසන ප්‍රශ්න](#18-faq)

---

## 1. Introduction - මේ Guide එක මොකක්ද?

**SLTS ERP Project Module** එක කියන්නේ ඔබට **telecom construction projects** (OSP FTTH, Fiber Backbone, Cluster, Building Fiber වගේ) create කරලා, manage කරලා, complete කරන්න පුළුවන් සම්පූර්ණ system එකක්.

### 🔄 Project Lifecycle Flow එක මෙහෙමයි:

```
Create Project → Survey & Feasibility → Permits → Materials → Installation → Testing → QA/QC → Handover & Closure
```

### 🎯 මේ Guide එකෙන් ඔබට ඉගෙන ගන්න පුළුවන් දේවල්:

- ✅ **Project එකක් create කරන හැටි** - Step by step
- ✅ **Tab system එක** - මොන tab එකේ මොනවද කරන්නේ
- ✅ **Stage එක අනුව tabs** - වැඩේට අදාළ tabs විතරක් පෙන්වන විදිය
- ✅ **එක එක stage වලදී කරන්න ඕන දේවල්** - Survey ඉඳන් Handover දක්වා
- ✅ **Tab Reference** - Tab 28ම විස්තර කරලා

---

## 2. Understanding the Tab System - Tab System එක හඳුනා ගැනීම

### 🎯 Tab System එක Dynamic විදියට වැඩ කරන හැටි

මේ system එකේ **විශේෂත්වය** තමයි **Stage-based Dynamic Tab Visibility**.

- **Stage එක අනුව tabs auto-show/hide වෙනවා**
- Project එකේ **current stage** එකට අදාළ tabs විතරක් පෙන්නනවා
- ඔයාට **අදාළ නැති tabs** වලින් වැඩක් නැහැ - ඒවා hide වෙලා තියෙනවා

### 📌 Always-Visible Tabs (හැම වෙලේම පේන tabs)

මේ tabs **හැම stage එකකදීම පේනවා:**

| Tab | විස්තරය |
|-----|---------|
| **Overview** | Project එකේ summary, key metrics, progress |
| **Workflow Pipeline** | Stage-gate control, current stage, next stage buttons |

### 🔄 Stage-Based Tab Flow එක

```
Stage: Survey & Feasibility
  → Shows: Overview, Workflow Pipeline, Survey, GIS, Documents, Risks

Stage: Permit Acquisition
  → Shows: Overview, Workflow Pipeline, Permits, Documents, Approvals

Stage: Material Issuance
  → Shows: Overview, Workflow Pipeline, BOQ & Material, Material Issues, Procurement, Documents

Stage: Installation & Cabling
  → Shows: Overview, Workflow Pipeline, Tasks, Resources, Contractor, HSE, Field Tasks, Expenses

Stage: Testing & OTDR
  → Shows: Overview, Workflow Pipeline, OTDR, QA/QC, Documents

Stage: QA/QC Inspection
  → Shows: Overview, Workflow Pipeline, QA/QC, KPIs, Documents, Commissioning

Stage: Handover & Closure
  → Shows: Overview, Workflow Pipeline, Closure, Assets, Documents, Commissioning, KPIs, Finance
```

---

## 3. Workflow Types & Stages - Workflow වර්ග සහ පියවර

System එකේ **Project Types (Workflows)** 3ක් තියෙනවා:

### 🏗️ 1. SSD (Standard Service Delivery) - Stages 7ක්

| Stage | Purpose |
|-------|---------|
| 📋 Survey & Feasibility | Site survey, feasibility study |
| 📜 Permit Acquisition | Permits, wayleaves ගන්නවා |
| 📦 Material Issuance | BOQ, materials issue කරනවා |
| 🔧 Installation & Cabling | Cables දානවා, splicing කරනවා |
| 📊 Testing & OTDR | Fiber testing, OTDR readings |
| ✅ QA/QC Inspection | Quality check, commissioning |
| 🏁 Handover & Closure | Project close, asset register |

### 🏢 2. Cluster - Stages 10ක්

| Stage | Purpose |
|-------|---------|
| 📋 Feasibility Study | Technical & commercial assessment |
| 📏 Survey & Route Planning | Field survey, GIS route design |
| 📜 Permit Management | Permits (RDA, LRA, etc.) |
| 🏗️ Detailed Engineering | Engineering designs, final BOQ |
| 📦 Material Procurement | Procurement, store receiving |
| 🔧 Civil Works | Trenching, duct, chambers |
| 🔧 Cabling & Splicing | Cable install, fusion splicing |
| 📊 OTDR Testing | End-to-end fiber testing |
| ✅ QA/QC & Commissioning | Quality inspection + commissioning |
| 🏁 Handover & Asset Registration | Handover + NOC asset register |

### 🏠 3. Building Fiber - Stages 8ක්

| Stage | Purpose |
|-------|---------|
| 📋 Building Survey | Building assessment |
| 📜 Permit & Access | Building access permits |
| 📦 Material Issuance | Materials for building |
| 🔧 Riser & Horizontal Cabling | In-building cabling |
| 🔧 Splicing & Termination | Fiber splicing, ODF termination |
| 📊 Testing | Fiber testing & OTDR |
| ✅ QA/QC | Quality inspection |
| 🏁 Handover | Building handover |

---

## 4. Step 1: Project එකක් Create කරන හැටි

### 🌐 Browser එකෙන් Create කරන හැටි

#### Step 1: Projects Page එකට යන්න

```
http://localhost:3000/projects
```

නැත්නම් Sidebar එකේ **Projects** තෝරන්න.

#### Step 2: "New Project" Button එක Click කරන්න

උඩ දකුණු පැත්තේ **"New Project"** button එක click කරන්න. Dialog එකක් open වෙයි.

#### Step 3: Form එක Fill කරන්න

| Field | අවශ්‍යද? | විස්තරය | Example |
|-------|-----------|---------|---------|
| **Project Code** | ✅ අනිවාර්යය | Unique code එකක් දෙන්න | `PRJ-2026-001` |
| **Project Type (Workflow)** | ✅ අනිවාර්යය | SSD / Cluster / Building Fiber වලින් එකක් තෝරන්න | `SSD (OSP FTTH)` |
| **Project Name** | ✅ අනිවාර්යය | Meaningful name එකක් | `KL-SVK-0567 Fiber Project` |
| **Description** | ❌ විකල්පයි | Project එක ගැන short description | |
| **Location** | ❌ විකල්පයි | Site location එක | `Kalmunai` |
| **Budget (LKR)** | ❌ විකල්පයි | Total budget එක | `5000000` |
| **Start Date** | ❌ විකල්පයි | Start date | Select from date picker |
| **End Date** | ❌ විකල්පයි | Target end date | Select from date picker |

> 💡 **Project Type (Workflow)** Select එකෙන් SSD, Cluster, Building Fiber වගේ workflow type එකක් තෝරන්න. Type එක අනුව stage-gate workflow එක auto-generate වෙයි.

#### Step 4: "Create Project" Click කරන්න

Fill කරපු details check කරලා **"Create Project"** button click කරන්න.

**Result:** Project එක create වෙලා project list එකට add වෙයි. ඊට පස්සේ **View** button click කරලා project details page එකට යන්න පුළුවන්.

### 📋 පළමු වතාවට Type එකක් Add කරන හැටි

Project Type dropdown එකේ **"Add New"** link එක click කරන්න. Dialog එකක් open වෙයි:
1. **Type Name** - Type name එක දෙන්න (e.g., `OSP_FTTH`, `FIBER_BACKBONE`, `CLUSTER_FTTH`)
2. **Description** - Short description එකක්
3. **Create Type** click කරන්න

### 🔌 API එකෙන් Project Create කරන හැටි

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "projectCode": "PRJ-2026-001",
    "name": "KL-SVK-0567 Fiber Project",
    "description": "Fiber to the home project",
    "type": "OSP_FTTH",
    "location": "Kalmunai",
    "budget": "5000000",
    "startDate": "2026-01-15",
    "endDate": "2026-06-30"
  }'
```

---

## 5. Step 2: Project Details Page - Overview

### 📄 Page Header එකේ තියෙන දේවල්

Project details page එක open කළාම මේ info appear වෙනවා:

| Element | විස්තරය |
|---------|---------|
| **Project Name** | ලොකු අකුරින් project name එක |
| **Project Code** | Code badge එක (e.g., PRJ-2026-001) |
| **Status Badge** | PLANNING / IN_PROGRESS / COMPLETED |
| **Type Badge** | SSD / Cluster / Building Fiber |
| **Location** | Project location |
| **OPMC** | OPMC officer name |
| **Area Manager** | Assigned area manager |
| **Contractor** | Assigned contractor with contact |
| **Timeline** | Start date → End date |
| **Current Stage** | Active workflow stage (e.g., "Survey & Feasibility") |
| **Modules Count** | Current stage එකට available tabs ගණන |

### 🎯 Buttons

| Button | විස්තරය |
|--------|---------|
| **🔙 Back to Projects** | Project list එකට යන්න |
| **📖 Guide** | මේ guide එකම open කරනවා (popup එකකින්) |
| **Edit Details** | Project details edit කරන්න |

---

## 6. Step 3: Always-Visible Tabs

### 📊 Overview Tab

**Purpose:** Project එකේ **overall status, key metrics, progress** බලන්න.

**Functions:**
- 📈 Progress bar - Overall project progress %
- 💰 Budget vs Actual cost comparison
- ⏱️ Timeline - Start/End dates with remaining time
- 📋 BOQ item count
- 🏷️ Milestone progress
- 💸 Expense summary
- 📊 Quick stats cards

**කරන්න ඕන දේ:** 
- හැම වෙලේම මෙතන බලලා project progress track කරන්න
- Budget vs actual cost check කරන්න
- Important metrics monitor කරන්න

---

### 🔄 Workflow Pipeline Tab

**Purpose:** Stage-gate workflow control - **වැදගත්ම tab එක** stages manage කරන්න.

**Functions:**
- 👁️ Visual pipeline එක - Stages 7ක් (SSD) / 10ක් (Cluster) / 8ක් (Building Fiber) visualize කරලා පෙන්වනවා
- ✅ **Current Stage** - Green color එකෙන් active stage එක mark කරලා
- ⏳ **Pending Stages** - තාම කරන්න තියෙන stages
- ✅ **Completed Stages** - Check mark එක්ක completed stages
- 🔘 **Mark Stage Complete** button - Current stage complete කරලා next stage එකට යන්න
- 👎 **Reject Stage** button - Stage එක reject කරලා previous stage එකට යවන්න

**කරන්න ඕන දේ:**
- Stage එකක් complete කරාට පස්සේ **Mark Stage Complete** click කරන්න
- Stage එක හරියට complete නොවුනොත් **Reject** click කරලා back යන්න
- Pipeline visualization එක බලලා project progress understand කරන්න

> ⚠️ **Stage එක advance කරනකොට tabs auto-update වෙනවා!** Next stage එකට අදාළ tabs විතරක් පෙන්වන්න පටන් ගන්නවා.

---

## 7. Stage-by-Stage: Survey & Feasibility Stage

මෙතනදී ව්‍යාපෘතියේ **site survey එක** කරලා **feasibility** බලනවා.

### 📋 Tabs Available: 

- ✅ **Overview** - (Always visible)
- ✅ **Workflow Pipeline** - (Always visible)
- **📏 Survey** 👈 **Main tab**
- **🗺️ GIS Route** 👈 **Main tab**
- **📄 Documents**
- **⚠️ Risks**

---

### 📏 Survey Tab

**Purpose:** Site survey data manage කරන්න.

**Functions:**
- ➕ Add survey task - Pole verification, GPS capture, route survey
- 📋 Survey task list - All tasks with status
- 📊 Completion stats - How many done
- ✅ Mark task complete

**කරන්න ඕන දේ:**
```
1. "Add Survey Task" click කරන්න
2. Task type එක select කරන්න:
   - POLE_VERIFICATION - Pole details check
   - GPS_CAPTURE - GPS coordinates capture
   - PHOTO_COLLECTION - Site photos
   - ROUTE_VERIFICATION - Route survey
3. Task details fill කරන්න
4. Site එකට ගිහින් survey කරලා task complete mark කරන්න
```

---

### 🗺️ GIS Route Tab

**Purpose:** GIS maps, route planning, network design.

**Functions:**
- 🗺️ Interactive map (Leaflet)
- 📍 Layer toggle - Cables, Poles, FDPs, Joints, Roads
- 👆 Click features - Feature details popup
- 📊 Route analytics - Length, coverage
- 📥 GIS data import

**කරන්න ඕන දේ:**
```
1. GIS data import කරන්න (ඉස්සරහට)
   - QGIS වලින් export කරපු GeoJSON files upload කරන්න
   - Auto-parse වෙලා map එකේ visualize වෙනවා
2. Route plan check කරන්න
3. Pole/FDP locations verify කරන්න
4. Route analytics review කරන්න
```

---

### 📄 Documents Tab

**Purpose:** Project documents manage කරන්න (survey reports, drawings).

**Functions:**
- 📤 Upload documents
- 📥 Download documents
- 📂 Document categories
- 🔍 Search documents
- 🏷️ Add tags/categories

**කරන්න ඕන දේ:**
```
1. "Upload" click කරලා survey reports upload කරන්න
2. Site photos upload කරන්න
3. Drawings/PDFs upload කරන්න
4. Categories assign කරන්න
```

---

### ⚠️ Risks Tab

**Purpose:** Project risks track කරන්න.

**Functions:**
- ➕ Add risk - Name, description, severity
- 🔴 High/Medium/Low risk classification
- 📋 Mitigation plan
- ✅ Risk status tracking

**කරන්න ඕන දේ:**
```
1. "Add Risk" click කරන්න
2. Risk details fill කරන්න:
   - Risk name (e.g., "Weather delay")
   - Severity (High/Medium/Low)
   - Description
   - Mitigation plan
3. Update risk status as project progresses
```

---

## 8. Stage-by-Stage: Permit Acquisition Stage

මෙතනදී **permits, wayleaves, approvals** ගන්නවා.

### 📋 Tabs Available:

- ✅ Overview & Workflow Pipeline (Always visible)
- **📜 Permits** 👈 **Main tab**
- **📄 Documents**
- **✅ Approvals**

---

### 📜 Permits Tab

**Purpose:** Permits & wayleave management.

**Functions:**
- ➕ Add permit - Road cutting, wayleave, building access
- 📋 Permit list - All permits with status
- 🏛️ Authority info - Municipal council, survey department
- 📅 Expiry dates track
- ✅ Mark as obtained/rejected

**කරන්න ඕන දේ:**
```
1. "Add Permit" click කරන්න
2. Permit type එක select කරන්න:
   - ROAD_CUTTING - Road cutting permit (to Municipal Council)
   - WAYLEAVE - Wayleave permit (to Survey Dept)
   - BUILDING_ACCESS - Building access (for building fiber)
3. Authority details fill කරන්න
4. Submit කරලා approval process track කරන්න
5. Permit එක ලැබුනාම mark as obtained
```

---

### ✅ Approvals Tab

**Purpose:** Internal approvals workflow.

**Functions:**
- ➕ Create approval request
- 👥 Assign approvers
- 📋 Pending/Approved/Rejected tracking
- 📝 Comments & notes

**කරන්න ඕන දේ:**
```
1. Approval requests create කරන්න
2. Approvers assign කරන්න
3. Status track කරන්න
4. Approvals complete වුනාම proceed කරන්න
```

---

## 9. Stage-by-Stage: Material Issuance Stage

මෙතනදී **BOQ, materials, procurement** manage කරනවා.

### 📋 Tabs Available:

- ✅ Overview & Workflow Pipeline
- **📋 BOQ & Material** 👈 **Main tab**
- **📦 Material Issues** 👈 **Main tab**
- **🛒 Procurement**
- **📄 Documents**

---

### 📋 BOQ & Material Tab

**Purpose:** Bill of Quantities - materials planning.

**Functions:**
- ➕ Add BOQ item - Cable, Pole, FDP, Joint, etc.
- 📋 BOQ list - All items with quantities
- 💰 Unit rates & total cost auto-calculate
- 📊 Cost summary
- 📥 Import from template

**BOQ Items Example (SSD):**

| Item | Unit | Unit Rate (LKR) |
|------|------|----------------|
| Fiber Optic Cable | meter | 850.00 |
| Telecom Pole | each | 45,000.00 |
| FDP | each | 35,000.00 |
| Fiber Joint | each | 25,000.00 |
| Warning Tape | meter | 150.00 |
| Road Crossing | each | 85,000.00 |
| Accessories | % | 8% of material |

**කරන්න ඕන දේ:**
```
1. "Add BOQ Item" click කරන්න
2. Item details fill කරන්න:
   - Item name (e.g., "Fiber Optic Cable")
   - Unit (meter/each)
   - Quantity
   - Unit rate
3. System auto-calculates total
4. Review BOQ summary before proceeding
```

---

### 📦 Material Issues Tab

**Purpose:** Track materials issued to site.

**Functions:**
- ➕ Issue material - Select BOQ item, enter qty
- 📋 Issue history
- 📊 Remaining qty tracking
- 🏗️ Site-wise issue tracking

**කරන්න ඕන දේ:**
```
1. "Issue Material" click කරන්න
2. BOQ item එක select කරන්න (e.g., "Fiber Optic Cable")
3. Issue quantity enter කරන්න
4. Recipient details fill කරන්න
5. Material issue complete කරන්න
6. Remaining qty auto-track වෙනවා
```

---

### 🛒 Procurement Tab

**Purpose:** Procurement & purchasing management.

**Functions:**
- ➕ Create PO (Purchase Order)
- 📋 PO list
- 🏢 Supplier management
- 📊 Procurement status

**කරන්න ඕන දේ:**
```
1. "Create PO" click කරන්න
2. Supplier select කරන්න
3. Items add කරන්න
4. PO amount fill කරන්න
5. Submit for approval
```

---

## 10. Stage-by-Stage: Installation & Cabling Stage

මෙතනදී **installation, cabling, splicing** වැඩ කරනවා.

### 📋 Tabs Available:

- ✅ Overview & Workflow Pipeline
- **✅ Tasks** 👈 **Main tab**
- **👥 Resources**
- **👷 Contractor**
- **🦺 HSE**
- **📱 Field Tasks**
- **💰 Expenses**

---

### ✅ Tasks Tab

**Purpose:** Installation tasks management.

**Functions:**
- ➕ Add task - Pole installation, cable laying, splicing
- 📋 Task list with status
- 👤 Assign to team members
- 📅 Due dates
- ✅ Mark complete

**Task Types:**
| Task Type | Purpose |
|-----------|---------|
| POLE_INSTALLATION | Install telecom poles |
| CABLE_LAYING | Lay fiber optic cables |
| SPLICING | Fiber splicing & termination |
| FDP_INSTALLATION | Install FDP boxes |
| JOINT_CLOSURE | Fiber joint closure |

**කරන්න ඕන දේ:**
```
1. "Add Task" click කරන්න
2. Task type select කරන්න
3. Assign to team member
4. Due date set කරන්න
5. Site එකේ වැඩ කරාට පස්සේ mark complete කරන්න
```

---

### 👥 Resources Tab

**Purpose:** Resource allocation & tracking.

**Functions:**
- ➕ Add resource - Equipment, vehicles, tools
- 📋 Resource allocation
- 📊 Utilization tracking
- ⏳ Availability check

**කරන්න ඕන දේ:**
```
1. Resources register කරන්න
2. Tasks වලට resources allocate කරන්න
3. Utilization monitor කරන්න
```

---

### 👷 Contractor Tab

**Purpose:** Contractor management.

**Functions:**
- ➕ Add contractor info
- 📋 Contractor list
- 📞 Contact details
- 📊 Performance tracking

**කරන්න ඕන දේ:**
```
1. Contractor details add කරන්න
2. Contact info store කරන්න
3. Work assignments track කරන්න
```

---

### 🦺 HSE Tab

**Purpose:** Health, Safety & Environment management.

**Functions:**
- ➕ HSE incident report
- 📋 Safety checklist
- ⚠️ Hazard report
- 📊 HSE stats

**කරන්න ඕන දේ:**
```
1. Safety inspections record කරන්න
2. Incidents report කරන්න
3. Safety compliance check කරන්න
```

---

### 💰 Expenses Tab

**Purpose:** Installation expenses tracking.

**Functions:**
- ➕ Add expense
- 📋 Expense categories
- 📊 Budget vs actual
- 📈 Expense reports

**කරන්න ඕන දේ:**
```
1. "Add Expense" click කරන්න
2. Category select කරන්න (Transport, Labor, Equipment)
3. Amount enter කරන්න
4. Receipt upload කරන්න
5. Track total expenses vs budget
```

---

## 11. Stage-by-Stage: Testing & OTDR Stage

මෙතනදී **fiber testing** කරලා **quality check** කරනවා.

### 📋 Tabs Available:

- ✅ Overview & Workflow Pipeline
- **📊 OTDR** 👈 **Main tab**
- **✅ QA/QC**
- **📄 Documents**

---

### 📊 OTDR Tab

**Purpose:** OTDR testing & results management.

**Functions:**
- ➕ Add OTDR test
- 📊 Test results - Distance, loss, reflectance
- 📈 Pass/Fail analysis
- 📋 Test report generation

**OTDR Parameters:**
| Parameter | Description |
|-----------|-------------|
| Cable ID | Which cable tested |
| Fiber ID | Fiber number |
| Distance (km) | Tested distance |
| Total Loss (dB) | End-to-end loss |
| Splice Loss | Loss at splice points |
| Connector Loss | Loss at connectors |
| ORL (dB) | Optical return loss |
| Pass/Fail | Auto-判定 based on thresholds |

**කරන්න ඕන දේ:**
```
1. "Add OTDR Test" click කරන්න
2. Cable/Fiber select කරන්න
3. Test results enter කරන්න
4. Pass/Fail auto-විනිශ්චය වෙනවා
5. Test reports generate කරන්න
```

---

### ✅ QA/QC Tab

**Purpose:** Quality control & inspection.

**Functions:**
- ➕ Create inspection
- 📋 Inspection checklist
- ✅ Pass/Fail results
- 📊 Quality metrics
- 🔧 Non-conformance report

**කරන්න ඕන දේ:**
```
1. Inspections create කරන්න
2. Quality checks run කරන්න
3. Results record කරන්න
4. Non-conformance තියෙනවනම් report කරන්න
5. Fix verified වුනාම close කරන්න
```

---

## 12. Stage-by-Stage: QA/QC Inspection Stage

මෙතනදී **final quality inspection** + **commissioning** කරනවා.

### 📋 Tabs Available:

- ✅ Overview & Workflow Pipeline
- **✅ QA/QC**
- **📊 KPIs**
- **📄 Documents**
- **🔧 Commissioning** 👈 **New tab**

---

### 🔧 Commissioning Tab

**Purpose:** Network commissioning & handover preparation.

**Functions:**
- ➕ Commissioning task
- 📋 Commissioning checklist
- ✅ Test results verification
- 📊 Readiness assessment

**කරන්න ඕන දේ:**
```
1. Commissioning tasks create කරන්න
2. Network tests verify කරන්න
3. All checks pass කරාට පස්සේ ready mark කරන්න
4. Handover documents prepare කරන්න
```

---

### 📊 KPIs Tab

**Purpose:** Key Performance Indicators tracking.

**Functions:**
- 📊 KPI dashboard
- 📈 Progress against targets
- 🎯 Quality metrics
- ✅ Completion rate

**KPIs Tracked:**
- Survey completion %
- Permit acquisition rate
- Installation progress %
- Testing pass rate
- Budget variance
- Timeline adherence

**කරන්න ඕන දේ:**
```
1. KPI targets set කරන්න
2. Actual progress vs target compare කරන්න
3. Performance monitor කරන්න
4. Reports generate කරන්න
```

---

## 13. Stage-by-Stage: Handover & Closure Stage

**Final stage** - project එක close කරන්න.

### 📋 Tabs Available:

- ✅ Overview & Workflow Pipeline
- **🏁 Closure** 👈 **Main tab**
- **🏷️ Assets** 👈 **Main tab**
- **📄 Documents**
- **🔧 Commissioning**
- **📊 KPIs**
- **💰 Finance**

---

### 🏁 Closure Tab

**Purpose:** Project closure & final documentation.

**Functions:**
- 📋 Closure checklist
- ✅ Task completion verification
- 📊 Final report
- 📝 Lessons learned
- ✅ Mark project complete

**Closure Checklist:**
```
[ ] All tasks completed?
[ ] All BOQ items reconciled?
[ ] All expenses accounted?
[ ] Assets registered?
[ ] Documents archived?
[ ] Final report generated?
[ ] Stakeholder approval?
```

**කරන්න ඕන දේ:**
```
1. Closure checklist review කරන්න
2. Outstanding items complete කරන්න
3. Final report generate කරන්න
4. Lessons learned document කරන්න
5. Project complete mark කරන්න
```

---

### 🏷️ Assets Tab

**Purpose:** Asset registration for installed infrastructure.

**Functions:**
- ➕ Register asset - Pole, Cable, FDP, Joint
- 📋 Asset register
- 🏷️ Asset codes auto-generate
- 📍 GPS location
- 📊 Asset categories summary

**Asset Code Format:**
```
{PROJECT_CODE}-{TYPE}-{SEQUENCE}

Example: 
PRJ-001-POL-0001 (Pole)
PRJ-001-CBL-0001 (Cable)
PRJ-001-FDP-0001 (FDP)
```

**කරන්න ඕන දේ:**
```
1. "Register Asset" click කරන්න
2. Asset type select කරන්න:
   - POLE - Telecom pole
   - CABLE - Fiber cable
   - FDP - Distribution point
   - FIBER_JOINT - Joint closure
3. Details fill කරන්න (code, location, GPS)
4. Asset code auto-generate වෙනවා
5. Final handover documents වලට include කරන්න
```

---

### 💰 Finance Tab

**Purpose:** Final financial reconciliation.

**Functions:**
- 💵 Budget vs actual
- 📊 Cost breakdown
- 📈 Variance analysis
- 📄 Final financial report

**කරන්න ඕන දේ:**
```
1. Final costs reconcile කරන්න
2. Budget variance analyze කරන්න
3. Final financial report generate කරන්න
```

---

### 📈 EVM Tab (typically in *Handover & Asset Registration*)

**Purpose:** Earned Value Management - advanced project performance.

**Functions:**
- 📊 EVM metrics - PV, EV, AC
- 📈 CPI & SPI
- 📉 Variance analysis
- 📋 Performance reports

**EVM Metrics:**
| Metric | Meaning |
|--------|---------|
| PV (Planned Value) | Planned work cost |
| EV (Earned Value) | Actual work done cost |
| AC (Actual Cost) | Money spent |
| CPI | Cost efficiency (>1 = good) |
| SPI | Schedule efficiency (>1 = good) |

**කරන්න ඕන දේ:**
```
1. EVM calculations auto-compute වෙනවා
2. CPI/SPI review කරන්න
3. Performance report generate කරන්න
```

---

## 14. Detailed Engineering Stage (Cluster Workflow)

**Cluster workflow** එකට විශේෂිත stage එකක්.

### 📋 Tabs Available:

- ✅ Overview & Workflow Pipeline
- **📏 Survey**
- **🗺️ GIS Route**
- **📋 BOQ & Material**
- **📄 Documents**
- **✅ Approvals**

**කරන්න ඕන දේ:**
```
1. Detailed engineering survey data enter කරන්න
2. GIS route design finalize කරන්න
3. Engineering BOQ prepare කරන්න
4. Drawings & documents upload කරන්න
5. Engineering approvals get කරන්න
6. Stage complete කරලා next stage එකට යන්න
```

---

## 15. Complete Tab Reference

සියලුම **tabs 28** ගේ සම්පූර්ණ විස්තරය:

| # | Tab Value | Tab Label | විස්තරය | Appears In Stages |
|---|-----------|-----------|---------|-------------------|
| 1 | `overview` | **Overview** | Project summary, progress, key metrics | **Always** |
| 2 | `workflow-pipeline` | **Workflow Pipeline** | Stage-gate control, advance/reject stages | **Always** |
| 3 | `survey` | **Survey** | Site survey tasks, field data | Survey, Feasibility, Engineering |
| 4 | `gis` | **GIS Route** | Map view, route planning, GIS data | Survey, Engineering |
| 5 | `permits` | **Permits** | Permit & wayleave management | Permit stages |
| 6 | `boq` | **BOQ & Material** | Bill of quantities, cost estimation | Material stages, Engineering |
| 7 | `materials` | **Material Issues** | Track issued materials to site | Material stages |
| 8 | `procurement` | **Procurement** | Purchase orders, supplier management | Material stages |
| 9 | `tasks` | **Tasks** | Installation/splicing tasks | Installation stages |
| 10 | `resources` | **Resources** | Equipment, tools, team allocation | Installation stages |
| 11 | `contractor` | **Contractor** | Contractor details & mgmt | Installation stages |
| 12 | `hse` | **HSE** | Health, Safety & Environment | Installation stages |
| 13 | `field-tasks` | **Field Tasks** | Mobile field tasks | Installation |
| 14 | `expenses` | **Expenses** | Site expenses tracking | Installation stages |
| 15 | `otdr` | **OTDR** | Fiber testing & results | Testing stages |
| 16 | `qa` | **QA/QC** | Quality inspection & control | QA/QC stages, Testing |
| 17 | `commissioning` | **Commissioning** | Network commissioning | QA/QC, Handover |
| 18 | `kpis` | **KPIs** | Key performance indicators | QA/QC, Handover, Feasibility |
| 19 | `closure` | **Closure** | Project closure & final report | Handover stage |
| 20 | `assets` | **Assets** | Asset registration | Handover stage |
| 21 | `documents` | **Documents** | Document management | Most stages |
| 22 | `approvals` | **Approvals** | Approval workflow | Permit, Engineering |
| 23 | `risks` | **Risks** | Risk assessment & mitigation | Survey, Feasibility |
| 24 | `finance` | **Finance** | Financial reconciliation | Handover, Procurement |
| 25 | `evm` | **EVM** | Earned Value Management | Handover & Asset Registration stage (Cluster) |
| 26 | `contractor-perf` | **Contractor Perf** | Contractor performance metrics | Always (via mapping) |
| 27 | `variations` | **Variations** | Variation orders | Default tabs |
| 28 | `milestones` | **Milestones** | Project milestone tracking | Default tabs |

> 💡 **Default tabs:** Stage එකකට specific mapping එකක් නැත්නම්, system එක **getDefaultTabs()** function එක use කරලා tabs 26ම (guide tab එක exclude) පෙන්වනවා.

---

## 16. Project Statuses - ව්‍යාපෘති තත්ත්වයන්

System එකේ project වලට මේ statuses තියෙනවා:

| Status | Badge Color | අදහස |
|--------|-------------|-------|
| **PLANNING** | 🟡 Yellow | අලුතෙන් create කරපු project, planning phase |
| **APPROVED** | 🔵 Blue | Project එක approved, start කරන්න ready |
| **IN_PROGRESS** | 🟢 Green | වැඩ කරමින් තියෙන project |
| **ON_HOLD** | 🟠 Orange | Temporary hold |
| **COMPLETED** | 🟢 Emerald | සාර්ථකව complete කරපු project |
| **CANCELLED** | 🔴 Red | Cancelled project |

---

## 17. Tips & Best Practices

### ✅ Project Create කරනකොට
1. **Project Code එක unique** වෙන්න ඕන
2. **Project Type (Workflow)** හරියට select කරන්න - Stages auto-generate වෙනවා
3. Budget එක realistic විදියට දෙන්න
4. Start/End dates realistic targets set කරන්න

### ✅ Stages Manage කරනකොට
1. Stage එකක් complete කරාට පස්සේ **Mark Stage Complete** click කරන්න
2. Stage එක හරියට complete නොවුනොත් **Reject** click කරන්න
3. හැම stage එකකම **related tabs** fill කරලා තියෙනවද check කරන්න
4. **Workflow Pipeline** tab එකෙන් project progress monitor කරන්න

### ✅ Tab System එක Use කරනකොට
1. හැම stage එකකටම tabs dynamically වෙනස් වෙනවා
2. **Overview** tab එකෙන් හැම වෙලේම overall status බලන්න
3. **Documents** tab එක හැම stage එකකම පාහේ use කරන්න
4. Stage එක advance කරාට පස්සේ **new tabs** appear වෙනවා - ඒවා fill කරන්න

### ✅ Data Entry කරනකොට
1. BOQ items හරියට enter කරන්න - Budget planning වලට වැදගත්
2. Expenses track කරන්න - Budget vs actual monitor කරන්න
3. Documents organize කරන්න - Categories & tags use කරන්න
4. OTDR test results enter කරන්න - Quality verification වලට

### ✅ Closure කරනකොට
1. Closure checklist එකේ හැම item එකම complete කරන්න
2. Assets register කරන්න - Handover documents වලට include කරන්න
3. Final financial report generate කරන්න
4. Lessons learned document කරන්න
5. All documents archive කරන්න

---

## 18. FAQ

### ❓ Project එකක් create කරාට පස්සේ tabs appear නොවුනොත්?

**හේතුව:** Workflow type එකට stage mapping එක නැති වීම
**විසඳුම:** Default tabs (26) auto-load වෙනවා. ඔයාට Project Type එක check කරලා හරියට stage names mapping එකේ තියෙනවද check කරන්න පුළුවන්.

---

### ❓ Stage එකක් complete කරාට පස්සේ tabs වෙනස් නොවුනොත්?

**විසඳුම:** Page එක refresh කරන්න. Stage change වෙලා tabs auto-update වෙන්නේ page load එකේදී.

---

### ❓ Tab එකක් click කළාම component එක load නොවුනොත්?

**විසඳුම:** Browser console එකේ errors check කරන්න. Server runningද කියලා verify කරන්න.

---

### ❓ Workflow type එක change කරන්න පුළුවන්ද?

**විසඳුම:** දැනට project create කරාට පස්සේ workflow type එක change කරන්න බැහැ. අලුත් project එකක් create කරන්න ඕන.

---

### ❓ Multiple users එකම project එකේ වැඩ කරන හැටි?

**විසඳුම:** System එක real-time collaboration support කරන්නේ නැහැ. හැම user එක්කෙනාටම තමන්ගේ data enter කරන්න පුළුවන්, නමුත් page refresh කරාට පස්සේ latest data පේනවා.

---

### ❓ GIS data import කරන්නේ කොහොමද?

**විසඳුම:** GIS import feature එක **GIS Route** tab එකෙන් කරන්න පුළුවන්. QGIS වලින් export කරපු GeoJSON files upload කරන්න. (GIS-ERP-PIPELINE-GUIDE.md file එකේ detailed instructions බලන්න)

---

### ❓ Budget එක exceeded වුනොත්?

**විසඳුම:** **Finance** tab එකෙන් budget vs actual monitor කරන්න. **Variations** tab එකෙන් variation orders create කරන්න. Budget overrun එක manage කරන්න approvals ගන්න.

---

### ❓ Project එක delete කරන්න පුළුවන්ද?

**විසඳුම:** දැනට system එකේ project delete feature එක නැහැ. Project status **CANCELLED** කරන්න පුළුවන්.

---

### ❓ How to get help?

**Contact:** System Administrator
**Repository:** https://github.com/madu025/SLTSERP

---

## 🎯 Quick Reference Card - ඉක්මන් මතක් කිරීම

### 🚀 New User Flow:

```
1. Go to /projects
2. Click "New Project"
3. Fill Project Code, Name, Type (Workflow)
4. Click "Create Project"
5. Click "View" → Project Details Page
6. Check Overview tab for summary
7. Go to Workflow Pipeline tab
8. Start with Stage 1 tasks
9. Complete stage → Mark Complete → Next stage
10. Repeat until Handover & Closure
```

### 📋 Stage-by-Stage Quick Reference:

| Stage | Main Action | Key Tab |
|-------|-------------|---------|
| 📋 Survey | Site survey, GIS planning | Survey, GIS Route |
| 📜 Permits | Get permits, approvals | Permits, Approvals |
| 📦 Materials | BOQ, issue materials | BOQ, Material Issues |
| 🔧 Installation | Cabling, splicing tasks | Tasks, Expenses |
| 📊 Testing | OTDR test, QC check | OTDR, QA/QC |
| ✅ QA/QC | Quality inspect, commission | QA/QC, Commissioning |
| 🏁 Handover | Close, register assets | Closure, Assets |

### 🔥 Important Buttons:

| Button | තියෙන තැන | කරන්නේ |
|--------|-----------|---------|
| **New Project** | Projects page | අලුත් project create කරන්න |
| **Mark Stage Complete** | Workflow Pipeline tab | Stage complete කරන්න |
| **Reject** | Workflow Pipeline tab | Stage reject කරන්න |
| **Add BOQ Item** | BOQ tab | BOQ item add කරන්න |
| **Add Task** | Tasks tab | Task add කරන්න |
| **Register Asset** | Assets tab | Asset register කරන්න |
| **Guide** | Project page | මේ guide එක open කරන්න |

---

> **🎉 සුභ පැතුම්!** දැන් ඔයාට SLTS ERP Project Module එක A to Z use කරන්න පුළුවන්!
> *(Congratulations! Now you can use the SLTS ERP Project Module from A to Z!)*
> 
> **Project එකක් create කරලා, stages manage කරලා, complete කරන්න මේ guide එක reference එකක් විදියට use කරන්න!**
