# RBAC සම්පූර්ණ පරීක්ණ සැලැස්ම

## සාරාංශය

Prasad පරිශීලකයාගේ භූමිකාව, දෙපාර්තමේන්තු පැවරීම්, සහ RTOM/OPMC ප්‍රවේශය වෙනස් කරමින් සියලුම ප්‍රවේශ පාලන මානයන් 3 සඳහා පද්ධතිය පරීක්ෂා කිරීමේ සැලැස්ම.

---

## පරීක්ණ මානයන් 3

### මානය 1: ූමිකාව (Role) - භූමිකා 37ක්

| කාණ්ඩය | භූමිකා |
|--------|--------|
| **පද්ධති පරිපාලක** | SUPER_ADMIN, ADMIN |
| **විධායක නායකත්වය** | CEO, HEAD_OF_OSP, HEAD_OF_SECTION, MANAGER |
| **OSP මෙහෙයුම්** | OSP_MANAGER, AREA_MANAGER, ASSISTANT_ENGINEER, AREA_COORDINATOR, QC_OFFICER |
| **OSP ව්‍යාපෘති** | ENGINEER, OSP_ENGINEER, CIVIL_SUPERVISOR, CABLE_SPLICER |
| **ගබඩා & තොග** | STORES_MANAGER, STORES_ASSISTANT |
| **මල්‍ය** | FINANCE_MANAGER, FINANCE_ASSISTANT, CASHIER, AR_OFFICER |
| **බිල්පත් අංශය** | INVOICE_MANAGER, INVOICE_ASSISTANT |
| **සේවා සහතික** | SA_MANAGER, SA_ASSISTANT, FAULT_COORDINATOR, REPAIR_TECHNICIAN |
| **SF විගණන** | SF_AUDIT_MANAGER, SF_AUDIT_OFFICER, RATE_AUDITOR |
| **කාර්යාල පරිපාලන** | OFFICE_ADMIN, OFFICE_ADMIN_ASSISTANT, SITE_OFFICE_STAFF |
| **ප්‍රසම්පාදන** | PROCUREMENT_OFFICER |

### මානය 2: දෙපාර්තමේන්තු පැවරීම් (Section Assignments)

| අවස්ථාව | විස්තරය |
|---------|---------|
| **පැවරීම් නැත** | පරිශීලකයාට කිසිදු section assignment එකක් නැත - භූමිකාව පමණක් අවසර ලබා දෙයි |
| **පැවරීම් සමඟ** | පරිශීලකයාට section assignments ඇත - SystemRole වෙතින් අවසර ලබා ගනී |

### මානය 3: RTOM/OPMC ප්‍රවේශය (Data Scoping)

| අවස්ථාව | විස්තරය |
|---------|---------|
| **පරිපාලක (ගෝලීය)** | Admin ූමිකා - සියලු OPMCs වෙත ප්‍රවේශය |
| **OPMC නැත** | Non-admin + හිස් accessibleOpmcs = දත්ත ප්‍රවේශය අවහිරයි |
| **තනි OPMC** | එක් OPMC/RTOM එකකට පමණක් සීමා වේ |
| **බහු OPMCs** | OPMCs/RTOMs කිහිපයකට සීමා වේ |

---

## පරීක්ණ ක්‍රම

### ක්‍රමය 1: අතින් පරීක්ණය (Manual Testing)

**පියවර:**

1. Prasad ගේ වින්යාසය වෙනස් කරන්න:
   ```bash
   # භූමිකාව වෙනස් කිරීම
   node scripts/quick-role-test.js role prasad ASSISTANT_ENGINEER
   
   # OPMC පැවරීම් වෙනස් කිරීම
   node scripts/quick-role-test.js opmc prasad single
   node scripts/quick-role-test.js opmc prasad multiple
   node scripts/quick-role-test.js opmc prasad none
   
   # වත්මන් වින්යාසය පෙන්වීම
   node scripts/quick-role-test.js show prasad
   
   # සියලු භූමිකා ලැයිස්තුව
   node scripts/quick-role-test.js list
   ```

2. http://localhost:3000/login වෙත යන්න

3. පිවිසෙන්න:
   - Username: `prasad`
   - Password: `Admin@123`

4. පහත දේ පරීක්ෂා කරන්න:
   - Sidebar මෙනුවේ පෙනෙන අයිතම
   - එක් එක් පිටුවට ප්‍රවේශය
   - දත්ත පෙරහන් (RTOM dropdown)

---

### ක්රමය 2: ස්වයංක්‍රීය පරීක්ණය (Automated Testing)

**සම්පූර්ණ පරීක්ණය ධාවනය කිරීම:**

```bash
node scripts/rbac-comprehensive-test.js
```

මෙය සියලු සංයෝජන පරීක්ා කරයි:
- භූමිකා 37 × OPMC අවස්ථා 4 × දෙපාර්තමේන්තු අවස්ථා 2 = **296 පරීක්ණ අවස්ථා**

**ප්‍රතිඵල:**
- Console එකේ සාරාංශය
- `rbac-comprehensive-report.json` ගොනුවේ විස්තරාත්මක වාර්තාව

---

## පරීක්ණ අවස්ා උදාහරණ

### උදාහරණ 1: ASSISTANT_ENGINEER තනි OPMC සම

```bash
node scripts/quick-role-test.js role prasad ASSISTANT_ENGINEER
node scripts/quick-role-test.js opmc prasad single
```

**අපේක්ෂිත ප්‍රතිඵල:**
- Sidebar: Dashboard, Service Orders, Reports, IT Help Desk පමණි
- Projects මෙනුව **නොපෙනේ** (නවතම නිවැරදි කිරීම)
- දත්ත: තනි RTOM එකේ පමණි

### උදාහරණ 2: STORES_MANAGER බහු OPMCs සමඟ

```bash
node scripts/quick-role-test.js role prasad STORES_MANAGER
node scripts/quick-role-test.js opmc prasad multiple
```

**අපේක්ෂිත ප්‍රතිඵල:**
- Sidebar: Dashboard, Inventory/Stores, Reports, IT Help Desk
- Inventory මෙනුව සම්පර්ණයෙන් පෙනේ
- දත්ත: පැවරුණු OPMCs කිහිපයට සීමා වේ

### උදාහරණ 3: FINANCE_MANAGER OPMC නැතුව

```bash
node scripts/quick-role-test.js role prasad FINANCE_MANAGER
node scripts/quick-role-test.js opmc prasad none
```

**අපේක්ෂිත ප්‍රතිඵල:**
- Sidebar: Dashboard, Finance sections, Reports, IT Help Desk
- දත්ත: **කිසිවක් නොපෙනේ** (OPMC නැති නිසා)

---

## පරීක්ණ ලැයිස්තුව

### සෑම ූමිකාවක් සඳහාම පරීක්ෂා කරන්න:

1. **Sidebar දෘශ්‍යතාව**
   - [ ] Dashboard
   - [ ] Service Orders
   - [ ] Contractors
   - [ ] Projects
   - [ ] Finance Setup & Ops
   - [ ] SF Audit Division
   - [ ] Billing & Invoices
   - [ ] Central Finance
   - [ ] OSP Accounts
   - [ ] Inventory / Stores
   - [ ] Approvals
   - [ ] Procurement
   - [ ] Corporate Finance & Accounts
   - [ ] Reports & Analytics
   - [ ] Vehicle & Fleet Management
   - [ ] Administration
   - [ ] IT Help Desk & Assets

2. **API ප්‍රවේශය**
   - [ ] Admin endpoints
   - [ ] Project endpoints
   - [ ] Service Order endpoints
   - [ ] Inventory endpoints
   - [ ] Finance endpoints
   - [ ] Profile endpoints

3. **දත්ත පෙරහන්**
   - [ ] RTOM dropdown විකල්ප
   - [ ] දත්ත ප්‍රමාණය (OPMC අනුව)

---

## වැදගත් සටහන්

1. **Admin භමිකා** (SUPER_ADMIN, ADMIN, CEO, HEAD_OF_OSP):
   - සියලු මෙනු අයිතම පෙනේ
   - සියලු OPMCs වෙත ප්‍රවේශය
   - Section assignments අවශ්ය නැත

2. **Non-admin ූමිකා**:
   - Sidebar දෘශ්‍යතාව ූමිකාව මත පදනම් වේ
   - දත්ත ප්‍රවේශය OPMC assignments මත පදනම් වේ
   - OPMC නැත්නම් දත්ත නොපෙනේ

3. **Section Assignments**:
   - අවසර ලබා ගැනීමට භාවිතා වේ
   - SystemRole permissions වෙතින් අවසර ලබා ගනී

---

## ප්‍රතිඵල විශ්ලේෂණය

පරීක්ණයෙන් පසු:

1. `rbac-comprehensive-report.json` ගොනුව පරීක්ෂා කරන්න
2. අපේක්ෂිත ප්‍රවේශය සහ සැබෑ ප්‍රවේශය සසඳන්න
3. අසමතුලිතතා හඳුනාගන්න:
   - Sidebar පෙනෙන නමුත් API අවහිරයි
   - Sidebar නොපෙනෙන නමුත් API ප්‍රවේශය ඇත
   - දත්ත පෙරහන් වැරදිය

---

## නිගමනය

මෙම පරීක්ණ සැලැස්ම මගින්:
- භූමිකා 37ක් සඳහා ප්‍රවේශ පාලනය තහවුරු කරයි
- දෙපාර්තමේන්තු පැවරීම් වල බලපෑම පරීක්ෂා කරයි
- RTOM/OPMC දත්ත වෙන් කිරීම සත්‍යාපනය කරයි
- සම්පූර්ණ RBAC පද්ධතියේ නිවැරදිාවය තහවුරු කරයි
