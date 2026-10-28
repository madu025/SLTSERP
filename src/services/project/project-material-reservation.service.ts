import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { TransactionClient } from '@/types/inventory/inventory-service.types';

type MaterialDb = typeof prisma | TransactionClient;

interface ReserveInput {
  projectId: string;
  storeId: string;
  userId: string;
  requirementIds?: string[];
  notes?: string | null;
}

interface LockedStockRow {
  id: string;
  quantity: number;
  allocatedQuantity: number;
  minLevel: number;
}

export class ProjectMaterialReservationService {
  /** Create or refresh requirements from the approved BOQ without touching stock. */
  static async syncForProject(projectId: string, db: MaterialDb = prisma) {
    const approval = await db.bOQApproval.findFirst({
      where: { projectId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!approval) throw AppError.badRequest('BOQ_APPROVAL_REQUIRED_FOR_MATERIAL_REQUIREMENTS');

    const boqItems = await db.projectBOQItem.findMany({
      where: { projectId },
      select: {
        id: true,
        quantity: true,
        materialId: true,
        taskId: true,
        task: { select: { contractorAssignmentId: true } },
      },
    });

    for (const item of boqItems) {
      await db.projectMaterialRequirement.upsert({
        where: { boqItemId: item.id },
        create: {
          projectId,
          boqItemId: item.id,
          taskId: item.taskId,
          contractorAssignmentId: item.task?.contractorAssignmentId || null,
          itemId: item.materialId,
          requiredQty: item.quantity,
          status: item.materialId ? 'PLANNED' : 'UNMAPPED',
          procurementStatus: item.materialId ? 'NOT_REQUIRED' : 'MATERIAL_MAPPING_REQUIRED',
        },
        update: {
          taskId: item.taskId,
          contractorAssignmentId: item.task?.contractorAssignmentId || null,
          itemId: item.materialId,
          requiredQty: item.quantity,
          status: item.materialId ? undefined : 'UNMAPPED',
          procurementStatus: item.materialId ? undefined : 'MATERIAL_MAPPING_REQUIRED',
        },
      });
    }

    return this.getOverview(projectId, db);
  }

  static async getOverview(projectId: string, db: MaterialDb = prisma) {
    const requirements = await db.projectMaterialRequirement.findMany({
      where: { projectId },
      include: {
        item: { select: { id: true, code: true, name: true, unit: true } },
        boqItem: { select: { id: true, itemCode: true, description: true, quantity: true } },
        task: { select: { id: true, name: true, wbsCode: true } },
        contractorAssignment: { include: { contractor: { select: { id: true, name: true } } } },
        reservations: {
          include: { reservation: { select: { id: true, reservationNumber: true, storeId: true, status: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const itemIds = requirements.flatMap((requirement) => requirement.itemId ? [requirement.itemId] : []);
    const stocks = itemIds.length === 0 ? [] : await db.inventoryStock.findMany({
      where: { itemId: { in: itemIds } },
      select: { storeId: true, itemId: true, quantity: true, allocatedQuantity: true, minLevel: true, store: { select: { id: true, name: true } } },
    });

    return requirements.map((requirement) => ({
      ...requirement,
      availability: stocks
        .filter((stock) => stock.itemId === requirement.itemId)
        .map((stock) => ({
          storeId: stock.storeId,
          storeName: stock.store.name,
          onHand: Number(stock.quantity),
          reserved: Number(stock.allocatedQuantity),
          safetyStock: Number(stock.minLevel),
          availableToPromise: Math.max(0, Number(stock.quantity) - Number(stock.allocatedQuantity) - Number(stock.minLevel)),
        })),
    }));
  }

  /**
   * Reserve a complete requirement set from one store. No physical stock is
   * deducted. Every write is inside one transaction so a shortage cannot leave
   * half a reservation behind.
   */
  static async reserve(input: ReserveInput) {
    if (!input.userId) throw AppError.unauthorized('Authenticated store actor is required');
    return prisma.$transaction(async (tx) => {
      await this.syncForProject(input.projectId, tx);

      const requirements = await tx.projectMaterialRequirement.findMany({
        where: {
          projectId: input.projectId,
          ...(input.requirementIds?.length ? { id: { in: input.requirementIds } } : {}),
          status: { notIn: ['UNMAPPED', 'CLOSED', 'CANCELLED', 'RESERVED'] },
        },
      });
      if (requirements.length === 0) throw AppError.badRequest('NO_RESERVABLE_MATERIAL_REQUIREMENTS');

      const lockedStocks = new Map<string, LockedStockRow>();
      const shortages: Array<{ requirementId: string; itemId: string | null; shortageQty: number }> = [];

      for (const requirement of requirements) {
        const remaining = Math.max(0, Number(requirement.requiredQty) - Number(requirement.reservedQty));
        if (remaining <= 0 || !requirement.itemId) continue;

        const rows = await tx.$queryRaw<Array<{ id: string; quantity: number; allocatedQuantity: number; minLevel: number }>>`
          SELECT id, quantity, "allocatedQuantity", "minLevel"
          FROM "InventoryStock"
          WHERE "storeId" = ${input.storeId}::uuid AND "itemId" = ${requirement.itemId}::uuid
          FOR UPDATE
        `;
        const stock = rows[0];
        if (!stock) {
          shortages.push({ requirementId: requirement.id, itemId: requirement.itemId, shortageQty: remaining });
          continue;
        }
        lockedStocks.set(requirement.itemId, stock);
        const available = Number(stock.quantity) - Number(stock.allocatedQuantity) - Number(stock.minLevel);
        if (available < remaining) {
          shortages.push({ requirementId: requirement.id, itemId: requirement.itemId, shortageQty: Math.max(0, remaining - available) });
        }
      }

      if (shortages.length > 0) {
        for (const shortage of shortages) {
          await tx.projectMaterialRequirement.update({
            where: { id: shortage.requirementId },
            data: { status: 'SHORTAGE', shortageQty: shortage.shortageQty, procurementStatus: 'REQUIRED' },
          });
        }
        return { status: 'SHORTAGE', shortages };
      }

      const reservationNumber = await AuditLedgerService.getNextDocumentNumber('PMR', tx);
      const reservation = await tx.projectMaterialReservation.create({
        data: {
          reservationNumber,
          projectId: input.projectId,
          storeId: input.storeId,
          createdById: input.userId,
          notes: input.notes || null,
        },
      });

      for (const requirement of requirements) {
        if (!requirement.itemId) continue;
        const remaining = Math.max(0, Number(requirement.requiredQty) - Number(requirement.reservedQty));
        if (remaining <= 0) continue;

        let left = remaining;
        const batchRows = await tx.$queryRaw<Array<{ id: string; batchId: string; quantity: number; allocatedQuantity: number }>>`
          SELECT bs.id, bs."batchId", bs.quantity, bs."allocatedQuantity"
          FROM "InventoryBatchStock" bs
          JOIN "InventoryBatch" b ON b.id = bs."batchId"
          WHERE bs."storeId" = ${input.storeId}::uuid
            AND bs."itemId" = ${requirement.itemId}::uuid
            AND bs.quantity - bs."allocatedQuantity" > 0
          ORDER BY b."expiryDate" ASC NULLS LAST, b."createdAt" ASC
          FOR UPDATE OF bs
        `;

        for (const batch of batchRows) {
          if (left <= 0) break;
          const available = Number(batch.quantity) - Number(batch.allocatedQuantity);
          const take = Math.min(available, left);
          if (take <= 0) continue;
          await tx.inventoryBatchStock.update({ where: { id: batch.id }, data: { allocatedQuantity: { increment: take } } });
          await tx.projectMaterialReservationLine.create({
            data: { reservationId: reservation.id, requirementId: requirement.id, itemId: requirement.itemId, batchId: batch.batchId, batchStockId: batch.id, quantity: take },
          });
          left -= take;
        }

        if (left > 0) {
          // Legacy stock may have a summary row but no batch rows. Preserve the
          // reservation rather than silently losing the requirement; issuing
          // such a line must still be audited and batch-picked later.
          await tx.projectMaterialReservationLine.create({
            data: { reservationId: reservation.id, requirementId: requirement.id, itemId: requirement.itemId, quantity: left },
          });
        }

        const stock = lockedStocks.get(requirement.itemId);
        if (!stock) throw AppError.badRequest('INVENTORY_STOCK_ROW_NOT_FOUND');
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: { allocatedQuantity: { increment: remaining } },
        });
        await tx.projectMaterialRequirement.update({
          where: { id: requirement.id },
          data: { reservedQty: { increment: remaining }, shortageQty: 0, status: 'RESERVED', procurementStatus: 'NOT_REQUIRED' },
        });
      }

      return { status: 'RESERVED', reservation };
    });
  }

  /**
   * Consume a reservation while approving a physical project issue. The
   * caller must already be inside the approval transaction. This is the only
   * path that may turn an allocated quantity into a physical stock deduction.
   */
  static async consumeForIssue(
    tx: TransactionClient,
    input: { reservationId: string; projectId: string; storeId: string; items: { itemId: string; quantity: number }[] },
  ) {
    const reservation = await tx.projectMaterialReservation.findUnique({
      where: { id: input.reservationId },
      include: { lines: true },
    });
    if (!reservation || reservation.projectId !== input.projectId || reservation.storeId !== input.storeId) {
      throw AppError.badRequest('RESERVATION_PROJECT_OR_STORE_MISMATCH');
    }
    if (!['RESERVED', 'PARTIAL'].includes(reservation.status)) {
      throw AppError.badRequest('RESERVATION_NOT_ACTIVE');
    }

    const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];
    for (const requested of input.items) {
      let remaining = Number(requested.quantity);
      const lines = reservation.lines
        .filter((line) => line.itemId === requested.itemId && Number(line.quantity) - Number(line.issuedQty) > 0)
        .sort((a, b) => Number(a.quantity) - Number(a.issuedQty) - (Number(b.quantity) - Number(b.issuedQty)));
      const available = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) - Number(line.issuedQty)), 0);
      if (available < remaining) throw AppError.badRequest(`RESERVATION_QTY_INSUFFICIENT_FOR_ITEM_${requested.itemId}`);

      for (const line of lines) {
        if (remaining <= 0) break;
        const lineRemaining = Math.max(0, Number(line.quantity) - Number(line.issuedQty));
        const take = Math.min(lineRemaining, remaining);
        if (line.batchStockId) {
          const batchUpdate = await tx.inventoryBatchStock.updateMany({
            where: { id: line.batchStockId, quantity: { gte: take }, allocatedQuantity: { gte: take } },
            data: { quantity: { decrement: take }, allocatedQuantity: { decrement: take } },
          });
          if (batchUpdate.count !== 1) throw AppError.conflict('BATCH_RESERVATION_STATE_INVALID');
        }
        const stockUpdate = await tx.inventoryStock.updateMany({
          where: { storeId: input.storeId, itemId: requested.itemId, quantity: { gte: take }, allocatedQuantity: { gte: take } },
          data: { quantity: { decrement: take }, allocatedQuantity: { decrement: take } },
        });
        if (stockUpdate.count !== 1) throw AppError.conflict('STOCK_RESERVATION_STATE_INVALID');
        await tx.projectMaterialReservationLine.update({ where: { id: line.id }, data: { issuedQty: { increment: take } } });
        await tx.projectMaterialRequirement.update({
          where: { id: line.requirementId },
          data: { reservedQty: { decrement: take }, issuedQty: { increment: take }, status: 'IN_PROGRESS' },
        });
        const storeAllocation = await tx.projectMaterialSupplyAllocation.findUnique({
          where: { requirementId_sourceType: { requirementId: line.requirementId, sourceType: 'STORE' } },
        });
        if (storeAllocation) {
          const nextReserved = Math.max(0, Number(storeAllocation.reservedQty) - take);
          await tx.projectMaterialSupplyAllocation.update({
            where: { id: storeAllocation.id },
            data: {
              reservedQty: nextReserved,
              issuedQty: { increment: take },
              status: nextReserved > 0 ? 'PARTIALLY_ISSUED' : 'ISSUED',
            },
          });
        }
        if (line.batchId) transactionItems.push({ itemId: requested.itemId, batchId: line.batchId, quantity: -take });
        remaining -= take;
      }
    }

    const openLines = await tx.projectMaterialReservationLine.findMany({ where: { reservationId: input.reservationId } });
    const hasOpenLines = openLines.some((line) => Number(line.quantity) - Number(line.issuedQty) > 0);
    await tx.projectMaterialReservation.update({ where: { id: input.reservationId }, data: { status: hasOpenLines ? 'PARTIAL' : 'CONSUMED' } });
    return transactionItems;
  }

  static async release(reservationId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.projectMaterialReservation.findUnique({ where: { id: reservationId }, include: { lines: true } });
      if (!reservation || !['RESERVED', 'PARTIAL'].includes(reservation.status)) throw AppError.badRequest('RESERVATION_NOT_ACTIVE');

      for (const line of reservation.lines) {
        const remaining = Math.max(0, Number(line.quantity) - Number(line.issuedQty));
        if (remaining <= 0) continue;
        if (line.batchStockId) {
          const batchUpdate = await tx.inventoryBatchStock.updateMany({ where: { id: line.batchStockId, allocatedQuantity: { gte: remaining } }, data: { allocatedQuantity: { decrement: remaining } } });
          if (batchUpdate.count !== 1) throw AppError.conflict('BATCH_RESERVATION_STATE_INVALID');
        }
        const stockUpdate = await tx.inventoryStock.updateMany({ where: { storeId: reservation.storeId, itemId: line.itemId, allocatedQuantity: { gte: remaining } }, data: { allocatedQuantity: { decrement: remaining } } });
        if (stockUpdate.count !== 1) throw AppError.conflict('STOCK_RESERVATION_STATE_INVALID');
        const requirement = await tx.projectMaterialRequirement.findUnique({ where: { id: line.requirementId } });
        if (requirement) {
          const newReserved = Math.max(0, Number(requirement.reservedQty) - remaining);
          await tx.projectMaterialRequirement.update({ where: { id: line.requirementId }, data: { reservedQty: newReserved, status: Number(requirement.shortageQty) > 0 ? 'SHORTAGE' : 'PLANNED' } });
        }
      }

      return tx.projectMaterialReservation.update({ where: { id: reservationId }, data: { status: 'RELEASED', releasedById: userId, releasedAt: new Date() } });
    });
  }
}
