import { prisma } from '@/lib/prisma';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';
import { buildContractorBalance, type Movement, type MovementKind } from '@/lib/contractor-balance-rules';

export { buildContractorBalance, monthPeriod } from '@/lib/contractor-balance-rules';
export type { BalanceRow, Movement, MovementKind } from '@/lib/contractor-balance-rules';

type Client = TransactionClient;

export class ContractorBalanceService {
    /** Every movement of the contractor's stock (optionally only the documents of one store). */
    static async movements(contractorId: string, client: Client = prisma as unknown as Client, storeId?: string | null): Promise<Movement[]> {
        const rows = await client.$queryRawUnsafe<Array<{ item_id: string; code: string; name: string; unit: string | null; kind: MovementKind; qty: string | number; at: Date; team_id: string | null }>>(`
          SELECT m.item_id, m.kind, m.qty, m.at, m.team_id, it.code, it.name, it.unit FROM (
            SELECT ii."itemId" item_id, 'ISSUED' kind, ii.quantity qty, i."issueDate" at, NULL::uuid team_id
              FROM "ContractorMaterialIssueItem" ii JOIN "ContractorMaterialIssue" i ON i.id = ii."issueId"
             WHERE i."contractorId" = $1::uuid AND i.status <> 'REJECTED' AND ($2::uuid IS NULL OR i."storeId" = $2::uuid)
            UNION ALL
            SELECT ri."itemId", 'RETURNED', COALESCE(ri."acceptedQuantity", 0), COALESCE(r."acceptedAt", r."returnDate"), NULL
              FROM "ContractorMaterialReturnItem" ri JOIN "ContractorMaterialReturn" r ON r.id = ri."returnId"
             WHERE r."contractorId" = $1::uuid AND r.status = 'ACCEPTED' AND ($2::uuid IS NULL OR r."storeId" = $2::uuid)
            UNION ALL
            SELECT wi."itemId", 'WASTAGE', wi.quantity, w.date, NULL
              FROM "ContractorWastageItem" wi JOIN "ContractorWastage" w ON w.id = wi."wastageId"
             WHERE w."contractorId" = $1::uuid AND w.status = 'APPROVED' AND ($2::uuid IS NULL OR w."storeId" = $2::uuid)
            UNION ALL
            SELECT u."itemId", CASE WHEN u."usageType" = 'WASTAGE' THEN 'WASTAGE' ELSE 'USED' END, u.quantity, u."createdAt", so."teamId"
              FROM "SODMaterialUsage" u JOIN "ServiceOrder" so ON so.id = u."serviceOrderId"
             WHERE so."contractorId" = $1::uuid AND u."batchId" IS NOT NULL
               AND u."usageType" IN ('USED','WASTAGE','USED_F1','USED_G1','PORTAL_SYNC')
          ) m JOIN "InventoryItem" it ON it.id = m.item_id`, contractorId, storeId ?? null);
        return rows.map((r) => ({ itemId: r.item_id, code: r.code, name: r.name, unit: r.unit || 'Nos', kind: r.kind, qty: Number(r.qty), at: new Date(r.at), teamId: r.team_id }));
    }

    static async inHand(contractorId: string, client: Client = prisma as unknown as Client) {
        const rows = await client.contractorStock.findMany({ where: { contractorId }, include: { item: { select: { code: true, name: true, unit: true } } } });
        return rows.map((s) => ({ itemId: s.itemId, code: s.item.code, name: s.item.name, unit: s.item.unit || 'Nos', quantity: Number(s.quantity) }));
    }

    static async balance(contractorId: string, opts: { period?: { start: Date; end: Date } | null; teamId?: string | null; storeId?: string | null } = {}, client: Client = prisma as unknown as Client) {
        const [movements, inHand] = await Promise.all([this.movements(contractorId, client, opts.storeId), this.inHand(contractorId, client)]);
        return buildContractorBalance(movements, inHand, opts.period, opts.teamId);
    }
}
