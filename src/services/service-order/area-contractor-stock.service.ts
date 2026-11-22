import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { narrowScope } from './area-overview.service';

export interface AreaContractorStock {
    areas: Array<{ rtom: string; name: string }>;
    rtom: string;
    contractors: Array<{
        contractorId: string; name: string; rtom: string;
        items: Array<{ code: string; name: string; unit: string; type: string; quantity: number }>;
        /** How the contractor is registered (no identity numbers, bank or document files: those stay with the registration approvers). */
        registration: {
            status: string; type: string; registrationNumber: string | null; brNumber: string | null; contactNumber: string | null; email: string | null; address: string | null;
            agreementSigned: boolean; agreementDate: Date | null; agreementYears: number | null; registrationFeePaid: boolean;
            armApprovedAt: Date | null; ospApprovedAt: Date | null; documentStatus: string; registeredAt: Date;
            teams: Array<{ name: string; sltCode: string | null; status: string; members: number }>;
        };
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
        const contractors = await prisma.contractor.findMany({
            where: { opmcId: { in: scope }, status: { in: ['ACTIVE', 'ARM_PENDING', 'OSP_PENDING', 'INACTIVE'] } },
            orderBy: { name: 'asc' },
            select: {
                id: true, name: true, type: true, status: true, registrationNumber: true, brNumber: true, contactNumber: true, email: true, address: true,
                agreementSigned: true, agreementDate: true, agreementDuration: true, registrationFeePaid: true, armApprovedAt: true, ospApprovedAt: true, documentStatus: true, createdAt: true,
                opmc: { select: { rtom: true } },
                teams: { select: { name: true, sltCode: true, status: true, _count: { select: { members: true } } }, orderBy: { name: 'asc' } },
                stock: { where: { quantity: { gt: 0 } }, select: { quantity: true, item: { select: { code: true, name: true, unit: true, type: true } } }, orderBy: { item: { name: 'asc' } } },
            },
        });
        return {
            areas: areas.map((a) => ({ rtom: a.rtom, name: a.name })), rtom,
            contractors: contractors.map((c) => ({
                contractorId: c.id, name: c.name, rtom: c.opmc?.rtom ?? '',
                items: c.stock.map((r) => ({ code: r.item.code, name: r.item.name, unit: r.item.unit, type: String(r.item.type), quantity: Number(r.quantity) })),
                registration: {
                    status: String(c.status), type: String(c.type), registrationNumber: c.registrationNumber, brNumber: c.brNumber, contactNumber: c.contactNumber, email: c.email, address: c.address,
                    agreementSigned: c.agreementSigned, agreementDate: c.agreementDate, agreementYears: c.agreementDuration, registrationFeePaid: c.registrationFeePaid,
                    armApprovedAt: c.armApprovedAt, ospApprovedAt: c.ospApprovedAt, documentStatus: c.documentStatus, registeredAt: c.createdAt,
                    teams: c.teams.map((t) => ({ name: t.name, sltCode: t.sltCode, status: t.status, members: t._count.members })),
                },
            })),
        };
    }
}
