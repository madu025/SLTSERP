/**
 * Menu access by module designation.
 *
 * A person has a base role (their post, for example ENGINEER) and, for each module, a designation (a section assignment, for example
 * PROJECTS_ENGINEER). What the person does in a module decides which items of that module the menu shows: the access LEVEL of their
 * designation in the module. The level is a capability (menu.<module>.<level>) held through the role in the database, like every other
 * capability; no role name is in this file (the starting grants are in rbac-bootstrap.ts). Security does not depend on this file: every page
 * and API still needs its capability; the menu only hides.
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

/** The capability that gives a person a level in a module: menu.<module>.<level> (granted to roles in the database like any other capability). */
export const menuLevelPermission = (module: MenuModule, level: AccessLevel): string => `menu.${module.toLowerCase()}.${level}`;

/** The level a person's capabilities give in a module: the highest menu.<module>.<level> held, or null when none is held. */
export function levelFromPermissions(module: MenuModule, permissions: readonly string[] | undefined | null): AccessLevel | null {
    const held = new Set(permissions ?? []);
    let best: AccessLevel | null = null;
    for (const level of MODULE_LEVEL_ORDER[module]) if (held.has(menuLevelPermission(module, level))) best = level;
    return best;
}

/**
 * May the person see a menu item that needs `level` in `module`?
 * When the person holds no level capability for the module (an old session, or a role the administrator built without one),
 * the page capability check alone decides.
 */
export function levelAllowsItem(module: MenuModule | undefined, level: AccessLevel | undefined, permissions: readonly string[] | undefined | null): boolean {
    if (!module || !level) return true;
    const have = levelFromPermissions(module, permissions);
    if (have === null) return true;
    const need = rank(module, level);
    return need >= 0 && rank(module, have) >= need;
}
