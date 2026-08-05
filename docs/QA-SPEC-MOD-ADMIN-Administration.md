# SYSTEM PROCESS & WORKFLOW SPECIFICATION DOC 01
## Administration Module (MOD-ADMIN)

**Client / Enterprise Name:** Sri Lanka Telecom Services (SLTS)
**Project Name:** SLT ERP — Fiber Network Management & Service Order Platform
**Document Version / Date:** v1.0 | 05/08/2026
**Target System / Application:** SLTSERP (Next.js 16 + Supabase/PostgreSQL + BullMQ)

---

## 1. Document Overview & Purpose

This document captures the **As-Is State** of the Administration Module of the SLTSERP platform.
The Administration Module covers user account lifecycle management, role-based access control (RBAC),
staff hierarchy organization, system configuration, audit logging, and operational settings.

The QA team will use this as baseline to design test strategies for all admin workflows.

---

## 2. System Architecture & High-Level Scope

### 2.1 Application Overview — Administration Module

| Field | Detail |
|---|---|
| **Module Name** | Administration Panel (`/admin`) |
| **Primary User Roles** | SUPER_ADMIN, ADMIN, CEO, HEAD_OF_OSP (ADMINS group); OFFICE_ADMIN, OFFICE_ADMIN_ASSISTANT (limited access) |
| **Integrations / External APIs** | SLT Service Portal (iShamp), Microsoft O365 (bulk user import), SMTP (email notifications) |
| **Supported Platforms** | Chrome, Firefox, Edge (Web — no mobile app for admin functions) |
| **Environment Details** | Production: Vercel (Next.js serverless); DB: Supabase PostgreSQL; Workers: BullMQ + Redis |

### 2.2 Administration Sub-Module Inventory

| Module ID | Sub-Module | Route Path | Description | Dev Status | QA Scope |
|---|---|---|---|---|---|
| MOD-ADMIN-01 | Admin Dashboard | `/admin` | Central hub with stats (users, staff, RTOMs, contractors) and module cards | Completed | Yes |
| MOD-ADMIN-02 | User Management | `/admin/users` | Create, edit, delete, password reset, OPMC scope, store assignment for system users | Completed | Yes |
| MOD-ADMIN-03 | Bulk User Import | `/admin/users/import` | Import users from CSV or O365 directory | Completed | Yes |
| MOD-ADMIN-04 | Section Role Permissions | `/admin/roles` | Configure SystemRole permissions per department section | Completed | Yes |
| MOD-ADMIN-05 | Department Sections | `/admin/sections` | Manage organizational sections (PROJECTS, FINANCE, STORES, etc.) | Completed | Yes |
| MOD-ADMIN-06 | Staff Hierarchy Master | `/admin/staff` | Organize reporting structure, org chart, designations | Completed | Yes |
| MOD-ADMIN-07 | System Audit Log | `/admin/audit-logs` | View full system event log and user activity history | Completed | Yes |
| MOD-ADMIN-08 | System Health & Monitoring | `/admin/monitoring` | System health dashboard, worker status, sync stats | Completed | Yes |
| MOD-ADMIN-09 | RTOM Management | `/projects/opmcs` | Manage Regional Telecom Offices (OPMCs) and store assignments | Completed | Yes |
| MOD-ADMIN-10 | Store Management | `/inventory/stores` | Manage inventory stores and branch locations | Completed | Yes |
| MOD-ADMIN-11 | User Permissions | `/admin/user-permissions` | Configure per-user permission overrides | Completed | Yes |
| MOD-ADMIN-12 | Global Roles Defaults | `/admin/global-roles` | Set default permissions and section mappings for each role | Completed | Yes |
| MOD-ADMIN-13 | SOD Revenue Config | `/admin/sod-revenue` | Configure revenue amounts per service order type | Completed | Yes |
| MOD-ADMIN-14 | Contractor Pricing | `/admin/contractor-payment` | Set contractor payment rates and billing schedules | Completed | Yes |
| MOD-ADMIN-15 | Settings (Table Config) | `/admin/settings` | Configure column visibility and order for data tables | Completed | Yes |
| MOD-ADMIN-16 | Process Gates Engine | `/admin/settings/process-gates` | Configure FSM interception rules for status transitions | Completed | Yes |
| MOD-ADMIN-17 | SMTP Email Config | `/admin/settings/smtp` | Configure outbound email server settings | Completed | Yes |
| MOD-ADMIN-18 | SOD Bulk Import | `/service-orders/import` | Import historical service order data from spreadsheets | Completed | Yes |
| MOD-ADMIN-19 | Phoenix Bridge Monitor | `/admin/test-extension` | System bridge diagnostic terminal | Completed | Yes |

---

## 3. End-to-End Business Process Workflows

### Workflow 01: User Account Creation

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 1.1 | SUPER_ADMIN / ADMIN | Navigate to `/admin/users`, click "New User" | Opens user creation drawer with form fields: username, email, name, role, employee ID, password, OPMC scope, store assignment, supervisor | User must have `administration` permission | Drawer opened |
| 1.2 | SUPER_ADMIN / ADMIN | Fill and submit user creation form | System hashes password (bcrypt, 10 rounds), creates User record with UUID v7, auto-creates Staff record if employeeId provided, creates Section and SystemRole if needed, creates UserSectionAssignment | Username must be unique; email must be unique; employeeId must be unique; certain roles (MANAGER, SA_MANAGER, SA_ASSISTANT) require at least one OPMC assignment | User created with `mustChangePassword=true` |
| 1.3 | System (post-create) | Auto-notification | System creates AuditLog entry (action: USER_CREATE) and sends in-app notification to new user: "Welcome to SLT ERP" | Notification system must be active | AuditLog + Notification created |
| 1.4 | New User | First login | System authenticates, returns JWT + `mustChangePassword: true` flag | Password validated via bcrypt compare; user status must be `active` | User redirected to password change screen |

### Workflow 02: User Edit & Role Change

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 2.1 | SUPER_ADMIN / ADMIN | Click edit icon on user row | Opens drawer pre-filled with user data | — | Edit form displayed |
| 2.2 | SUPER_ADMIN / ADMIN | Change role and save | System updates User.role, updates Section mappings based on new role, creates/updates UserSectionAssignment records | SUPER_ADMIN role cannot be demoted to any other role (throws CANNOT_DEMOTE_SUPER_ADMIN) | User role updated; section assignments re-mapped |
| 2.3 | SUPER_ADMIN / ADMIN | Change password via admin reset | System hashes new password, sets `mustChangePassword=true` | Password must be >= 4 characters (admin UI) or >= 6 characters (self-service reset) | Password updated; user must change on next login |

### Workflow 03: Section Assignment Management

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 3.1 | SUPER_ADMIN / ADMIN | Add section assignment to user | System creates UserSectionAssignment with isPrimary flag, links to SystemRole for that section | Primary section assignment must exist; non-primary assignments are additive | Section assignment created |
| 3.2 | SUPER_ADMIN / ADMIN | Remove non-primary section | System deletes UserSectionAssignment record | Cannot remove primary section assignment (`!existing.isPrimary` check) | Section access removed |
| 3.3 | System | Derive permissions on login | Permissions derived from: (1) User.permissions override, or (2) union of all SystemRole.permissions from sectionAssignments, or (3) empty (helpdesk-only) | Priority: explicit user.permissions > sectionAssignment roles > empty | User sees only modules matching their permissions |

### Workflow 04: Password Reset (Admin-Initiated)

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 4.1 | SUPER_ADMIN / ADMIN | Click key icon on user row | Opens quick password reset dialog | — | Dialog displayed |
| 4.2 | SUPER_ADMIN / ADMIN | Enter new password (min 4 chars) and click "Update Password" | Calls `POST /api/users/{userId}/reset-password` — hashes password, sets `mustChangePassword=true` | Password minimum 4 characters; target user must exist | Password updated; user prompted to change on next login |

### Workflow 05: Password Reset (Self-Service / Forgot Password)

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 5.1 | Any User | Click "Forgot password?" on login page | Redirects to `/forgot-password` — Step 1: enter username + employee ID | Username must exist; employeeId must match | 15-minute JWT token issued (step: 'verify'); security question displayed |
| 5.2 | Any User | Answer security question | System verifies answer (bcrypt compare, case-insensitive); issues reset token | Answer must match stored hash; token valid for 15 minutes | Reset token issued (step: 'reset') |
| 5.3 | Any User | Enter new password + confirm | System hashes new password, updates User record | Password >= 6 characters; both fields must match | Password updated; user redirected to login |

### Workflow 06: User Deletion

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 6.1 | SUPER_ADMIN / ADMIN | Click delete icon on user row | Opens confirmation alert with user name display | — | Confirmation dialog shown |
| 6.2 | SUPER_ADMIN / ADMIN | Confirm deletion | Calls DELETE — removes user record permanently | AuditLog records the deletion | User permanently deleted |

### Workflow 07: Role & Permission Configuration

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 7.1 | SUPER_ADMIN / ADMIN | Navigate to `/admin/roles` | Displays all SystemRoles grouped by section, with user count per role | — | Role list displayed |
| 7.2 | SUPER_ADMIN / ADMIN | Edit role permissions | Updates SystemRole.permissions JSON array | Only valid permission keys accepted: `dashboard`, `service-orders`, `contractors`, `restore-requests`, `invoices`, `inventory`, `procurement`, `administration` | Role permissions updated; affects all users with that role on next login |
| 7.3 | SUPER_ADMIN / ADMIN | Create new role | Creates SystemRole with name, code (auto-uppercased), sectionId, description, level, permissions | Code must be unique; permissions validated against allowlist | New role created; assignable to users |

### Workflow 08: System Config Modification

| Step # | Actor / Role | System Action / Trigger | Expected System Behavior | Business Rules & Validations | Post-Condition / Output |
|---|---|---|---|---|---|
| 8.1 | SUPER_ADMIN | Navigate to System Config / Global Roles | Displays current SystemSetting key-value pairs | — | Config displayed |
| 8.2 | SUPER_ADMIN | Update a config value | POST to `/api/admin/system-config` — updates SystemSetting record | Only SUPER_ADMIN can modify (role check: `ROLE_GROUPS.SUPER_ADMINS`); Zod validates key (1-100 chars) and value (string/number/boolean) | Config updated; AuditLog entry created |

---

## 4. User Roles, Designations & Security Rules (RBAC & Operations)

### 4.1 Role Hierarchy & Designation Permission Mapping

| User Designation / Role | Hierarchy Level | Module / Section Access | Assigned Action Levels |
|---|---|---|---|
| SUPER_ADMIN | Level 0 (Highest) | ALL sections: Admin, Projects, New Connection, Service Assurance, Stores, Procurement, Finance, Invoice, Office Admin | Full CRUD; system config; user management; destructive operations |
| ADMIN | Level 1 | ALL sections (same as SUPER_ADMIN except system config modification) | Full CRUD; user management; cannot modify SystemSetting |
| CEO | Level 2 (Executive) | Dashboard, all operational views (read-heavy) | Read; approval authority |
| HEAD_OF_OSP | Level 2 (Executive) | Dashboard, all OSP & operational views | Read; approval authority |
| OSP_MANAGER | Level 3 | Dashboard, Service Orders, Contractors, Projects/OPMCs | CRUD on service orders and contractors |
| AREA_MANAGER | Level 3 | Dashboard, Service Orders, Contractors | CRUD on service orders and contractors (area-scoped) |
| ENGINEER / ASSISTANT_ENGINEER | Level 4 | Dashboard, Service Orders, Contractors | Read + limited write on service orders |
| AREA_COORDINATOR | Level 4 | Dashboard, Service Orders, Contractors | Read + coordination workflows |
| QC_OFFICER | Level 4 | Dashboard, Service Orders, Contractors | Read + QC verification workflows |
| STORES_MANAGER | Level 3 | Dashboard, Inventory | Full inventory operations; store management |
| STORES_ASSISTANT | Level 4 | Dashboard, Inventory | Inventory operations (store-scoped) |
| FINANCE_MANAGER | Level 3 | Dashboard, Invoices | Financial approvals; invoice management |
| FINANCE_ASSISTANT | Level 4 | Dashboard, Invoices | Invoice processing (read + limited write) |
| PROCUREMENT_OFFICER | Level 4 | Dashboard, Procurement | Procurement workflows |
| SA_MANAGER / SA_ASSISTANT | Level 3-4 | Dashboard, Service Assurance | Service assurance workflows; requires OPMC assignment |
| OFFICE_ADMIN | Level 3 | Dashboard, Office Admin, limited Admin panel access | Office asset management; admin panel read |
| OFFICE_ADMIN_ASSISTANT | Level 4 | Dashboard, Office Admin, limited Admin panel access | Office operations support |
| INVOICE_MANAGER / INVOICE_ASSISTANT | Level 3-4 | Dashboard, Invoice | Invoice section operations |
| SF_AUDIT_MANAGER / SF_AUDIT_OFFICER / RATE_AUDITOR | Level 3-4 | Dashboard, SF Audit | Audit and rate verification workflows |

### 4.2 Operational Security, Authentication & Session Rules

| Security Specification Area | Client Business Rules & System Behavior | QA Verification Criteria |
|---|---|---|
| **User Login Flow** | User submits username + password via `/login` → Middleware verifies JWT from HTTP-only cookie (or Authorization Bearer header) → Sets `x-user-id` and `x-user-role` headers for downstream API handlers → JWT expires in 24 hours | Verify login with valid/invalid credentials; verify JWT cookie is httpOnly; verify 401 redirect on expired token |
| **First-Time Login / Password Reset** | Admin creates user with initial password → `mustChangePassword` flag set to `true` → User must change password on first login | Verify mustChangePassword flag returned in login response; verify user is redirected to password change screen |
| **Permission Management Flow** | Permissions derived from SystemRole.permissions via sectionAssignments (priority: explicit user.permissions > sectionAssignment union > empty/helpdesk-only) → Changes take effect on next login (no hot-reload) | Verify user with `administration` permission can access `/admin/*`; verify user without it gets 403; verify permission union from multiple section assignments |
| **Password Policy** | Admin reset: minimum 4 characters; Self-service (forgot password): minimum 6 characters; Passwords hashed with bcrypt (10 rounds); Security question answer verified case-insensitively | Verify minimum length enforcement on both paths; verify bcrypt hashing (no plaintext storage) |
| **Forgot Password Flow** | 3-step: (1) Username + Employee ID verification → (2) Security question answer → (3) Set new password; Each step issues a JWT token valid for 15 minutes | Verify all 3 steps sequentially; verify token expiry after 15 minutes; verify invalid answer rejection |
| **Session Timeout** | Client-side inactivity detection: 30 minutes of no mouse/keyboard/scroll/touch/click events → auto-logout redirect to `/login` | Verify auto-logout after 30 min inactivity; verify timer resets on user activity; verify excluded on `/login` and `/contractor/login` paths |
| **JWT Token Management** | JWT signed with `JWT_SECRET` (env variable — fail-closed: `requireEnv()` throws if missing); Token contains: userId, username, role, contractorId; Cookie: httpOnly, sameSite=lax, maxAge=86400 (24h) | Verify token structure; verify JWT_SECRET missing causes startup failure (not silent default) |
| **Rate Limiting** | Login: 10 requests per 60 seconds per IP; Forgot password (all 3 steps): 10 requests per 60 seconds each; Agent login: 10 per 60 seconds | Verify 429 response after 11th request within 60s window |
| **Header Spoofing Protection** | Middleware strips `x-user-id`, `x-user-role`, `x-contractor-id` from ALL incoming requests before JWT verification → only sets them from verified JWT payload | Verify spoofed headers are stripped; verify only JWT-derived values reach API handlers |
| **RBAC Enforcement** | API handlers use `apiHandler()` wrapper with `roles` array → fail-closed: if user role not in allowed list, returns 403 `FORBIDDEN`; Page routes use `RoleGuard` client component | Verify 403 for unauthorized role on protected API; verify page redirect/guard for unauthorized access |
| **Idempotency (Financial Writes)** | Financial write operations require `x-idempotency-key` header; Redis-backed lock with 86400s TTL; duplicate keys return 409 `IDEMPOTENCY_CONFLICT` | Verify missing key returns 400; verify duplicate key returns 409; verify first request succeeds |
| **Cache Control** | All authenticated page responses include `Cache-Control: no-store, no-cache`, `Pragma: no-cache`, `Surrogate-Control: no-store` to prevent back-button stale pages | Verify browser back button does not show cached authenticated pages |

---

## 5. Exception Paths & Edge Case Matrix

| Ref Step # | Exception Trigger / Condition | Expected System Handling & Error Message | Recovery Path / Fallback |
|---|---|---|---|
| 1.2 | Username already exists | Returns Prisma unique constraint error; API returns descriptive error | Admin corrects username and retries |
| 1.2 | Email already exists | Returns Prisma unique constraint error | Admin corrects email and retries |
| 1.2 | Employee ID already exists | Returns Prisma unique constraint error | Admin verifies existing employee |
| 1.2 | Role requires OPMC but none assigned | Returns "OPMC selection is required for this role" | Admin assigns at least one OPMC |
| 2.2 | Attempt to demote SUPER_ADMIN | Returns `CANNOT_DEMOTE_SUPER_ADMIN` error; blocked | Operation rejected; SUPER_ADMIN status preserved |
| 4.2 | Password < 4 characters | Client-side validation: "Password must be at least 4 characters" | User enters valid password |
| 5.1 | Username not found | Returns `USER_NOT_FOUND` (generic "Invalid credentials" not leaked to UI for forgot-password; specific error shown) | User verifies username |
| 5.1 | Employee ID mismatch | Returns `EMPLOYEE_ID_MISMATCH` | User corrects employee ID |
| 5.2 | Incorrect security answer | Returns `INCORRECT_ANSWER`; bcrypt compare fails | User retries or contacts admin for manual reset |
| 5.2 | Token expired (15 min) | JWT verify throws `INVALID_TOKEN` | User restarts forgot-password flow |
| 5.3 | Password < 6 characters | Returns `PASSWORD_TOO_SHORT` | User enters valid password |
| Login | Invalid credentials (wrong username or password) | Returns generic `INVALID_CREDENTIALS` (no information leakage about which field is wrong) | User retries |
| Login | User status is not `active` | Returns `INVALID_CREDENTIALS` (same generic message) | Admin activates user account |
| Login | Rate limit exceeded (10/60s) | Returns 429 `RATE_LIMIT_EXCEEDED` | Wait for window to expire |
| Any API | Unauthenticated request (no token/expired) | Middleware returns 401 `Authentication required` for `/api/*`; redirects to `/login` for page routes | User logs in |
| Any API | Insufficient role | `apiHandler` returns 403 `Forbidden: insufficient role` | User requests access from admin |
| 7.2 | Invalid permission key in role update | `assertValidPermissionsJson` rejects with "Unknown permission key: {key}" | Admin uses only valid keys from allowlist |
| 7.2 | Malformed JSON in permissions | Returns "Permissions must be a valid JSON array string" | Admin corrects format |
| System Config | Non-SUPER_ADMIN attempts config change | Returns 403 "Only Super Admins can modify system config" | Request denied |

---

## 6. Test Data & Dependency Prerequisites

| Module / Feature | Required User Role / Permissions | Prerequisite Data Inputs | Notes / Dependency |
|---|---|---|---|
| User Management (CRUD) | SUPER_ADMIN or ADMIN with `administration` permission | At least one active SUPER_ADMIN account; test OPMC records; test Section records | Requires active Supabase connection; bcrypt available |
| User Login | Any active user | Test accounts: `admin`, `testadmin`, `ospmanager`, `areamanager`, `storesmanager`, `coordinator`, `qcofficer`, `finance`, `stores`, `engineer` | JWT_SECRET env variable must be set |
| Forgot Password | Any user with securityQuestion + securityAnswer set | Pre-configured security question/answer on test account | SMTP configured if email notifications required |
| Role/Permission Config | SUPER_ADMIN or ADMIN | Pre-existing Section and SystemRole records | Permission keys limited to: `dashboard`, `service-orders`, `contractors`, `restore-requests`, `invoices`, `inventory`, `procurement`, `administration` |
| System Config | SUPER_ADMIN only | Pre-existing SystemSetting records | Redis required for idempotency checks on financial writes |
| Bulk User Import | SUPER_ADMIN or ADMIN | CSV file with user data OR O365 API credentials configured | O365 import requires `import-o365-users.ts` script |
| Audit Log Review | SUPER_ADMIN or ADMIN | Pre-existing AuditLog entries (auto-generated by system operations) | Read-only; no data creation needed |
| Session Timeout | Any authenticated user | — | Client-side: 30-minute inactivity timer; verify on Chrome/Firefox/Edge |
| Rate Limiting | — | Redis must be available for rate limit counters | 10 requests/60 seconds per IP per endpoint |

---

## Appendix: Role Categories (UI Grouping)

```
System Admin:       SUPER_ADMIN, ADMIN
Main Management:    CEO, HEAD_OF_OSP, HEAD_OF_SECTION, OSP_MANAGER, MANAGER
OSP & Operations:   AREA_MANAGER, ENGINEER, ASSISTANT_ENGINEER, AREA_COORDINATOR,
                    QC_OFFICER, OSP_ENGINEER, CIVIL_SUPERVISOR, CABLE_SPLICER
Stores & Inventory: STORES_MANAGER, STORES_ASSISTANT
Finance:            FINANCE_MANAGER, FINANCE_ASSISTANT, CASHIER, AR_OFFICER
Invoice Section:    INVOICE_MANAGER, INVOICE_ASSISTANT
Service Assurance:  SA_MANAGER, SA_ASSISTANT, FAULT_COORDINATOR, REPAIR_TECHNICIAN
SF Audit Section:   SF_AUDIT_MANAGER, SF_AUDIT_OFFICER, RATE_AUDITOR
Office Admin:       OFFICE_ADMIN, OFFICE_ADMIN_ASSISTANT, SITE_OFFICE_STAFF
Procurement:        PROCUREMENT_OFFICER
```

## Appendix: Valid Permission Keys

```
dashboard, service-orders, contractors, restore-requests,
invoices, inventory, procurement, administration
```

## Appendix: Key File References

| Component | File Path |
|---|---|
| Admin Panel Page | `src/app/admin/page.tsx` |
| User Management UI | `src/app/admin/users/page.tsx` |
| Login Page | `src/app/login/page.tsx` |
| Login API | `src/app/api/login/route.ts` |
| Forgot Password | `src/app/forgot-password/page.tsx` |
| User Service (auth + CRUD) | `src/services/hr/user.service.ts` |
| Role Service | `src/services/admin/role.service.ts` |
| Role Config | `src/config/roles.ts` |
| Auth Defaults | `src/config/auth-defaults.ts` |
| Middleware (JWT verify) | `src/middleware.ts` |
| JWT Sign/Verify | `src/lib/auth.ts` |
| Session Manager | `src/components/SessionManager.tsx` |
| API Handler (RBAC) | `src/lib/api-handler.ts` |
| Rate Limiter | `src/lib/rate-limiter.ts` |
| Sidebar Menu Config | `src/config/sidebar-menu.ts` |
| User Prisma Schema | `prisma/schema/user.prisma` |
| System Config API | `src/app/api/admin/system-config/route.ts` |
