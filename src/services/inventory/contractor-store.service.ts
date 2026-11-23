import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { StoreService } from '@/services/inventory/store.service';

/**
 * Which contractors a store works with. A store officer issues material to, takes returns from and reads the balance of the contractors of the OWN store:
 * a contractor belongs to a store when its OPMC is served by the store, or one of its teams is assigned to the store.
 * People who run every store (the Stores Manager, the CEO, administrators: the inventory data scope) are not limited to one store.
 */
export class ContractorStoreService {
    /** The contractors (id) that work with the given stores. */
    static async relevantContractorIds(storeIds: string[]): Promise<string[]> {
        if (storeIds.length === 0) return [];
        const rows = await prisma.contractor.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { opmc: { is: { storeId: { in: storeIds } } } },
                    { teams: { some: { storeAssignments: { some: { storeId: { in: storeIds } } } } } },
                ],
            },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    }

    /** The contractors the person may pick: those of the given store (must be one the person may use), or of every store the person may use. */
    static async listFor(userId: string, storeId?: string) {
        const scope = await resolveOpmcScope(userId, 'inventory');
        const accessible = (await StoreService.getAccessibleStores(userId)).map((s) => s.id);
        if (storeId && !accessible.includes(storeId)) throw AppError.forbidden('STORE_SCOPE_VIOLATION: that store is not one of yours.');
        const storeIds = storeId ? [storeId] : accessible;
        const where = scope === undefined && !storeId
            ? { status: 'ACTIVE' as const }
            : { id: { in: await this.relevantContractorIds(storeIds) } };
        return prisma.contractor.findMany({
            where,
            select: { id: true, name: true, registrationNumber: true, status: true, opmc: { select: { rtom: true } } },
            orderBy: { name: 'asc' },
        });
    }

    /** A store officer or executive may only deal with the contractors of their store; whoever runs every store may deal with any. */
    static async assertForStore(userId: string | null | undefined, contractorId: string, storeId: string): Promise<void> {
        if (!userId) throw AppError.forbidden('STORE_SCOPE_VIOLATION: An authenticated user identity is required.');
        if ((await resolveOpmcScope(userId, 'inventory')) === undefined) return;
        const ids = await this.relevantContractorIds([storeId]);
        if (!ids.includes(contractorId)) {
            throw AppError.forbidden('CONTRACTOR_NOT_FOR_THIS_STORE: this contractor does not work with this store. Assign the contractor team to the store, or ask the Stores Manager.');
        }
    }

    /** The balance (in hand) of a contractor is read by the stores the contractor works with, or by whoever runs every store. */
    static async assertCanSee(userId: string | null | undefined, contractorId: string): Promise<void> {
        if (!userId) throw AppError.forbidden('STORE_SCOPE_VIOLATION: An authenticated user identity is required.');
        if ((await resolveOpmcScope(userId, 'inventory')) === undefined) return;
        const accessible = (await StoreService.getAccessibleStores(userId)).map((s) => s.id);
        const ids = await this.relevantContractorIds(accessible);
        if (!ids.includes(contractorId)) throw AppError.forbidden('CONTRACTOR_NOT_FOR_YOUR_STORES: this contractor does not work with your stores.');
    }
}
