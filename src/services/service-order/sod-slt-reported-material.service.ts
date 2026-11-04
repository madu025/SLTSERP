import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope, NIL_UUID } from '@/lib/opmc-scope';
import { compareMaterial, hasDeviation, type DeviationLine } from '@/lib/sod-material-deviation';

import type { TransactionClient } from '@/types/inventory/inventory-service.types';

/** `prisma` itself satisfies the transaction-client surface used here. */
type Db = TransactionClient;

export interface ReportedMaterialInput {
  CODE?: string;
  TYPE?: string;
  NAME?: string;
  QTY?: string | number;
  qty?: string | number;
  SERIAL?: string;
  RAW?: Record<string, string>;
}

const MATERIAL_MAP: Record<string, string> = {
  'DROP WIRE': 'OSPFTA003',
  'FTTH DROP WIRE': 'OSPFTA003',
  'D-WIRE': 'OSPFTA003',
  DW: 'OSPFTA003',
  ONT: 'ONT',
  'ONT ROUTER': 'ONT',
  IPTV: 'IPTV-CPE',
  STB: 'IPTV-CPE',
  'SET TOP BOX': 'IPTV-CPE',
  'PATCH CORD': 'OSPFTA004',
  'P-CORD': 'OSPFTA004',
  OTO: 'OSPFTA005',
  ROSETTE: 'OSPFTA005',
};

/**
 * SLT-reported material is reference data. It is stored apart from SODMaterialUsage and has no
 * effect on stock or the ledger; only manual entries (contractor / staff) move stock.
 */
export class SODSltReportedMaterialService {
  /** Map an SLT line to an inventory item through code, name and the admin-managed alias lists. */
  static async resolveItemId(db: Db, code: string | undefined, name: string | undefined, materialSource: string | null | undefined): Promise<string | null> {
    const codeKey = code ? code.trim().toUpperCase() : '';
    const nameKey = name ? name.trim().toUpperCase() : '';
    if (!codeKey && !nameKey) return null;
    const targetType = materialSource === 'SLTS' || materialSource === 'COMPANY' ? 'SLTS' : 'SLT';
    const match: Prisma.InventoryItemWhereInput = {
      OR: [
        ...(codeKey ? [{ code: codeKey }, { importAliases: { has: codeKey } }, { scrapedAliases: { has: codeKey } }, { bomAliases: { has: codeKey } }, { importAliases: { has: code! } }] : []),
        ...(nameKey ? [{ name: { equals: name!.trim(), mode: 'insensitive' as const } }, { importAliases: { has: nameKey } }, { scrapedAliases: { has: nameKey } }, { bomAliases: { has: nameKey } }, { importAliases: { has: name! } }] : []),
      ],
    };
    const item = (await db.inventoryItem.findFirst({ where: { ...match, type: targetType }, select: { id: true } }))
      || (await db.inventoryItem.findFirst({ where: match, select: { id: true } }));
    if (item) return item.id;

    const searchKey = (nameKey || codeKey);
    for (const [key, mapped] of Object.entries(MATERIAL_MAP)) {
      if (searchKey.includes(key)) {
        const m = (await db.inventoryItem.findFirst({ where: { code: mapped, type: targetType }, select: { id: true } }))
          || (await db.inventoryItem.findFirst({ where: { code: mapped }, select: { id: true } }));
        if (m) return m.id;
      }
    }
    return null;
  }

  /** Replace the SLT-reported set for a service order with the latest push. Idempotent per push. */
  static async record(db: Db, serviceOrderId: string, materials: ReportedMaterialInput[], opts: { materialSource?: string | null; source?: string; reportedBy?: string | null } = {}) {
    const rows: Prisma.SODSltReportedMaterialCreateManyInput[] = [];
    for (const mat of materials) {
      const code = mat.CODE || mat.TYPE;
      const name = mat.NAME;
      const qty = parseFloat(String(mat.QTY ?? mat.qty ?? '0'));
      if (!(qty > 0) || (!code && !name)) continue;
      const serial = mat.SERIAL || (mat.RAW ? mat.RAW['SERIAL'] || mat.RAW['SERIAL NUMBER'] || mat.RAW['ONT_ROUTER_SERIAL_NUMBER_'] : null) || null;
      rows.push({
        serviceOrderId,
        itemId: await this.resolveItemId(db, code, name, opts.materialSource),
        rawCode: code?.trim() || null,
        rawName: name?.trim() || null,
        quantity: qty,
        serialNumber: serial,
        source: opts.source || 'EXTENSION',
        reportedBy: opts.reportedBy || null,
      });
    }
    await db.sODSltReportedMaterial.deleteMany({ where: { serviceOrderId } });
    if (rows.length > 0) await db.sODSltReportedMaterial.createMany({ data: rows });
    return rows.length;
  }

  /**
   * Everything the staff material form needs beside the entry fields: what the selected contractor holds
   * (so a short stock is visible before saving) and what SLT reported for this order and when it arrived.
   */
  static async materialContext(userId: string, serviceOrderId: string, contractorIdOverride?: string) {
    const scope = await resolveOpmcScope(userId);
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { id: true, opmcId: true, contractorId: true, sltReportedMaterials: { select: { itemId: true, rawCode: true, rawName: true, quantity: true, source: true, reportedAt: true } } },
    });
    if (!order) throw AppError.notFound('SERVICE_ORDER_NOT_FOUND');
    if (scope !== undefined && !scope.includes(order.opmcId)) throw AppError.forbidden('OPMC_ACCESS_DENIED');

    let contractorId = order.contractorId;
    if (contractorIdOverride && contractorIdOverride !== order.contractorId) {
      const allowed = await prisma.contractor.findFirst({
        where: {
          id: contractorIdOverride,
          ...(scope === undefined ? {} : { OR: [{ opmcId: { in: scope.length ? scope : [NIL_UUID] } }, { teams: { some: { opmcId: { in: scope.length ? scope : [NIL_UUID] } } } }] }),
        },
        select: { id: true },
      });
      if (!allowed) throw AppError.forbidden('CONTRACTOR_ACCESS_DENIED');
      contractorId = allowed.id;
    }

    const stock = contractorId
      ? await prisma.contractorStock.findMany({ where: { contractorId }, select: { itemId: true, quantity: true, item: { select: { code: true, name: true, unit: true } } } })
      : [];
    const batches = contractorId
      ? await prisma.contractorBatchStock.groupBy({ by: ['itemId'], where: { contractorId }, _sum: { quantity: true } })
      : [];
    const batchQty = new Map(batches.map((b) => [b.itemId, Number(b._sum.quantity ?? 0)]));

    const reportedItemIds = order.sltReportedMaterials.map((r) => r.itemId).filter((v): v is string => !!v);
    const reportedItems = reportedItemIds.length
      ? await prisma.inventoryItem.findMany({ where: { id: { in: reportedItemIds } }, select: { id: true, code: true } })
      : [];
    const codeById = new Map(reportedItems.map((i) => [i.id, i.code]));
    const latest = order.sltReportedMaterials.reduce<Date | null>((m, r) => (!m || r.reportedAt > m ? r.reportedAt : m), null);

    return {
      contractorId,
      contractorStock: stock.map((s) => ({ itemId: s.itemId, code: s.item.code, name: s.item.name, unit: s.item.unit, quantity: Number(s.quantity), usableQuantity: Math.min(Number(s.quantity), batchQty.get(s.itemId) ?? 0) })),
      sltReported: order.sltReportedMaterials.map((r) => ({ itemId: r.itemId, code: (r.itemId && codeById.get(r.itemId)) || r.rawCode, label: r.rawName || r.rawCode, quantity: Number(r.quantity), source: r.source, reportedAt: r.reportedAt })),
      sltReceivedAt: latest,
    };
  }

  /**
   * Deviation report: SODs that have an SLT-reported set, compared with manual entries.
   * "Not entered" is only raised for COMPLETED orders (an open order may still be filled in).
   */
  static async deviationReport(userId: string, filters: { from?: Date; to?: Date; opmcId?: string; contractorId?: string; onlyDeviations?: boolean; limit?: number }) {
    const scope = await resolveOpmcScope(userId);
    const where: Prisma.ServiceOrderWhereInput = { sltReportedMaterials: { some: {} } };
    if (scope !== undefined) where.opmcId = { in: scope.length ? scope : [NIL_UUID] };
    if (filters.opmcId) where.opmcId = scope === undefined ? filters.opmcId : scope.includes(filters.opmcId) ? filters.opmcId : NIL_UUID;
    if (filters.contractorId) where.contractorId = filters.contractorId;
    if (filters.from || filters.to) where.updatedAt = { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) };

    const orders = await prisma.serviceOrder.findMany({
      where,
      take: Math.min(filters.limit ?? 500, 2000),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, soNum: true, sltsStatus: true, opmcId: true, contractorId: true, updatedAt: true,
        opmc: { select: { rtom: true } },
        contractor: { select: { name: true } },
        sltReportedMaterials: { select: { itemId: true, rawCode: true, rawName: true, quantity: true } },
        materialUsage: { select: { itemId: true, usageType: true, quantity: true } },
      },
    });
    const itemIds = new Set<string>();
    for (const o of orders) {
      for (const r of o.sltReportedMaterials) if (r.itemId) itemIds.add(r.itemId);
      for (const m of o.materialUsage) itemIds.add(m.itemId);
    }
    const items = await prisma.inventoryItem.findMany({ where: { id: { in: [...itemIds] } }, select: { id: true, code: true, name: true } });
    const itemName = new Map(items.map((i) => [i.id, `${i.code} ${i.name}`]));

    const out = orders.map((o) => {
      const completed = o.sltsStatus === 'COMPLETED';
      let lines: DeviationLine[] = compareMaterial(
        o.sltReportedMaterials.map((r) => ({ itemId: r.itemId, label: r.rawCode || r.rawName || 'UNKNOWN', quantity: Number(r.quantity) })),
        o.materialUsage.map((m) => ({ itemId: m.itemId, usageType: m.usageType, quantity: Number(m.quantity) })),
      );
      if (!completed) lines = lines.filter((l) => l.type !== 'NOT_ENTERED');
      lines = lines.map((l) => ({ ...l, label: (l.itemId && itemName.get(l.itemId)) || l.label }));
      return { id: o.id, soNum: o.soNum, status: o.sltsStatus, rtom: o.opmc?.rtom ?? null, contractorId: o.contractorId, contractor: o.contractor?.name ?? null, updatedAt: o.updatedAt, deviates: hasDeviation(lines), lines };
    });
    const rows = filters.onlyDeviations === false ? out : out.filter((o) => o.deviates);

    const byContractor = new Map<string, { contractor: string; orders: number; deviating: number }>();
    for (const o of out) {
      const key = o.contractorId || 'NONE';
      const cur = byContractor.get(key) || { contractor: o.contractor || 'Unassigned', orders: 0, deviating: 0 };
      cur.orders += 1;
      if (o.deviates) cur.deviating += 1;
      byContractor.set(key, cur);
    }
    const count = (t: string) => rows.reduce((n, o) => n + o.lines.filter((l) => l.type === t).length, 0);
    return {
      summary: { ordersCompared: out.length, ordersWithDeviation: out.filter((o) => o.deviates).length, qtyMismatch: count('QTY_MISMATCH'), notEntered: count('NOT_ENTERED'), notReported: count('NOT_REPORTED'), unmapped: count('UNMAPPED') },
      byContractor: [...byContractor.values()].map((c) => ({ ...c, deviationRate: c.orders ? Math.round((c.deviating / c.orders) * 1000) / 10 : 0 })).sort((a, b) => b.deviationRate - a.deviationRate),
      orders: rows,
    };
  }
}
