/**
 * Menu access by module designation.
 *
 * A person has a base role (their post, for example ENGINEER) and, for each module, a designation (a section assignment, for example
 * PROJECTS_ENGINEER). What the person does in a module decides which items of that module the menu shows: the access LEVEL of their
 * designation in the module. Security does not depend on this file: every page and API still needs its capability; the menu only hides.
 *
 * Levels, lowest to highest:
 *   view     see the work and the reports of the module
 *   operate  do the day-to-day work
 *   invoice  prepare the money steps (invoicing, deviations)
 *   approve  decide (approvals)
 *   admin    administer
 */
export const ACCESS_LEVELS = ['view', 'operate', 'invoice', 'approve', 'admin'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export type MenuModule = 'SOD';

const rank = (l: AccessLevel) => ACCESS_LEVELS.indexOf(l);

/**
 * The level of each designation in a module. A module with no entry here is decided by capabilities alone.
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
};

/** The level a person's designations give in a module: the highest of them, or null when none of them is listed for the module. */
export function designationLevel(module: MenuModule, designations: readonly string[] | undefined | null): AccessLevel | null {
    const table = MODULE_DESIGNATION_LEVELS[module];
    let best: AccessLevel | null = null;
    for (const code of designations ?? []) {
        const level = table[code];
        if (level && (best === null || rank(level) > rank(best))) best = level;
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
    return rank(have) >= rank(level);
}
