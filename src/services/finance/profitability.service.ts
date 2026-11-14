import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { classifyAccount } from './fpa-dashboard.service';

export type ProfitabilityDimension = 'opmc' | 'project';

export interface ProfitabilityRow {
    key: string | null; // null = unattributed
    label: string;
    sublabel?: string;
    revenue: number;
    directCost: number;
    opex: number;
    grossMargin: number;
    netProfit: number;
    marginPct: number | null;
}

export interface ProfitabilityReport {
    by: ProfitabilityDimension;
    from: string | null;
    to: string | null;
    rows: ProfitabilityRow[];
    totals: Omit<ProfitabilityRow, 'key' | 'label' | 'sublabel'>;
    /** Share of company-wide revenue that is not attributed to an OPMC/project (0..100). Null when scoped. */
    unattributedRevenuePct: number | null;
    note: string;
}

export function summarise(revenue: number, directCost: number, opex: number) {
    const grossMargin = revenue - directCost;
    const netProfit = grossMargin - opex;
    return { revenue, directCost, opex, grossMargin, netProfit, marginPct: revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : null };
}

/**
 * Profit by OPMC or by project, from posted ledger entries (reversed originals included so reversals net to zero).
 * Attribution comes from the dimensions stamped on each journal entry; entries without one are shown as
 * "Unattributed" rather than guessed. Users limited to specific OPMCs only ever see rows inside their scope.
 */
export class ProfitabilityService {
    static async getReport(userId: string | null | undefined, by: ProfitabilityDimension, from?: Date, to?: Date): Promise<ProfitabilityReport> {
        const scope = await resolveOpmcScope(userId);
        const dim = by === 'opmc' ? 'opmcId' : 'projectId';

        const rows = await prisma.$queryRawUnsafe<{ k: string | null; code: string; debit: unknown; credit: unknown }[]>(
            `SELECT e."${dim}"::text AS k, l."accountCode" AS code, COALESCE(SUM(l."debit"), 0) AS debit, COALESCE(SUM(l."credit"), 0) AS credit
             FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId"
             WHERE e."status" IN ('POSTED', 'REVERSED')
               AND ($1::timestamptz IS NULL OR e."date" >= $1::timestamptz)
               AND ($2::timestamptz IS NULL OR e."date" <= $2::timestamptz)
               AND ($3::uuid[] IS NULL OR e."opmcId" = ANY($3::uuid[]))
             GROUP BY 1, 2`,
            from ?? null, to ?? null, scope === undefined ? null : scope,
        );

        const coa = await prisma.chartOfAccount.findMany({ select: { code: true, type: true } });
        const typeOf = new Map(coa.map((a) => [a.code, a.type as string]));

        const acc = new Map<string | null, { revenue: number; direct: number; opex: number }>();
        for (const r of rows) {
            const kind = classifyAccount(r.code, typeOf.get(r.code));
            if (kind === 'OTHER') continue;
            const bucket = acc.get(r.k) ?? { revenue: 0, direct: 0, opex: 0 };
            const debit = Number(r.debit);
            const credit = Number(r.credit);
            if (kind === 'REVENUE') bucket.revenue += credit - debit;
            else if (kind === 'DIRECT_COST') bucket.direct += debit - credit;
            else bucket.opex += debit - credit;
            acc.set(r.k, bucket);
        }

        const keys = [...acc.keys()].filter((k): k is string => k !== null);
        const names = new Map<string, { label: string; sublabel?: string }>();
        if (by === 'opmc' && keys.length) {
            for (const o of await prisma.oPMC.findMany({ where: { id: { in: keys } }, select: { id: true, name: true, rtom: true, region: true } })) {
                names.set(o.id, { label: o.rtom || o.name, sublabel: [o.name, o.region].filter(Boolean).join(' · ') });
            }
        } else if (keys.length) {
            for (const pr of await prisma.project.findMany({ where: { id: { in: keys } }, select: { id: true, name: true, projectCode: true } })) {
                names.set(pr.id, { label: pr.name, sublabel: pr.projectCode });
            }
        }

        const out: ProfitabilityRow[] = [...acc.entries()]
            // Scoped users never see unattributed (company-level) rows
            .filter(([k]) => k !== null || scope === undefined)
            .map(([k, v]) => ({
                key: k,
                label: k === null ? 'Unattributed' : (names.get(k)?.label ?? k),
                sublabel: k === null ? 'Entries with no OPMC / project on their source document' : names.get(k)?.sublabel,
                ...summarise(v.revenue, v.direct, v.opex),
            }))
            .sort((a, b) => b.netProfit - a.netProfit);

        const total = out.reduce((a, r) => ({ revenue: a.revenue + r.revenue, direct: a.direct + r.directCost, opex: a.opex + r.opex }), { revenue: 0, direct: 0, opex: 0 });
        const unattributed = out.find((r) => r.key === null);

        return {
            by, from: from?.toISOString() ?? null, to: to?.toISOString() ?? null, rows: out,
            totals: summarise(total.revenue, total.direct, total.opex),
            unattributedRevenuePct: scope === undefined && total.revenue > 0 ? Number((((unattributed?.revenue ?? 0) / total.revenue) * 100).toFixed(1)) : null,
            note: 'Attribution is taken from the source document of each posting. Entries without one are listed as Unattributed, and older entries were attributed by a one-time backfill where the source document still exists.',
        };
    }
}
