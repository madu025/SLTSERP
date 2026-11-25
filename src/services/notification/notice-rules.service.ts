import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { isValidRule, previewRule, selectRecipients, type NoticeRule, type RuleCandidate } from '@/lib/notice-recipient-rules';
import { RULE_BASED_NOTICES } from '@/config/automated-notices';
import { NotificationService } from './index';

const CONFIG_KEY = 'AUTOMATED_NOTICE_RULES';

type NotifyInput = Parameters<typeof NotificationService.broadcast>[0] extends infer P ? Omit<P & object, 'userIds'> & { opmcId?: string | null } : never;

/**
 * The recipients of the automated reports, by module, job level and area (see src/lib/notice-recipient-rules.ts).
 * The rule of each report starts as the default in src/config/automated-notices.ts; the administrator changes it on the page
 * "Automated reports and alerts", and the change is kept in the system settings (key AUTOMATED_NOTICE_RULES).
 */
export class NoticeRulesService {
    /** The rule of every rule-based report: the stored one, or the default when none is stored or the stored one is no longer valid. */
    static async getRules(): Promise<Record<string, NoticeRule>> {
        const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } }).catch(() => null);
        let stored: Record<string, unknown> = {};
        try { stored = row?.value ? (JSON.parse(row.value) as Record<string, unknown>) : {}; } catch { stored = {}; }
        const out: Record<string, NoticeRule> = {};
        for (const [job, def] of Object.entries(RULE_BASED_NOTICES)) out[job] = isValidRule(stored[job]) ? (stored[job] as NoticeRule) : def;
        return out;
    }

    static async setRule(actorId: string, job: string, rule: unknown): Promise<NoticeRule> {
        if (!Object.hasOwn(RULE_BASED_NOTICES, job)) throw AppError.badRequest('UNKNOWN_REPORT: this report has no recipient rule');
        if (!isValidRule(rule)) throw AppError.badRequest('INVALID_RULE: choose a module, a level that module has, and an area setting');
        const current = await this.getRules();
        const next = { ...current, [job]: rule };
        // only the rules that differ from their default are stored, so a changed default in the code still reaches the rest
        const stored: Record<string, NoticeRule> = {};
        for (const [j, r] of Object.entries(next)) if (JSON.stringify(r) !== JSON.stringify(RULE_BASED_NOTICES[j])) stored[j] = r;
        await prisma.systemConfig.upsert({
            where: { key: CONFIG_KEY },
            create: { key: CONFIG_KEY, value: JSON.stringify(stored), description: 'Recipient rule (module, level, area) of each automated report' },
            update: { value: JSON.stringify(stored) },
        });
        await AuditService.log({ userId: actorId, action: 'AUTOMATED_NOTICE_RULE_CHANGED', entity: 'AutomatedNotice', entityId: job, oldValue: current[job], newValue: rule }).catch(() => undefined);
        return rule;
    }

    /** Every active person with their effective capabilities and areas. */
    static async candidates(): Promise<Array<RuleCandidate & { name: string; role: string }>> {
        const roleSelect = { isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } as const;
        const users = await prisma.user.findMany({
            where: { status: 'active' },
            select: {
                id: true, name: true, role: true, email: true, permissions: true,
                accessibleOpmcs: { select: { id: true } },
                assignedStore: { select: { opmcs: { select: { id: true } } } },
                systemRole: { select: roleSelect },
                sectionAssignments: { select: { role: { select: roleSelect } } },
            },
        });
        return users.map((u) => ({
            id: u.id, name: u.name ?? '', role: String(u.role), email: u.email,
            permissions: deriveEffectivePermissions(u as never),
            areas: [...new Set([...u.accessibleOpmcs.map((o) => o.id), ...(u.assignedStore?.opmcs.map((o) => o.id) ?? [])])],
        }));
    }

    /** Who a report goes to now. Pass the area (opmcId) for a report about one area. */
    static async resolve(job: string, opmcId?: string | null) {
        const rules = await this.getRules();
        const rule = rules[job];
        if (!rule) throw AppError.badRequest('UNKNOWN_REPORT');
        const people = await this.candidates();
        return selectRecipients(people, rule, opmcId).map((p) => ({ id: p.id, email: p.email, name: p.name }));
    }

    /** Send a notice to the people of the report's rule (in-app, with the usual preferences and de-duplication). */
    static async notify(job: string, input: NotifyInput) {
        try {
            const { opmcId, ...rest } = input as { opmcId?: string | null } & Record<string, unknown>;
            const recipients = await this.resolve(job, opmcId);
            if (recipients.length === 0) return null;
            return await NotificationService.broadcast({ ...(rest as object), userIds: recipients.map((r) => r.id) } as Parameters<typeof NotificationService.broadcast>[0]);
        } catch (error) {
            console.error(`[NOTICE-RULES] ${job} was not sent:`, error instanceof Error ? error.message : error);
            return null;
        }
    }

    /** For the administrator's page: the effective rule of each report with a preview of who it reaches. */
    static async overview() {
        const [rules, people] = await Promise.all([this.getRules(), this.candidates()]);
        const out: Record<string, { rule: NoticeRule; isDefault: boolean; holders: number; withEmail: number; companyWide: number; withArea: number; noArea: number }> = {};
        for (const [job, rule] of Object.entries(rules)) {
            const p = previewRule(people, rule);
            out[job] = { rule, isDefault: JSON.stringify(rule) === JSON.stringify(RULE_BASED_NOTICES[job]), holders: p.holders.length, withEmail: p.holders.filter((h) => h.email).length, companyWide: p.companyWide.length, withArea: p.withArea.length, noArea: p.noArea.length };
        }
        return out;
    }

    /** The people behind a rule, flagged when they have no area (so get none of an area report). */
    static async people(job: string) {
        const rules = await this.getRules();
        const rule = rules[job];
        if (!rule) throw AppError.badRequest('UNKNOWN_REPORT');
        const p = previewRule(await this.candidates(), rule);
        const noArea = new Set(p.noArea.map((x) => x.id));
        return p.holders.map((h) => ({ id: h.id, name: h.name, role: h.role, email: h.email, noArea: noArea.has(h.id) })).sort((a, b) => Number(b.noArea) - Number(a.noArea) || a.role.localeCompare(b.role) || String(a.name).localeCompare(String(b.name)));
    }
}
