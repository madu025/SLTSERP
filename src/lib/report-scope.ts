import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/** An RTOM written any way ("R-HK", "r-hk", "HK") compares as the same name. */
export const normalizeRtom = (name: string) => name.replace(/^R-/i, '').trim().toUpperCase();

export interface ReportScope { opmcIds: string[]; rtomNames: string[]; normalized: Set<string> }

/**
 * The areas a person's reports are limited to; undefined for someone with no area limit (company managers, administrators).
 * An Area Manager's reports must show their own RTOMs only, never the company.
 */
export async function resolveReportScope(userId: string | undefined | null): Promise<ReportScope | undefined> {
    if (!userId) return { opmcIds: [], rtomNames: [], normalized: new Set() };
    const opmcIds = await resolveOpmcScope(userId);
    if (opmcIds === undefined) return undefined;
    const rows = opmcIds.length ? await prisma.oPMC.findMany({ where: { id: { in: opmcIds } }, select: { rtom: true } }) : [];
    const rtomNames = rows.map((r) => r.rtom);
    return { opmcIds, rtomNames, normalized: new Set(rtomNames.map(normalizeRtom)) };
}

/** Every spelling of the given RTOMs that the order data may carry ("R-HK" and "HK"). */
export function rtomVariants(names: string[]): string[] {
    return [...new Set(names.flatMap((n) => { const c = normalizeRtom(n); return [n.trim(), c, `R-${c}`]; }))];
}
