import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { NIL_UUID, resolveOpmcScope } from '@/lib/opmc-scope';
import { ProjectMaterialReservationService } from '@/services/project/project-material-reservation.service';
import { StockRequestService } from './stock-request.service';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { StoreService } from './store.service';

type SourceType = 'SLT' | 'LOCAL_PURCHASE';

interface BoardFilters {
  userId: string;
  projectId?: string;
  sourceType?: string;
  status?: string;
}

interface SourceAllocationInput {
  requirementId: string;
  sourceType: SourceType;
  storeId: string;
  requestedQty?: number;
  requiredDate?: string;
  notes?: string;
  userId: string;
}

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function requestItemForRequirement(
  request: { items: Array<{ itemId: string; requestedQty: unknown; approvedQty: unknown; receivedQty: unknown }> } | null,
  itemId: string | null,
) {
  if (!request || !itemId) return null;
  return request.items.find((item) => item.itemId === itemId) ?? null;
}

export class ProjectMaterialDemandService {
  /**
   * Inventory-side view of approved project material demand. This service does
   * not update Project.status or any Project workflow stage.
   */
  static async getBoard(filters: BoardFilters) {
    const scope = await resolveOpmcScope(filters.userId);
    const opmcFilter = scope === undefined
      ? undefined
      : { in: scope.length > 0 ? scope : [NIL_UUID] };

    const requirements = await prisma.projectMaterialRequirement.findMany({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(opmcFilter ? { project: { opmcId: opmcFilter } } : {}),
      },
      include: {
        project: { select: { id: true, projectCode: true, name: true, status: true, opmc: { select: { id: true, name: true, rtom: true } } } },
        item: { select: { id: true, code: true, name: true, unit: true } },
        boqItem: { select: { id: true, itemCode: true, description: true, quantity: true } },
        task: { select: { id: true, name: true, wbsCode: true } },
        contractorAssignment: { include: { contractor: { select: { id: true, name: true } } } },
        supplyAllocations: {
          where: filters.sourceType ? { sourceType: filters.sourceType } : undefined,
          orderBy: { createdAt: 'asc' },
          include: {
            store: { select: { id: true, name: true, type: true } },
            stockRequest: {
              select: {
                id: true,
                requestNr: true,
                status: true,
                workflowStage: true,
                procurementStatus: true,
                sourceType: true,
                issueNoteNumber: true,
                items: { select: { itemId: true, requestedQty: true, approvedQty: true, receivedQty: true } },
              },
            },
          },
        },
      },
      orderBy: [{ project: { projectCode: 'asc' } }, { createdAt: 'asc' }],
    });

    const itemIds = [...new Set(requirements.flatMap((row) => row.itemId ? [row.itemId] : []))];
    const stocks = itemIds.length === 0 ? [] : await prisma.inventoryStock.findMany({
      where: {
        itemId: { in: itemIds },
        ...(opmcFilter ? { store: { opmcs: { some: { id: opmcFilter } } } } : {}),
      },
      select: {
        storeId: true,
        itemId: true,
        quantity: true,
        allocatedQuantity: true,
        minLevel: true,
        store: { select: { id: true, name: true, type: true } },
      },
    });

    return requirements.map((requirement) => ({
      id: requirement.id,
      project: requirement.project,
      task: requirement.task,
      contractor: requirement.contractorAssignment?.contractor ?? null,
      item: requirement.item,
      boqItem: requirement.boqItem,
      requiredQty: asNumber(requirement.requiredQty),
      reservedQty: asNumber(requirement.reservedQty),
      issuedQty: asNumber(requirement.issuedQty),
      returnedQty: asNumber(requirement.returnedQty),
      shortageQty: asNumber(requirement.shortageQty),
      status: requirement.status,
      procurementStatus: requirement.procurementStatus,
      availability: stocks
        .filter((stock) => stock.itemId === requirement.itemId)
        .map((stock) => ({
          storeId: stock.storeId,
          storeName: stock.store.name,
          storeType: stock.store.type,
          onHand: asNumber(stock.quantity),
          reserved: asNumber(stock.allocatedQuantity),
          safetyStock: asNumber(stock.minLevel),
          availableToPromise: Math.max(0, asNumber(stock.quantity) - asNumber(stock.allocatedQuantity) - asNumber(stock.minLevel)),
        })),
      allocations: requirement.supplyAllocations.map((allocation) => {
        const requestItem = requestItemForRequirement(allocation.stockRequest, requirement.itemId);
        const receivedQty = requestItem ? asNumber(requestItem.receivedQty) : asNumber(allocation.receivedQty);
        const requestedQty = requestItem ? asNumber(requestItem.requestedQty) : asNumber(allocation.requestedQty);
        return {
          id: allocation.id,
          sourceType: allocation.sourceType,
          status: allocation.stockRequest?.workflowStage ?? allocation.status,
          requestedQty,
          approvedQty: requestItem ? asNumber(requestItem.approvedQty) : asNumber(allocation.approvedQty),
          receivedQty,
          reservedQty: asNumber(allocation.reservedQty),
          issuedQty: asNumber(allocation.issuedQty),
          store: allocation.store,
          request: allocation.stockRequest ? {
            id: allocation.stockRequest.id,
            requestNr: allocation.stockRequest.requestNr,
            status: allocation.stockRequest.status,
            workflowStage: allocation.stockRequest.workflowStage,
            procurementStatus: allocation.stockRequest.procurementStatus,
            issueNoteNumber: allocation.stockRequest.issueNoteNumber,
          } : null,
        };
      }),
    }));
  }

  static async syncProject(projectId: string, userId: string) {
    await assertProjectAccess(projectId, userId);
    return ProjectMaterialReservationService.syncForProject(projectId);
  }

  static async reserveAvailable(input: { projectId: string; storeId: string; userId: string; requirementIds?: string[]; notes?: string }) {
    await assertProjectAccess(input.projectId, input.userId);
    await StoreService.assertStoreWriteAccess(input.userId, input.storeId);
    const result = await ProjectMaterialReservationService.reserve(input);

    if (result.status !== 'RESERVED' || !result.reservation) return result;

    const requirements = await prisma.projectMaterialRequirement.findMany({
      where: {
        projectId: input.projectId,
        ...(input.requirementIds?.length ? { id: { in: input.requirementIds } } : {}),
      },
      select: { id: true, requiredQty: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const requirement of requirements) {
        const quantity = asNumber(requirement.requiredQty);
        await tx.projectMaterialSupplyAllocation.upsert({
          where: { requirementId_sourceType: { requirementId: requirement.id, sourceType: 'STORE' } },
          create: {
            requirementId: requirement.id,
            sourceType: 'STORE',
            storeId: input.storeId,
            requestedQty: quantity,
            approvedQty: quantity,
            reservedQty: quantity,
            status: 'RESERVED',
            notes: input.notes || null,
            createdById: input.userId,
          },
          update: {
            storeId: input.storeId,
            requestedQty: quantity,
            approvedQty: quantity,
            reservedQty: quantity,
            status: 'RESERVED',
            notes: input.notes || undefined,
          },
        });
      }
    });

    return result;
  }

  static async createSourceAllocation(input: SourceAllocationInput) {
    const requirement = await prisma.projectMaterialRequirement.findUnique({
      where: { id: input.requirementId },
      include: { project: { select: { id: true, projectCode: true, name: true } }, item: true },
    });
    if (!requirement) throw AppError.notFound('MATERIAL_REQUIREMENT_NOT_FOUND');
    await assertProjectAccess(requirement.projectId, input.userId);
    await StoreService.assertStoreWriteAccess(input.userId, input.storeId);
    if (!requirement.itemId || !requirement.item) throw AppError.badRequest('MATERIAL_ITEM_MAPPING_REQUIRED');

    const existing = await prisma.projectMaterialSupplyAllocation.findUnique({
      where: { requirementId_sourceType: { requirementId: input.requirementId, sourceType: input.sourceType } },
      include: { stockRequest: { select: { id: true, requestNr: true, workflowStage: true } } },
    });
    if (existing) {
      if (existing.status === 'CREATING') throw AppError.conflict('SOURCE_REQUEST_CREATION_IN_PROGRESS');
      return existing;
    }

    const alreadySourced = await prisma.projectMaterialSupplyAllocation.aggregate({
      where: { requirementId: input.requirementId, status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] } },
      _sum: { requestedQty: true },
    });
    const remaining = Math.max(0, asNumber(requirement.requiredQty) - asNumber(requirement.issuedQty) - asNumber(alreadySourced._sum.requestedQty));
    const requestedQty = input.requestedQty && input.requestedQty > 0 ? Math.min(input.requestedQty, remaining) : remaining;
    if (requestedQty <= 0) throw AppError.badRequest('MATERIAL_REQUIREMENT_ALREADY_SOURCED');

    let fromStoreId = input.storeId;
    let toStoreId: string | undefined;
    if (input.sourceType === 'SLT') {
      const mainStore = await InventoryRepository.findMainStore();
      if (!mainStore) throw AppError.badRequest('MAIN_STORE_REQUIRED_FOR_SLT_REQUEST');
      fromStoreId = mainStore.id;
      if (mainStore.id !== input.storeId) toStoreId = input.storeId;
    }

    // Claim the unique requirement/source pair before calling the existing
    // request pipeline. This prevents double-clicks from creating duplicate
    // SLT/local requests while preserving the established approval flow.
    const allocation = await prisma.projectMaterialSupplyAllocation.create({
      data: {
        requirementId: input.requirementId,
        sourceType: input.sourceType,
        storeId: input.storeId,
        requestedQty,
        status: 'CREATING',
        requiredDate: input.requiredDate ? new Date(input.requiredDate) : null,
        notes: input.notes || null,
        createdById: input.userId,
      },
    });
    await prisma.projectMaterialRequirement.update({
      where: { id: input.requirementId },
      data: { procurementStatus: 'REQUIRED' },
    });

    try {
      const stockRequest = await StockRequestService.createStockRequest({
        fromStoreId,
        toStoreId,
        requestedById: input.userId,
        sourceType: input.sourceType,
        requiredDate: input.requiredDate,
        purpose: `Project ${requirement.project.projectCode}: ${requirement.project.name} / material ${requirement.item.code}`,
        items: [{ itemId: requirement.itemId, requestedQty, remarks: input.notes }],
      });

      return prisma.projectMaterialSupplyAllocation.update({
        where: { id: allocation.id },
        data: { stockRequestId: stockRequest.id, status: 'REQUESTED' },
        include: { stockRequest: { select: { id: true, requestNr: true, workflowStage: true, sourceType: true } } },
      });
    } catch (error) {
      await prisma.projectMaterialSupplyAllocation.delete({ where: { id: allocation.id } }).catch(() => undefined);
      throw error;
    }
  }
}
