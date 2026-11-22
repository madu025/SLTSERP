/**
 * Menu access by module designation.
 *
 * A person has a base role (their post, for example ENGINEER) and, for each module, a designation (a section assignment, for example
 * PROJECTS_ENGINEER). What the person does in a module decides which items of that module the menu shows: the access LEVEL of their
 * designation in the module. Security does not depend on this file: every page and API still needs its capability; the menu only hides.
 *
 * The levels, and their order, belong to the module (a higher level sees everything a lower one sees):
 *   Service orders: view < operate < invoice < approve < admin
 *   Inventory:      view < approve < operate < admin   (the store keeper operates and also approves; the Area Manager approves only)
 *   Projects:       view < operate < approve < admin
 *   Reports:        area < company < admin             (the reports of the person's own areas, then of the whole company)
 *   ITMS:           view < operate < approve < admin   (raise tickets, IT staff, asset approvers)
 *   Fleet:          view < operate < admin             (see vehicles and trips, run payments)
 */
export type AccessLevel = 'view' | 'operate' | 'invoice' | 'approve' | 'admin' | 'area' | 'company';
export type MenuModule = 'SOD' | 'INVENTORY' | 'PROJECTS' | 'REPORTS' | 'ITMS' | 'FLEET';

export const MODULE_LEVEL_ORDER: Readonly<Record<MenuModule, readonly AccessLevel[]>> = {
    SOD: ['view', 'operate', 'invoice', 'approve', 'admin'],
    INVENTORY: ['view', 'approve', 'operate', 'admin'],
    PROJECTS: ['view', 'operate', 'approve', 'admin'],
    REPORTS: ['area', 'company', 'admin'],
    ITMS: ['view', 'operate', 'approve', 'admin'],
    FLEET: ['view', 'operate', 'admin'],
};

const rank = (module: MenuModule, l: AccessLevel) => MODULE_LEVEL_ORDER[module].indexOf(l);

/**
 * The level of each designation in a module. A module with no entry here is decided by capabilities alone, and so is a person
 * none of whose designations is listed for the module.
 * Keys are base role codes (a post) and module designation codes.
 */
export const MODULE_DESIGNATION_LEVELS: Readonly<Record<MenuModule, Readonly<Record<string, AccessLevel>>>> = {
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
        CEO: 'operate', STORES_MANAGER: 'operate', STORES_ASSISTANT: 'operate',
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
        SF_AUDIT_MANAGER: 'view', SF_AUDIT_OFFICER: 'view', RATE_AUDITOR: 'view', STORES_MANAGER: 'view', STORES_ASSISTANT: 'view', PROCUREMENT_OFFICER: 'view',
        SA_MANAGER: 'view', SA_ASSISTANT: 'view', FAULT_COORDINATOR: 'view', REPAIR_TECHNICIAN: 'view', REGIONAL_GENERAL_MANAGER: 'view', HEAD_OF_SECTION: 'view',
    },
    // Reports. The Area Manager reads the reports of the own areas; the company managers read the company reports too.
    REPORTS: {
        SUPER_ADMIN: 'admin', ADMIN: 'admin',
        CEO: 'company', OSP_MANAGER: 'company', MANAGER: 'company', HEAD_OF_SECTION: 'company', REGIONAL_GENERAL_MANAGER: 'company',
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

/** The level a person's designations give in a module: the highest of them, or null when none of them is listed for the module. */
export function designationLevel(module: MenuModule, designations: readonly string[] | undefined | null): AccessLevel | null {
    const table = MODULE_DESIGNATION_LEVELS[module];
    let best: AccessLevel | null = null;
    for (const code of designations ?? []) {
        const level = table[code];
        if (level && (best === null || rank(module, level) > rank(module, best))) best = level;
    }
    return best;
}

/**
 * May the person see a menu item that needs `level` in `module`?
 * When the person's designations are unknown (an old session) or none is listed for the module, the capability check alone decides.
 */
export function levelAllowsItem(module: MenuModule | undefined, level: AccessLevel | undefined, designations: readonly string[] | undefined | null): boolean {
    if (!module || !level) return true;
    const have = designationLevel(module, designations);
    if (have === null) return true;
    const need = rank(module, level);
    return need >= 0 && rank(module, have) >= need;
}
