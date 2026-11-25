import { MODULE_LEVEL_ORDER, levelFromPermissions, type AccessLevel, type MenuModule } from '@/config/menu-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

/**
 * Who receives an automated report: decided by the MODULE the report belongs to, the JOB LEVEL a person has in that module, and the AREA.
 *
 * The job level is the menu level of the module (menu.<module>.<level>: view, operate, approve, admin ... held through the person's role in the
 * database), so a report goes to "people who work in Service Orders at operate level or above", not to a hand-made list of names.
 * Pure rules, so every one is testable without a database.
 */
export interface NoticeRule {
    module: MenuModule;
    /** The lowest level that receives it; every higher level of the module receives it too. */
    minLevel: AccessLevel;
    /** company: everybody who meets the level. area: the people of the area the report is about, and those with company-wide reach. */
    area: 'company' | 'area';
}

export interface RuleCandidate {
    id: string;
    email: string | null;
    name?: string;
    role?: string;
    /** The person's effective capabilities. */
    permissions: readonly string[];
    /** The areas (OPMC) the person works in: their own, and those of their store. */
    areas: readonly string[];
}

export const NOTICE_AREA_VALUES = ['company', 'area'] as const;

const rank = (module: MenuModule, level: AccessLevel) => MODULE_LEVEL_ORDER[module].indexOf(level);

export function isValidRule(value: unknown): value is NoticeRule {
    if (!value || typeof value !== 'object') return false;
    const r = value as Record<string, unknown>;
    if (typeof r.module !== 'string' || !Object.hasOwn(MODULE_LEVEL_ORDER, r.module)) return false;
    const levels = MODULE_LEVEL_ORDER[r.module as MenuModule] as readonly string[];
    return typeof r.minLevel === 'string' && levels.includes(r.minLevel) && (NOTICE_AREA_VALUES as readonly string[]).includes(String(r.area));
}

/** Does the person hold the module at the level, or a higher one? A person with no level in the module does not. */
export function meetsLevel(permissions: readonly string[], module: MenuModule, minLevel: AccessLevel): boolean {
    const have = levelFromPermissions(module, permissions);
    return have !== null && rank(module, have) >= rank(module, minLevel);
}

/** People who see every area: administrators and those with the company-wide scope or notification capability. */
export function hasCompanyReach(permissions: readonly string[]): boolean {
    return permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC) || permissions.includes(RBAC_PERMISSIONS.SCOPE_COMPANY_ALL) || permissions.includes(RBAC_PERMISSIONS.NOTIFICATION_GLOBAL);
}

/** The people a report about `opmcId` (or a company-wide report) goes to. */
export function selectRecipients<T extends RuleCandidate>(candidates: readonly T[], rule: NoticeRule, opmcId?: string | null): T[] {
    const holders = candidates.filter((c) => meetsLevel(c.permissions, rule.module, rule.minLevel));
    if (rule.area === 'company') return holders;
    // an area report goes to the people of that area and to those who see every area; with no area named, only the latter
    return holders.filter((c) => hasCompanyReach(c.permissions) || (!!opmcId && c.areas.includes(opmcId)));
}

export interface RulePreview<T extends RuleCandidate> {
    /** Everybody who meets the level. */
    holders: T[];
    /** Of those, who sees every area. */
    companyWide: T[];
    /** Of those, who works in at least one area. */
    withArea: T[];
    /** For an area report: who meets the level but has no area and no company-wide reach, so receives none of its notices. */
    noArea: T[];
}

export function previewRule<T extends RuleCandidate>(candidates: readonly T[], rule: NoticeRule): RulePreview<T> {
    const holders = candidates.filter((c) => meetsLevel(c.permissions, rule.module, rule.minLevel));
    const companyWide = holders.filter((c) => hasCompanyReach(c.permissions));
    const withArea = holders.filter((c) => !hasCompanyReach(c.permissions) && c.areas.length > 0);
    const noArea = rule.area === 'area' ? holders.filter((c) => !hasCompanyReach(c.permissions) && c.areas.length === 0) : [];
    return { holders, companyWide, withArea, noArea };
}
