import { Role } from '@prisma/client';
import { RBAC_PERMISSIONS, type RbacPermission } from './rbac-permissions';
import { menuLevelPermission, type AccessLevel, type MenuModule } from './menu-access';

/**
 * Initial capability grants for a fresh or upgraded database.
 *
 * This is a deployment/bootstrap catalog only. Runtime authorization reads
 * PermissionDefinition + RolePermission rows and never imports this file.
 * Keep this catalog explicit so a future role/group rename cannot silently
 * change live access without a deliberate seed review.
 */
const BASE_BOOTSTRAP_ROLE_GRANTS = {
    [RBAC_PERMISSIONS.DASHBOARD_READ]: Object.values(Role),
    [RBAC_PERMISSIONS.SOD_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER',
        'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER',
        'SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN',
        'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER',
    ],
    [RBAC_PERMISSIONS.SOD_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER',
        'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR',
        'QC_OFFICER',
        'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
    ],
    [RBAC_PERMISSIONS.SOD_INVOICE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP',
        'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
        'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER',
        'MANAGER',
    ],
    [RBAC_PERMISSIONS.PROJECT_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER',
        'AREA_MANAGER',
        'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER',
        'SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
        'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
        'STORES_MANAGER', 'STORES_EXECUTIVE', 'STORES_ASSISTANT', 'PROCUREMENT_OFFICER',
    ],
    [RBAC_PERMISSIONS.PROJECT_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER',
    ],
    [RBAC_PERMISSIONS.PROJECT_APPROVE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER',
        'AREA_MANAGER', 'OSP_ENGINEER',
        'CIVIL_SUPERVISOR', 'FINANCE_MANAGER', 'STORES_MANAGER',
    ],
    [RBAC_PERMISSIONS.PROJECT_PLAN_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER',
        'AREA_MANAGER',
        'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER',
        'SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
        'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
        'STORES_MANAGER', 'STORES_EXECUTIVE', 'STORES_ASSISTANT', 'PROCUREMENT_OFFICER',
    ],
    [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER',
        'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER',
    ],
    [RBAC_PERMISSIONS.PROJECT_PLAN_APPROVE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER',
        'AREA_MANAGER', 'OSP_ENGINEER',
        'CIVIL_SUPERVISOR', 'FINANCE_MANAGER', 'STORES_MANAGER',
    ],
    [RBAC_PERMISSIONS.FINANCE_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
        'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
        'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER', 'RATE_AUDITOR',
    ],
    [RBAC_PERMISSIONS.FINANCE_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
    ],
    [RBAC_PERMISSIONS.FINANCE_APPROVE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'STORES_MANAGER',
    ],
    [RBAC_PERMISSIONS.FINANCE_AUDIT]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'RATE_AUDITOR',
    ],
    [RBAC_PERMISSIONS.FINANCE_HO_SUBMIT]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
    ],
    [RBAC_PERMISSIONS.FINANCE_HO_CONFIRM]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER',
    ],
    // The Area Coordinator and the QC Officer do the same job on the order approvals and cover for each other, so each holds both steps
    [RBAC_PERMISSIONS.INVOICE_CONFIRM_COORDINATOR]: ['SUPER_ADMIN', 'ADMIN', 'AREA_COORDINATOR', 'QC_OFFICER'],
    // the Engineer and Assistant Engineer cover the Area Coordinator / QC Officer: they may pass the Completed SOD check too
    [RBAC_PERMISSIONS.INVOICE_CONFIRM_QC]: ['SUPER_ADMIN', 'ADMIN', 'QC_OFFICER', 'AREA_COORDINATOR', 'ENGINEER', 'ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.INVOICE_CONFIRM_ENGINEER]: ['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER]: ['SUPER_ADMIN', 'ADMIN', 'AREA_MANAGER'],
    [RBAC_PERMISSIONS.INVOICE_OSP_APPROVE]: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'HEAD_OF_OSP'],
    [RBAC_PERMISSIONS.PROJECT_FINANCE_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
        'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER', 'RATE_AUDITOR',
    ],
    [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER',
    ],
    [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'STORES_MANAGER',
    ],
    [RBAC_PERMISSIONS.PROJECT_FINANCE_ASSIGN]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER',
        'FINANCE_MANAGER', 'STORES_MANAGER',
    ],
    [RBAC_PERMISSIONS.INVENTORY_READ]: [
        // the SOD Engineer and Assistant Engineer have no store or fleet work: their contractors' material is on Contractors & Stock
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'HEAD_OF_SECTION', 'OSP_MANAGER', 'AREA_MANAGER', 'MANAGER',
        'STORES_MANAGER', 'STORES_EXECUTIVE', 'STORES_ASSISTANT',
        // read only: stock valuation and consumption cost for the finance people (their data scope is scope.inventory.all)
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT',
    ],
    [RBAC_PERMISSIONS.INVENTORY_COST_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'MANAGER',
        'FINANCE_MANAGER', 'STORES_MANAGER', 'STORES_EXECUTIVE',
    ],
    [RBAC_PERMISSIONS.INVENTORY_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_EXECUTIVE', 'STORES_ASSISTANT',
    ],
    [RBAC_PERMISSIONS.INVENTORY_APPROVE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'HEAD_OF_SECTION', 'OSP_MANAGER', 'AREA_MANAGER',
        // the Stores Executive is the Stores Manager's deputy: approves and rejects when there is no Manager
        'STORES_MANAGER', 'STORES_EXECUTIVE', 'PROCUREMENT_OFFICER',
    ],
    // The Stores Executive reviews a request (adjusts the quantities) before the approval; everyone who approves requests can adjust too (the Procurement Officer
    // stands in when there is no Stores Manager). The Executive has no inventory.approve, so cannot approve or reject.
    [RBAC_PERMISSIONS.INVENTORY_REVIEW]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'HEAD_OF_SECTION', 'OSP_MANAGER', 'AREA_MANAGER', 'STORES_MANAGER', 'STORES_EXECUTIVE', 'PROCUREMENT_OFFICER',
    ],
    // Stock adjustments (contractor wastage): the Stores Executive and the Stores Manager, and the CEO; not the store officers.
    // Goods receipt: the Stores Executive and the Stores Manager (and the CEO and admins); not the store officers.
    // Master data (item master, stores): the Executive, the Manager, the CEO and admins.
    [RBAC_PERMISSIONS.INVENTORY_MASTER]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_EXECUTIVE'],
    // CPE serials from the SLT CPE Locator (owner, 28 Nov 2026): the service order people of the RTOM and the stores see the register;
    // the Area Coordinator and the QC Officer record small quantities SLT hands straight to a contractor, the stores record bundles
    [RBAC_PERMISSIONS.INVENTORY_CPE_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER',
        'STORES_MANAGER', 'STORES_EXECUTIVE', 'STORES_ASSISTANT',
    ],
    [RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE]: ['SUPER_ADMIN', 'ADMIN', 'AREA_COORDINATOR', 'QC_OFFICER', 'STORES_MANAGER', 'STORES_EXECUTIVE'],
    // the site office people who may be made custodian of a box, the Area Manager who approves its releases, and the finance people who watch and fund it
    [RBAC_PERMISSIONS.PETTY_CASH_SITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'SITE_OFFICE_STAFF', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER',
    ],
    [RBAC_PERMISSIONS.INVENTORY_RELEASE]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_EXECUTIVE'],
    [RBAC_PERMISSIONS.INVENTORY_GRN]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_EXECUTIVE'],
    [RBAC_PERMISSIONS.INVENTORY_ADJUST]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_EXECUTIVE'],
    [RBAC_PERMISSIONS.PROCUREMENT_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'PROCUREMENT_OFFICER',
        // read only: purchase orders and supplier invoices are money the finance people pay
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT',
    ],
    [RBAC_PERMISSIONS.PROCUREMENT_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'PROCUREMENT_OFFICER',
    ],
    // the purchase order chain: OSP Manager, then Head of OSP, then the Finance Manager. Nobody else holds a step, so no one can approve alone.
    // HO payments on vouchers are recorded by the Account Executive designation only (see MODULE_DESIGNATION_GRANTS), never by a whole base role
    [RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD]: [],
    // the company's vendor voucher chain after the OSP Account Manager, and the documents check before HO; the OSP Manager and the Head of Section
    // sign the vouchers and follow what HO paid on them (Vendor Payment Status). The OSP Account Manager holds it through the Finance Manager role.
    [RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ]: ['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'OSP_MANAGER', 'HEAD_OF_SECTION'],
    [RBAC_PERMISSIONS.CONTRACTOR_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'OSP_MANAGER', 'AREA_MANAGER',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'SITE_OFFICE_STAFF', 'ENGINEER', 'ASSISTANT_ENGINEER',
        'AREA_COORDINATOR', 'MANAGER', 'QC_OFFICER', 'STORES_MANAGER', 'STORES_EXECUTIVE',
        'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE',
    ],
    [RBAC_PERMISSIONS.CONTRACTOR_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE',
    ],
    [RBAC_PERMISSIONS.HELPDESK_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER',
        'ASSISTANT_ENGINEER',
        'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF',
    ],
    // every role that works in the field or an area may raise a support ticket (the User Portal and New Support Ticket); the IT queue is for IT staff
    // Data scope (see docs/authorization-architecture.md): these never grant a function, only which OPMCs' rows the holder's functions apply to.
    [RBAC_PERMISSIONS.SCOPE_COMPANY_ALL]: ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER'],
    [RBAC_PERMISSIONS.SCOPE_SOD_ALL]: ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER'],
    // project money (budgets, costs, invoices, vouchers) is read by every finance role, so they see the projects of every region
    [RBAC_PERMISSIONS.SCOPE_PROJECT_ALL]: ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER'],
    // the Finance Manager and Assistant read purchase orders / supplier invoices, contractor balances and stock valuation (read only) in every region
    [RBAC_PERMISSIONS.SCOPE_PROCUREMENT_ALL]: ['FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    [RBAC_PERMISSIONS.SCOPE_CONTRACTOR_ALL]: ['FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    [RBAC_PERMISSIONS.PROJECT_FINANCE_DASHBOARD]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER',
        'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER', 'RATE_AUDITOR',
    ],
    [RBAC_PERMISSIONS.INVOICE_STATUS_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER',
        'SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER',
        'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER',
    ],
    // the Stores Manager runs every store of the island and the Stores Executive, as the Manager's deputy, works in every store too; the officers work in the stores they are assigned to.
    // (The Procurement Officer sees every store for the purchase requests it approves.)
    // the Head of Section and the OSP Manager approve for every site office store, so they see all of them without being assigned one by one
    [RBAC_PERMISSIONS.SCOPE_INVENTORY_ALL]: ['CEO', 'HEAD_OF_OSP', 'HEAD_OF_SECTION', 'OSP_MANAGER', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'STORES_MANAGER', 'STORES_EXECUTIVE', 'PROCUREMENT_OFFICER'],
    [RBAC_PERMISSIONS.SCOPE_REPORTS_ALL]: ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER'],
    [RBAC_PERMISSIONS.SCOPE_FINANCE_ALL]: [
        'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER',
        'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER',
    ],
    [RBAC_PERMISSIONS.HELPDESK_TICKET_CREATE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER',
        'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF',
    ],
    [RBAC_PERMISSIONS.HELPDESK_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF',
    ],
    [RBAC_PERMISSIONS.HELPDESK_APPROVE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'OFFICE_ADMIN', 'FINANCE_MANAGER', 'STORES_MANAGER',
    ],
    [RBAC_PERMISSIONS.FLEET_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER',
        'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF',
    ],
    [RBAC_PERMISSIONS.FLEET_WRITE]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF',
    ],
    [RBAC_PERMISSIONS.REPORTS_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER', 'HEAD_OF_SECTION',
    ],
    [RBAC_PERMISSIONS.REPORTS_MANAGER_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'MANAGER', 'HEAD_OF_SECTION',
    ],
    [RBAC_PERMISSIONS.REPORTS_AREA_READ]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'MANAGER', 'AREA_MANAGER', 'HEAD_OF_SECTION',
    ],
    [RBAC_PERMISSIONS.AI_CUSTODY_EXECUTE]: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'],
    [RBAC_PERMISSIONS.AI_STOCK_EXECUTE]: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'STORES_EXECUTIVE', 'STORES_ASSISTANT', 'OSP_MANAGER'],
    [RBAC_PERMISSIONS.NOTIFICATION_GLOBAL]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'],
    [RBAC_PERMISSIONS.NOTIFICATION_ADMINISTRATORS]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'],
    [RBAC_PERMISSIONS.NOTIFICATION_PROJECT_MANAGERS]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    [RBAC_PERMISSIONS.NOTIFICATION_STORES_MANAGERS]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_EXECUTIVE', 'HEAD_OF_OSP'],
    [RBAC_PERMISSIONS.NOTIFICATION_OFFICE_ADMINS]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    [RBAC_PERMISSIONS.NOTIFICATION_OPERATIONS]: ['OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
    [RBAC_PERMISSIONS.NOTIFICATION_SOD_PROJECT]: [
        'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER',
        'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER',
    ],
    // the weekly digest is company-wide, so it goes to the managers who read the company: not to the area engineers, coordinators and QC officers
    [RBAC_PERMISSIONS.NOTIFICATION_OPS_DIGEST]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'HEAD_OF_SECTION', 'MANAGER'],
    [RBAC_PERMISSIONS.NOTIFICATION_FINANCE_APPROVERS]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'STORES_MANAGER'],
    [RBAC_PERMISSIONS.NOTIFICATION_FINANCE_ALL]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    [RBAC_PERMISSIONS.NOTIFICATION_INVENTORY_LOW_STOCK]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_EXECUTIVE', 'HEAD_OF_OSP', 'OSP_MANAGER'],
    [RBAC_PERMISSIONS.NOTIFICATION_INVENTORY_ALERT_EMAIL]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'STORES_MANAGER', 'OSP_MANAGER'],
    [RBAC_PERMISSIONS.NOTIFICATION_STOCK_REQUEST_ARM]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    [RBAC_PERMISSIONS.NOTIFICATION_STOCK_REQUEST_PROCUREMENT]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'PROCUREMENT_OFFICER', 'STORES_MANAGER'],
    // the IT staff who work the queue (the page behind the notice, /helpdesk/admin, needs helpdesk.write); the field engineers raise tickets and do not get every new one
    [RBAC_PERMISSIONS.NOTIFICATION_HELPDESK_TICKET_MANAGERS]: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    [RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_OSP_MANAGER]: ['OSP_MANAGER'],
    [RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_HEAD_OF_SECTION]: ['HEAD_OF_SECTION'],
    [RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_PROCUREMENT]: ['PROCUREMENT_OFFICER'],
    [RBAC_PERMISSIONS.NOTIFICATION_PROCESS_GATE_STORES]: ['STORES_MANAGER', 'STORES_EXECUTIVE'],
    // the three who sign an OSP vendor voucher learn what HO paid on it (the OSP Account Manager: MODULE_DESIGNATION_GRANTS)
    [RBAC_PERMISSIONS.NOTIFICATION_OSP_VENDOR_PAYMENTS]: ['OSP_MANAGER', 'HEAD_OF_SECTION'],
    [RBAC_PERMISSIONS.ADMIN_RBAC]: ['SUPER_ADMIN', 'ADMIN'],
    [RBAC_PERMISSIONS.ADMIN_SUPER]: ['SUPER_ADMIN'],
} as const satisfies Partial<Record<RbacPermission, readonly Role[]>>;

/**
 * The starting menu level of each role (a post) and module designation, per module. A role with no entry for a module holds no level
 * for it, and the page capability alone decides. This is the only place the levels are written as role names: they are turned into the
 * capabilities menu.<module>.<level> below, and from the seed on the database decides (an administrator changes them like any grant).
 */
export const BOOTSTRAP_MENU_LEVELS: Readonly<Record<MenuModule, Readonly<Record<string, AccessLevel>>>> = {
    // Service orders. Coordinators and QC check the finished orders; engineers also invoice; the Area Manager also approves.
    SOD: {
        SUPER_ADMIN: 'admin', ADMIN: 'admin',
        AREA_MANAGER: 'approve',
        ENGINEER: 'invoice', ASSISTANT_ENGINEER: 'invoice', OSP_MANAGER: 'invoice', HEAD_OF_OSP: 'invoice', CEO: 'invoice',
        AREA_COORDINATOR: 'operate', QC_OFFICER: 'operate',
        OSP_ENGINEER: 'operate', CIVIL_SUPERVISOR: 'operate', CABLE_SPLICER: 'operate',
        SA_MANAGER: 'operate', SA_ASSISTANT: 'operate', FAULT_COORDINATOR: 'operate', REPAIR_TECHNICIAN: 'operate',
    },
    // Inventory. The stores run the store; the managers approve requests and read balances; the project engineers draw project material.
    INVENTORY: {
        SUPER_ADMIN: 'admin', ADMIN: 'admin',
        CEO: 'operate', STORES_MANAGER: 'operate', STORES_EXECUTIVE: 'operate', STORES_ASSISTANT: 'operate',
        AREA_MANAGER: 'approve', OSP_MANAGER: 'approve', HEAD_OF_OSP: 'approve', HEAD_OF_SECTION: 'approve',
        MANAGER: 'view', REGIONAL_GENERAL_MANAGER: 'view',
        PROJECTS_ENGINEER: 'view', PROJECTS_ASSISTANT_ENGINEER: 'view',
    },
    // Projects. The project engineers and the managers run and approve projects; the finance, stores, audit and service assurance people read them.
    PROJECTS: {
        SUPER_ADMIN: 'admin', ADMIN: 'admin',
        CEO: 'approve', HEAD_OF_OSP: 'approve', MANAGER: 'approve', OSP_MANAGER: 'approve', AREA_MANAGER: 'approve',
        PROJECTS_ENGINEER: 'approve', PROJECTS_AREA_MANAGER: 'approve', PROJECTS_OSP_MANAGER: 'approve', OSP_ENGINEER: 'approve', CIVIL_SUPERVISOR: 'approve',
        PROJECTS_ASSISTANT_ENGINEER: 'operate', PROJECTS_AREA_COORDINATOR: 'operate', PROJECTS_QC_OFFICER: 'operate', CABLE_SPLICER: 'operate',
        FINANCE_MANAGER: 'view', FINANCE_ASSISTANT: 'view', CASHIER: 'view', INVOICE_MANAGER: 'view', INVOICE_ASSISTANT: 'view', AR_OFFICER: 'view',
        SF_AUDIT_MANAGER: 'view', SF_AUDIT_OFFICER: 'view', RATE_AUDITOR: 'view', STORES_MANAGER: 'view', STORES_EXECUTIVE: 'view', STORES_ASSISTANT: 'view', PROCUREMENT_OFFICER: 'view',
        SA_MANAGER: 'view', SA_ASSISTANT: 'view', FAULT_COORDINATOR: 'view', REPAIR_TECHNICIAN: 'view', REGIONAL_GENERAL_MANAGER: 'view', HEAD_OF_SECTION: 'view',
    },
    // Reports. The Area Manager reads the reports of the own areas; the company managers read the company reports too.
    REPORTS: {
        SUPER_ADMIN: 'admin', ADMIN: 'admin',
        CEO: 'company', HEAD_OF_OSP: 'company', OSP_MANAGER: 'company', MANAGER: 'company', HEAD_OF_SECTION: 'company', REGIONAL_GENERAL_MANAGER: 'company',
        AREA_MANAGER: 'area',
    },
    // IT help desk. Everyone who works in the field or an area raises tickets; the office staff are the IT staff; the asset audits need an approver.
    ITMS: {
        SUPER_ADMIN: 'admin', ADMIN: 'admin',
        CEO: 'approve', OFFICE_ADMIN: 'approve',
        OFFICE_ADMIN_ASSISTANT: 'operate', SITE_OFFICE_STAFF: 'operate',
        MANAGER: 'view', OSP_MANAGER: 'view', AREA_MANAGER: 'view', ENGINEER: 'view', ASSISTANT_ENGINEER: 'view', AREA_COORDINATOR: 'view', QC_OFFICER: 'view',
    },
    // Vehicles and fleet. The office staff run the fleet and its payments; the managers see vehicles, drivers, trips and the fleet report.
    FLEET: {
        SUPER_ADMIN: 'admin', ADMIN: 'admin',
        CEO: 'operate', OFFICE_ADMIN: 'operate', OFFICE_ADMIN_ASSISTANT: 'operate', SITE_OFFICE_STAFF: 'operate',
        MANAGER: 'view', OSP_MANAGER: 'view', AREA_MANAGER: 'view', REGIONAL_GENERAL_MANAGER: 'view',
    },
};

const roleCodes = new Set<string>(Object.values(Role));
const menuBase: Partial<Record<RbacPermission, Role[]>> = {};
const menuDesignations: Record<string, string[]> = {};
for (const [module, byCode] of Object.entries(BOOTSTRAP_MENU_LEVELS) as Array<[MenuModule, Readonly<Record<string, AccessLevel>>]>) {
    for (const [code, level] of Object.entries(byCode)) {
        const permission = menuLevelPermission(module, level) as RbacPermission;
        if (roleCodes.has(code)) (menuBase[permission] ??= []).push(code as Role);
        else (menuDesignations[permission] ??= []).push(code);
    }
}

export const CANONICAL_BOOTSTRAP_ROLE_GRANTS: Readonly<Partial<Record<RbacPermission, readonly Role[]>>> = { ...BASE_BOOTSTRAP_ROLE_GRANTS, ...menuBase };

/**
 * Grants of a module designation, by its own role code. A person has a base role (ENGINEER: service-order work) and, per module, a
 * designation through a section assignment (PROJECTS_ENGINEER: project work). A designation takes the grants of its base role (the
 * seed matches it by its suffix) and, in addition, the grants listed here for its own code. The SOD Engineer therefore has no project
 * capability, and the Project Engineer has it.
 */
const BASE_MODULE_DESIGNATION_GRANTS: Readonly<Record<string, readonly string[]>> = {
    [RBAC_PERMISSIONS.PROJECT_READ]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.PROJECT_WRITE]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.PROJECT_APPROVE]: ['PROJECTS_ENGINEER'],
    [RBAC_PERMISSIONS.PROJECT_PLAN_READ]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.PROJECT_PLAN_APPROVE]: ['PROJECTS_ENGINEER'],
    [RBAC_PERMISSIONS.PROJECT_FINANCE_READ]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.PROJECT_FINANCE_ASSIGN]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    // the project engineers draw project material and see its balances
    [RBAC_PERMISSIONS.INVENTORY_READ]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    [RBAC_PERMISSIONS.NOTIFICATION_PROJECT_MANAGERS]: ['PROJECTS_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER'],
    // the Account Executive at HO (Finance section designation on the Finance Assistant role) records HO's payments on OSP vouchers
    [RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD]: ['HO_ACCOUNT_EXECUTIVE_FINANCE_ASSISTANT'],
    // the OSP Account Manager (Finance section designation on the Finance Manager role) learns what HO paid on the vouchers they accepted
    [RBAC_PERMISSIONS.NOTIFICATION_OSP_VENDOR_PAYMENTS]: ['OSP_ACCOUNT_MANAGER_FINANCE_MANAGER'],
};

export const MODULE_DESIGNATION_GRANTS: Readonly<Record<string, readonly string[]>> = { ...BASE_MODULE_DESIGNATION_GRANTS, ...menuDesignations };

/** Validate the bootstrap catalog before it can write any grants. */
export function getCanonicalBootstrapRoles(permission: RbacPermission): readonly Role[] {
    return CANONICAL_BOOTSTRAP_ROLE_GRANTS[permission] ?? [];
}
