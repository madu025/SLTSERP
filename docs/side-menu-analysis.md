# Side menu: analysis and proposed design

Status: for discussion. Data measured on the production database, 22 Nov 2026 (294 active users).

## 1. How the menu is decided today

A person sees a menu item when **(a)** the item resolves to a capability and **(b)** that capability is in the person's effective permissions.

* The capability comes from the item's `permissionId`, or, when it has none, from the page rule of its path (`page-capabilities.ts`). Old text ids such as `contractors`, `billing`, `restore_requests` are translated to unrelated capabilities.
* Effective permissions = the grants of the person's **base role** (`User.systemRole`) **plus** the grants of every **module designation** (`UserSectionAssignment`: user + section + role), unless `User.permissions` overrides them.
* A module designation is a role such as `PROJECTS_ENGINEER`. The seed (`seed-rbac-capabilities.ts`) gives it **the grants of its base role** (it matches the role by its suffix) and nothing of its own. Every deploy deletes and recreates all capability grants from `rbac-bootstrap.ts`, so a grant changed only in the database is lost at the next deploy.

## 2. What the data shows

| Fact | Number |
|---|---|
| System roles | 94, of which only 36 have an active user (58 are clones: `STORES_STORES_MANAGER`, `FINANCE_FINANCE_MANAGER`, ...) |
| Active users | 294 |
| Module assignments | 514 for 240 users; 36 users hold more than one |
| Users whose base role is ENGINEER | 181; **152 of them also hold PROJECTS_ENGINEER** (project work), 29 do SOD only |
| Users with exactly the same menu (Dashboard, Service Orders, ITMS) | 193 |
| Users with the whole menu (administrators) | 44 |
| Sections seen: Service Orders 260 users, ITMS 253, Projects 242, Inventory 223, Finance 65 | |
| Menu size: 214 users have 10-19 items, 44 have 100+ | |

So the company is not 36 roles. It is **two big groups plus small specialists**: about 190 field/area people whose job is the service order module (and, for most engineers, a second designation in Projects), 44 administrators, and about 60 specialists (stores, finance, procurement, audit, office).

## 3. Problems found

1. **One designation per person does not exist in the data model, but the menu logic assumes it.** The same person is an Engineer in service orders and a Project Engineer in projects. The base role says "ENGINEER" for both. Any change to ENGINEER therefore changes both modules. (This is how splitting the SOD engineer from the project engineer removed Projects from the 152 project engineers on 22 Nov; repaired the same day by giving the designation its own grants.)
2. **A module designation has no grants of its own.** It copies its base role. There is no way to say "Engineer in SOD can do X, Engineer in Projects can do Y" except by adding a special list (now `MODULE_DESIGNATION_GRANTS`).
3. **Read capability opens a whole module.** `inventory.read` showed 19 store-operation items to roles that only needed balances. `helpdesk.read` showed the IT queue to ordinary staff, who could not even raise a ticket (no capability for that). Each cut needed a new capability.
4. **Sections are shared by many roles with different needs.** Service Orders is seen by 260 users (Engineer, Assistant, Area Coordinator, QC Officer, Area Manager, OSP Manager, project field roles, ...). They share one 12-item list although the QC Officer needs 8, the Engineer 10, the Area Manager 12.
5. **Menu rules are scattered**: `sidebar-menu.ts` (explicit ids), `page-capabilities.ts` (path rules), a legacy id translator, `route-capabilities.ts` (API), the seed. The same decision is made in four places, and tests only check some of them.
6. **Role clutter.** 58 unused roles and duplicated names make the admin screen hard to use and hide real differences.
7. **Reports and dashboards have the same problem as menus**: Area Manager reports showed the whole company until 22 Nov because the report was guarded by "may read reports", not by "which areas".
8. **Some work has no menu**: the Area Manager's invoice approvals and contractor approvals were reachable only by URL.

## 4. Root cause

Three layers are mixed: **identity** (who you are: designation), **responsibility** (which modules you work in, and as what) and **capability** (what you may do). The base role mixes identity and responsibility; the module designation has no capability of its own; the menu is derived from capabilities only, so it cannot express "this section is mine, that one is only readable".

## 5. Options

**A. Keep the model, keep patching.** Add capabilities and gate items one by one. Cheap now, but every new role or cut repeats the problem 3 and 5. Not recommended.

**B. Make the module designation first-class (recommended first step).**
* A person keeps one base role (their main post) and one designation per module they work in (already stored in `UserSectionAssignment`).
* The designation's grants are listed explicitly per module (the catalog `MODULE_DESIGNATION_GRANTS` already does this for the project engineers) instead of copying the base role.
* The menu is built **per module**: a module's section appears only if the person has a designation in that module (or an administrator capability), and its items by the level of that designation: *view*, *operate*, *approve*, *administer*.
* Security stays capability-based: the menu never grants anything, it only hides.

**C. Fully data-driven menu profiles (later, if B is not enough).** A table of menu items and a table of profiles (module + designation -> items), edited in the admin screen without a deployment. More flexible, more work (two tables, an admin editor, a migration of today's menu). Worth doing only if menus change often.

**D. One role per module (clone roles).** This is what produced the 94 roles. Rejected.

## 6. Proposal in concrete terms (option B)

1. **Modules** (sections) are the unit: Service Orders, Projects, Inventory, Procurement, Finance, SF Audit, Reports, ITMS/Help Desk, Fleet, Administration. Each has designations.
2. **Designation table** (per module): the designations that exist and the levels of access each has. Example for Service Orders:

   | Designation | Pending / Completed / Return pages | Check (photos, material) | Invoicing | Invoice approval | Contractors & stock | Reports |
   |---|---|---|---|---|---|---|
   | Area Coordinator | operate | yes | no | no | view | own areas |
   | QC Officer | operate | yes | no | no | view | own areas |
   | Engineer / Assistant | operate | yes | yes | no | view | own areas |
   | Area Manager | operate | yes | yes | approve | view | own areas, all area reports |
   | OSP Manager | view | no | no | no | view | company |

3. **Menu generation**: for each module the person has, show the items of their level. Items carry `module` and `level` next to the capability.
4. **Home page per designation** (already started: Engineer and Area Manager dashboards).
5. **Housekeeping**: remove the 58 unused roles and the duplicate-named ones; make the seed fail if a module designation is not listed or a capability is granted that no role lists.
6. **Tests**: a matrix test that prints the menu of every designation and fails when it changes without the table changing.

## 7. Decisions needed

1. Is "one base role + one designation per module" the model you want (option B)? Or do you prefer fully editable menu profiles (option C) from the start?
2. Which modules does each person's designation list contain? Today 152 engineers have SOD + Projects; are there other people (for example Area Manager: SOD + Projects + Inventory approvals) who hold several?
3. Should an Engineer who is also a Project Engineer see **two sections** (Service Orders, Projects) only, with Inventory limited to the project material pages?
4. Should the 58 unused roles be deleted (after a check that nobody uses them), and the module role names simplified (`STORES_STORES_MANAGER` -> `STORES_MANAGER`)?
5. Reports: all area roles see only their areas (done for the Area Manager); should every report follow the same rule, enforced in one place?
6. Who may change designations (administrators only, or also the Area Manager for their area)?

## 8. Status of option B (22 Nov 2026)

Built and live in the code:

* `src/config/menu-access.ts`: the levels (view, operate, invoice, approve, admin), the module type and the designation matrix `MODULE_DESIGNATION_LEVELS`. **Service Orders is the first module on the matrix.**
* Every Service Orders menu item now carries a `level`; the section carries `module: 'SOD'`. The menu shows an item when the **capability allows it and the person's designation level in the module is high enough**. A person whose designations are not listed for the module (or an old session) is decided by the capability alone, so nothing disappears by accident.
* Login and refresh return `designations` (the base role and every module designation), the sidebar and the mobile menu pass them to the check.
* `tests/unit/menu-designation-matrix.test.ts` prints the matrix as assertions: Coordinator and QC 8 items, Engineer and Assistant 10, Area Manager 12, OSP Manager 10, administrators 12.
* `MODULE_DESIGNATION_GRANTS` (bootstrap) gives a module designation grants of its own on top of its base role (used for the project engineers).

Next modules to move onto the matrix (one at a time, each with its matrix test): Projects (PROJECTS_* designations), Inventory (view / operate / approve), Reports, ITMS and Fleet, then Finance, Procurement, SF Audit. Then the unused-role clean-up (section 7, question 4) once the decisions above are made.

### Inventory on the matrix (22 Nov 2026)

Level order for Inventory: view < approve < operate < admin. The store staff and administrators operate (19 items); the Area Manager, OSP Manager, Head of OSP and Head of Section approve (9 view items: balances, requisitions, material reports); Project Engineer designations view (the same 9); the base Engineer, Area Coordinator and QC Officer have no inventory capability and no menu. Measured on the 294 active users: 55 see 19 items, 168 see 9, no one's menu changed because of the levels (the matrix describes today's reality; from now on a change needs the table and the matrix test to change together).

### Projects on the matrix (22 Nov 2026)

Level order: view < operate < approve < admin. Project Engineer, Project Area/OSP Manager, OSP Engineer, Civil Supervisor and the managers approve; the Assistant Project Engineer, Project Area Coordinator, Project QC and the Cable Splicer operate; finance, invoice, stores, SF audit, procurement and service assurance designations view. "My Tasks" and "GIS File Import" need `operate`; the dashboards, the project list and the map need `view`. Measured on 294 users: 26 view-only people (stores, finance, cashier, invoice, service assurance) lose exactly one item, "My Tasks"; nobody else's menu changed. The three modules together for one person (Engineer + Project Engineer): Service Orders invoice, Projects approve, Inventory view.

### Reports, ITMS and Fleet on the matrix (22 Nov 2026)

* **Reports** (area < company < admin): Area Manager = Report Center, Contractor Scorecard, Area Performance, Daily Operational (own areas); OSP Manager, Manager, Head of Section, CEO, Regional General Manager add the Executive Overview.
* **ITMS** (view < operate < approve < admin): the area roles (Engineer, Assistant, Coordinator, QC, Area Manager, managers) raise tickets (User Portal, New Support Ticket); the office staff are IT staff (queue, assets, telemetry, SLA, licences, ITSM reports); the Physical Asset Audits need the approver (Office Admin, CEO).
* **Fleet** (view < operate < admin): the office staff and the CEO run the fleet and its payments; the Area Manager, OSP Manager, Manager and Regional General Manager see vehicles, drivers, trips and the fleet report but not **Fleet Payments** (4 Area Managers, 3 OSP Managers, 1 Regional General Manager lost that one item).

Measured on the 294 active users: Reports and ITMS menus did not change for anyone; the only change in this step is the Fleet Payments item for those eight managers. Decision for you: should the Area Manager keep Fleet Payments?
