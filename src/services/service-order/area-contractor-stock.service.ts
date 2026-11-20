import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { narrowScope } from './area-overview.service';

export interface AreaContractorStock {
    areas: Array<{ rtom: string; name: string }>;
    rtom: string;
    contractors: Array<{
        contractorId: string; name: string; rtom: string;
        items: Array<{ code: string; name: string; unit: string; type: string; quantity: number }>;
    }>;
}

/**
 * The material each contractor of the person's own RTOMs holds in hand. Only reads. Limited to the person's areas, so a coordinator
 * sees their contractors' stock and nobody else's; the store, its receipts and issues are not part of this.
 */
export class AreaContractorStockService {
    static async forUser(userId: string, opts: { rtom?: string } = {}): Promise<AreaContractorStock> {
        const allScope = await resolveOpmcScope(userId);
        const areaWhere = allScope === undefined ? {} : { id: { in: allScope } };
        const areas = await prisma.oPMC.findMany({ where: areaWhere, select: { id: true, rtom: true, name: true }, orderBy: { rtom: 'asc' } });
        if (allScope !== undefined && allScope.length === 0) return { areas: [], rtom: 'ALL', contractors: [] };
        const scope = await narrowScope(areas.map((a) => a.id), opts.rtom);
        const rtom = scope.length === 1 && areas.length > 1 ? (areas.find((a) => a.id === scope[0])?.rtom ?? 'ALL') : 'ALL';
        const rows = await prisma.contractorStock.findMany({
            where: { quantity: { gt: 0 }, contractor: { opmcId: { in: scope } } },
            include: {
                item: { select: { code: true, name: true, unit: true, type: true } },
                contractor: { select: { id: true, name: true, opmc: { select: { rtom: true } } } },
            },
            orderBy: [{ contractor: { name: 'asc' } }, { item: { name: 'asc' } }],
        });
        const by = new Map<string, AreaContractorStock['contractors'][number]>();
        for (const r of rows) {
            const c = by.get(r.contractorId) ?? { contractorId: r.contractorId, name: r.contractor.name, rtom: r.contractor.opmc?.rtom ?? '', items: [] };
            c.items.push({ code: r.item.code, name: r.item.name, unit: r.item.unit, type: String(r.item.type), quantity: Number(r.quantity) });
            by.set(r.contractorId, c);
        }
        return { areas: areas.map((a) => ({ rtom: a.rtom, name: a.name })), rtom, contractors: [...by.values()] };
    }
}
