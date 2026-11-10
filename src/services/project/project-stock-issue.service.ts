import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { StockService } from '../inventory/stock.service';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { UUID } from '@/types/common';
import { ProjectMaterialReservationService } from './project-material-reservation.service';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { syncProjectActualCost } from '@/services/project/project-cost.service';
import { LedgerService } from '@/services/finance/ledger.service';
import { StoreService } from '@/services/inventory/store.service';
import { assertProjectAccess } from '@/lib/project-access';

export class ProjectStockIssueService {
    /**
     * Create a pending stock issue request
     */
    static async createIssueRequest(data: {
        projectId: UUID;
        storeId: UUID;
        items: { itemId: UUID; quantity: number | string; remarks?: string }[];
        reservationId?: UUID;
        requirementId?: UUID;
        remarks?: string;
        userId: UUID;
        issueDate?: Date | string;
    }) {
        const { projectId, storeId, items, remarks, userId, issueDate, reservationId } = data;
        let requirementId = data.requirementId;
        let contractorId: UUID | null = null;

        // Generate a globally unique, concurrency-safe issue number. Counting
        // rows is unsafe after QA resets/archival and can reuse an immutable
        // ledger reference (and can also collide under concurrent requests).
        const issueNumber = await AuditLedgerService.getNextDocumentNumber('ISS');

        // Verify stock availability (Preliminary check - batched to avoid N+1 queries)
        const itemIds = items.map(i => i.itemId);
        const stocks = await prisma.inventoryStock.findMany({
            where: {
                storeId: storeId,
                itemId: { in: itemIds }
            },
            include: { item: true }
        });

        const stockMap = new Map(stocks.map(s => [s.itemId, s]));

        for (const item of items) {
            const stock = stockMap.get(item.itemId);
            const requestedQty = parseFloat(item.quantity.toString());
            const availableToPromise = Number(stock?.quantity || 0) - Number(stock?.allocatedQuantity || 0) - Number(stock?.minLevel || 0);
            if (!reservationId && (!stock || availableToPromise < requestedQty)) {
                throw AppError.badRequest(`INSUFFICIENT_STOCK: Insufficient stock for item: ${stock?.item.name || item.itemId}`);
            }
        }

        if (requirementId) {
            const requirement = await prisma.projectMaterialRequirement.findUnique({
                where: { id: requirementId },
                select: { projectId: true, itemId: true, contractorAssignment: { select: { contractorId: true } } },
            });
            if (!requirement || requirement.projectId !== projectId) {
                throw AppError.badRequest('MATERIAL_REQUIREMENT_PROJECT_MISMATCH');
            }
            if (!requirement.itemId || items.some((item) => item.itemId !== requirement.itemId)) {
                throw AppError.badRequest('ISSUE_ITEMS_MUST_MATCH_TASK_REQUIREMENT');
            }
            contractorId = requirement.contractorAssignment?.contractorId || null;
        }

        if (reservationId) {
            const reservation = await prisma.projectMaterialReservation.findUnique({ where: { id: reservationId } });
            if (!reservation || reservation.projectId !== projectId || reservation.storeId !== storeId || !['RESERVED', 'PARTIAL'].includes(reservation.status)) {
                throw AppError.badRequest('RESERVATION_PROJECT_OR_STORE_MISMATCH');
            }
            const reservationLines = await prisma.projectMaterialReservationLine.findMany({
                where: { reservationId, itemId: { in: items.map((item) => item.itemId) } },
                select: { requirementId: true, itemId: true },
            });
            const lineRequirementIds = [...new Set(reservationLines.map((line) => line.requirementId))];
            if (!requirementId && lineRequirementIds.length === 1) requirementId = lineRequirementIds[0];
            if (!requirementId || lineRequirementIds.length !== 1 || lineRequirementIds[0] !== requirementId) {
                throw AppError.badRequest('REQUIREMENT_ID_REQUIRED_FOR_TASK_ISSUE');
            }
            if (!contractorId) {
                const requirement = await prisma.projectMaterialRequirement.findUnique({
                    where: { id: requirementId },
                    select: { projectId: true, itemId: true, contractorAssignment: { select: { contractorId: true } } },
                });
                if (!requirement || requirement.projectId !== projectId || !requirement.itemId || items.some((item) => item.itemId !== requirement.itemId)) {
                    throw AppError.badRequest('RESERVATION_REQUIREMENT_MISMATCH');
                }
                contractorId = requirement.contractorAssignment?.contractorId || null;
            }
        }

        // Fetch Project Name
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true }
        });
        const recipientName = project ? `Project: ${project.name}` : 'Unknown Project';

        // Create PENDING Issue
        const stockIssue = await prisma.stockIssue.create({
            data: {
                issueNumber,
                storeId,
                projectId,
                reservationId,
                requirementId,
                contractorId,
                issuedById: userId,
                issueType: 'PROJECT',
                recipientName,
                remarks,
                status: 'PENDING', // Wait for Approval
                createdAt: issueDate ? new Date(issueDate) : new Date(),
                items: {
                    create: items.map((item) => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity.toString()),
                        remarks: item.remarks
                    }))
                }
            }
        });

        return stockIssue;
    }

    /**
     * Get stock issue requests for a project
     */
    static async getProjectIssues(projectId: UUID) {
        return await prisma.stockIssue.findMany({
            where: { projectId },
            include: {
                store: { select: { name: true } },
                issuedBy: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { code: true, name: true, unit: true } }
                    }
                }
                ,materialRequirement: {
                    select: {
                        task: { select: { name: true, wbsCode: true } },
                        contractorAssignment: { select: { contractor: { select: { name: true } } } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Approve a pending stock issue request
     */
    static async approveIssueRequest(issueId: UUID, approvedById: UUID) {
        const issue = await prisma.stockIssue.findUnique({
            where: { id: issueId },
            include: { items: true }
        });

        if (!issue) {
            throw AppError.badRequest('ISSUE_NOT_FOUND');
        }
        await StoreService.assertStoreWriteAccess(approvedById, issue.storeId);
        if (issue.projectId) await assertProjectAccess(issue.projectId, approvedById);

        if (issue.status !== 'PENDING') {
            throw AppError.badRequest('ISSUE_NOT_PENDING');
        }

        // Segregation of duties: no actor may approve their own stock issue.
        if (!approvedById) {
            throw AppError.badRequest('APPROVER_ID_REQUIRED: approvedById must be provided.');
        }
        const approver = await prisma.user.findUnique({ where: { id: approvedById }, select: { id: true } });
        if (!approver) {
            throw AppError.badRequest('APPROVER_NOT_FOUND: The approver account may have been deleted.');
        }
        if (issue.issuedById && issue.issuedById === approvedById) {
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: Issue creator cannot approve their own stock issue.');
        }

        // Verify stock availability (batched to avoid N+1 queries)
        const issueItemIds = issue.items.map(i => i.itemId);
        const issueStocks = await prisma.inventoryStock.findMany({
            where: {
                storeId: issue.storeId,
                itemId: { in: issueItemIds }
            }
        });

        const issueStockMap = new Map(issueStocks.map(s => [s.itemId, s]));

        for (const item of issue.items) {
            const stock = issueStockMap.get(item.itemId);
            const availableToPromise = Number(stock?.quantity || 0) - Number(stock?.allocatedQuantity || 0) - Number(stock?.minLevel || 0);
            if (!issue.reservationId && (!stock || availableToPromise < item.quantity.toNumber())) {
                throw AppError.badRequest(`INSUFFICIENT_STOCK: Insufficient stock for item ID: ${item.itemId}`);
            }
        }

        // Execute Transaction
        await prisma.$transaction(async (tx) => {
            // 1. Claim the issue (compare-and-set) so concurrent approvals cannot double-post
            const claim = await tx.stockIssue.updateMany({
                where: { id: issueId, status: 'PENDING' },
                data: {
                    status: 'APPROVED',
                    approvedById: approvedById,
                    approvedAt: new Date()
                }
            });
            if (claim.count === 0) {
                throw AppError.conflict('ISSUE_NOT_PENDING');
            }

            const transactionItems: { itemId: UUID; batchId: UUID; quantity: number }[] = [];
            const stockBefore = new Map((await tx.inventoryStock.findMany({
                where: { storeId: issue.storeId, itemId: { in: issueItemIds } },
                select: { itemId: true, quantity: true },
            })).map((row) => [row.itemId, Number(row.quantity)]));

            // 2. Process Items. Reserved issues consume the exact reserved
            // lines; unreserved issues use FIFO against unallocated batches.
            if (issue.reservationId && issue.projectId) {
                transactionItems.push(...await ProjectMaterialReservationService.consumeForIssue(tx as TransactionClient, {
                    reservationId: issue.reservationId,
                    projectId: issue.projectId,
                    storeId: issue.storeId,
                    items: issue.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity.toNumber() })),
                }));
            } else {
                for (const item of issue.items) {
                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx as TransactionClient, issue.storeId, item.itemId, item.quantity.toNumber());
                    for (const picked of pickedBatches) {
                        if (!picked.batchId) continue;
                        await tx.inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId: issue.storeId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                        transactionItems.push({ itemId: item.itemId, batchId: picked.batchId, quantity: -picked.quantity });
                    }
                    // Guarded decrement: never let stock go negative
                    const decremented = await tx.inventoryStock.updateMany({
                        where: { storeId: issue.storeId, itemId: item.itemId, quantity: { gte: item.quantity } },
                        data: { quantity: { decrement: item.quantity } }
                    });
                    if (decremented.count === 0) {
                        throw AppError.badRequest(`INSUFFICIENT_STOCK: Insufficient stock for item ID: ${item.itemId}`);
                    }
                }
            }

            // Bulk update BOQ Actuals via fn_bulk_boq_actual_update (single DB call replaces N+1 loop)
            if (issue.projectId) {
                const boqItemIds = issue.items.map(i => i.itemId);
                const boqQuantities = issue.items.map(i => Number(i.quantity));
                await tx.$queryRaw<[{ updated: bigint }]>`
                    SELECT fn_bulk_boq_actual_update(
                        ${issue.projectId}::uuid,
                        ${boqItemIds}::uuid[],
                        ${boqQuantities}::numeric[]
                    ) as updated
                `;
            }

            // Create InventoryTransaction for tracking
            if (transactionItems.length > 0) {
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'TRANSFER_OUT',
                        storeId: issue.storeId,
                        referenceId: issue.id,
                        notes: `Project Stock Issue Approved - Ref ${issue.issueNumber}`,
                        userId: approvedById,
                        items: {
                            create: transactionItems.map(i => ({
                                itemId: i.itemId,
                                batchId: i.batchId,
                                quantity: i.quantity
                            }))
                        }
                    }
                });
            }

            // Every approved project issue must leave an immutable inventory
            // ledger entry, including legacy summary-stock reservations that
            // have no batch row and therefore do not create transactionItems.
            const itemQuantities = new Map<string, number>();
            for (const item of issue.items) {
                itemQuantities.set(item.itemId, (itemQuantities.get(item.itemId) || 0) + item.quantity.toNumber());
            }
            // Cost basis = what the picked batches cost (FIFO), never the BOQ selling rate or the mutable item price.
            const pickedBatchIds = [...new Set(transactionItems.map((t) => t.batchId))];
            const batchCosts = new Map((await tx.inventoryBatch.findMany({
                where: { id: { in: pickedBatchIds } },
                select: { id: true, costPrice: true },
            })).map((b) => [b.id, Number(b.costPrice || 0)]));
            const itemFallbackCost = new Map((await tx.inventoryItem.findMany({
                where: { id: { in: [...itemQuantities.keys()] } },
                select: { id: true, costPrice: true },
            })).map((item) => [item.id, Number(item.costPrice || 0)]));
            const itemPrices = new Map<string, number>();
            for (const [itemId, quantity] of itemQuantities) {
                const fallback = itemFallbackCost.get(itemId) || 0;
                let value = 0;
                let covered = 0;
                for (const t of transactionItems.filter((x) => x.itemId === itemId)) {
                    const q = Math.abs(t.quantity);
                    const unit = batchCosts.get(t.batchId) || fallback;
                    value += q * unit;
                    covered += q;
                }
                value += Math.max(0, quantity - covered) * fallback;
                itemPrices.set(itemId, quantity > 0 ? Math.round((value / quantity) * 10000) / 10000 : 0);
            }
            const stockAfter = new Map((await tx.inventoryStock.findMany({
                where: { storeId: issue.storeId, itemId: { in: [...itemQuantities.keys()] } },
                select: { itemId: true, quantity: true },
            })).map((row) => [row.itemId, Number(row.quantity)]));
            for (const [itemId, quantity] of itemQuantities) {
                const quantityAfter = stockAfter.get(itemId);
                if (quantityAfter === undefined) throw AppError.conflict('STOCK_ROW_MISSING_AFTER_ISSUE');
                await AuditLedgerService.recordEntry({
                    storeId: issue.storeId,
                    itemId,
                    transactionType: 'PROJECT_ISSUE',
                    referenceType: 'StockIssue',
                    referenceId: issue.issueNumber,
                    quantityBefore: stockBefore.get(itemId) || 0,
                    quantityChange: -quantity,
                    quantityAfter,
                    unitPrice: itemPrices.get(itemId) || 0,
                    performedById: approvedById,
                    idempotencyKey: `PROJECT_ISSUE:${issue.id}:${itemId}`,
                }, tx as TransactionClient);
            }

            if (issue.projectId) {
                let issueCost = 0;
                for (const [itemId, quantity] of itemQuantities) issueCost += quantity * (itemPrices.get(itemId) || 0);
                await LedgerService.logProjectMaterialIssue(tx as TransactionClient, issue.id, issueCost, `Project material issue ${issue.issueNumber} (project ${issue.projectId})`);
                await syncProjectActualCost(tx as TransactionClient, issue.projectId);
            }
        });

        return { success: true };
    }

    /**
     * Create a project material return request
     */
    static async createReturnRequest(data: {
        projectId: UUID;
        storeId: UUID;
        issueId: UUID;
        items: { itemId: UUID; quantity: number | string; condition?: string; remarks?: string }[];
        reason?: string;
        userId: UUID;
    }) {
        const { projectId, storeId, issueId, items, reason, userId } = data;

        if (!issueId || items.length === 0 || items.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
            throw AppError.badRequest('RETURN_SOURCE_ISSUE_AND_POSITIVE_ITEMS_REQUIRED');
        }
        await StoreService.assertStoreWriteAccess(userId, storeId);

        // Concurrency-safe MRN number from the DB document-number generator
        const returnNumber = await AuditLedgerService.generateMRNNumber();

        const returnReq = await prisma.$transaction(async (tx) => {
            // Serialize reservations of the same source issue before counting
            // outstanding returns, including pending requests.
            const locked = await tx.$queryRaw<{ id: string }[]>`
                SELECT id FROM "StockIssue" WHERE id = ${issueId}::uuid FOR UPDATE
            `;
            if (locked.length !== 1) throw AppError.badRequest('SOURCE_ISSUE_NOT_FOUND');
            const issue = await tx.stockIssue.findUnique({
                where: { id: issueId },
                include: { items: true },
            });
            if (!issue || issue.status !== 'APPROVED' || issue.projectId !== projectId || issue.storeId !== storeId) {
                throw AppError.badRequest('SOURCE_ISSUE_NOT_APPROVED_FOR_PROJECT_STORE');
            }
            const priorReturns = await tx.projectMaterialReturn.findMany({
                where: { issueId, status: { in: ['PENDING', 'APPROVED'] } },
                include: { items: true },
            });
            const available = new Map<string, number>();
            for (const line of issue.items) available.set(line.itemId, (available.get(line.itemId) || 0) + Number(line.quantity));
            for (const ret of priorReturns) for (const line of ret.items) {
                available.set(line.itemId, (available.get(line.itemId) || 0) - Number(line.quantity));
            }
            for (const item of items) {
                const remaining = (available.get(item.itemId) || 0) - Number(item.quantity);
                if (remaining < -0.00001) throw AppError.badRequest('RETURN_EXCEEDS_SOURCE_ISSUE_QUANTITY');
                available.set(item.itemId, remaining);
            }
            return tx.projectMaterialReturn.create({
            data: {
                returnNumber,
                projectId,
                storeId,
                issueId,
                returnedById: userId,
                reason,
                status: 'PENDING',
                items: {
                    create: items.map((item) => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity.toString()),
                        condition: item.condition || 'GOOD',
                        remarks: item.remarks
                    }))
                }
            }
            });
        });

        return returnReq;
    }

    /**
     * List returns for a project
     */
    static async getProjectReturns(projectId: UUID) {
        return await prisma.projectMaterialReturn.findMany({
            where: { projectId },
            include: {
                issue: { select: { issueNumber: true } },
                store: { select: { name: true } },
                items: { include: { item: { select: { code: true, name: true, unit: true } } } },
                returnedBy: { select: { name: true } },
                approvedBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Approve a project material return request
     */
    static async approveReturnRequest(returnId: UUID, approvedById: UUID) {
        const returnReq = await prisma.projectMaterialReturn.findUnique({
            where: { id: returnId },
            include: { items: true }
        });

        if (!returnReq || returnReq.status !== 'PENDING') {
            throw AppError.badRequest('INVALID_RETURN_REQUEST');
        }
        if (!returnReq.issueId) throw AppError.badRequest('LEGACY_RETURN_REQUIRES_SOURCE_ISSUE_REVIEW');
        await StoreService.assertStoreWriteAccess(approvedById, returnReq.storeId);

        // Segregation of duties: the returner cannot approve their own return.
        if (!approvedById) {
            throw AppError.badRequest('APPROVER_ID_REQUIRED: approvedById must be provided.');
        }
        const returnApprover = await prisma.user.findUnique({ where: { id: approvedById }, select: { id: true } });
        if (!returnApprover) {
            throw AppError.badRequest('APPROVER_NOT_FOUND: The approver account may have been deleted.');
        }
        if (returnReq.returnedById && returnReq.returnedById === approvedById) {
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: Return creator cannot approve their own material return.');
        }

        await prisma.$transaction(async (tx) => {
            // 1. Claim the return (compare-and-set) so concurrent approvals cannot double-post
            const claim = await tx.projectMaterialReturn.updateMany({
                where: { id: returnId, status: 'PENDING' },
                data: {
                    status: 'APPROVED',
                    approvedById,
                    approvedAt: new Date()
                }
            });
            if (claim.count === 0) {
                throw AppError.badRequest('INVALID_RETURN_REQUEST');
            }

            let returnedValue = 0;
            const transferInItems: { itemId: UUID; quantity: number }[] = [];
            const wastageItems: { itemId: UUID; quantity: number }[] = [];

            // Returned stock is valued at the cost it was issued at (the source issue's ledger row).
            const unitCostOf = async (itemId: string): Promise<number> => {
                const issued = await tx.inventoryLedger.findUnique({
                    where: { idempotencyKey: `PROJECT_ISSUE:${returnReq.issueId}:${itemId}` },
                    select: { unitPrice: true },
                });
                if (issued && Number(issued.unitPrice) > 0) return Number(issued.unitPrice);
                const it = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { costPrice: true } });
                return Number(it?.costPrice || 0);
            };

            // 2. Process Items
            for (const item of returnReq.items) {
                if (item.condition === 'GOOD') {
                    // Add back to stock
                    const before = await tx.inventoryStock.findUnique({
                        where: { storeId_itemId: { storeId: returnReq.storeId, itemId: item.itemId } },
                        select: { quantity: true },
                    });
                    const stockRow = await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: returnReq.storeId, itemId: item.itemId } },
                        create: { storeId: returnReq.storeId, itemId: item.itemId, quantity: item.quantity },
                        update: { quantity: { increment: item.quantity } }
                    });
                    const unitCost = await unitCostOf(item.itemId);
                    await AuditLedgerService.recordEntry({
                        storeId: returnReq.storeId,
                        itemId: item.itemId,
                        transactionType: 'PROJECT_RETURN',
                        referenceType: 'ProjectIR',
                        referenceId: returnReq.returnNumber,
                        quantityBefore: Number(before?.quantity ?? 0),
                        quantityChange: Number(item.quantity),
                        quantityAfter: Number(stockRow.quantity),
                        unitPrice: unitCost,
                        performedById: approvedById,
                        idempotencyKey: `PROJECT_RETURN:${returnReq.id}:${item.id}`,
                    }, tx as TransactionClient);
                    returnedValue += Number(item.quantity) * unitCost;
                    transferInItems.push({ itemId: item.itemId, quantity: Number(item.quantity) });
                } else {
                    // Damaged custody returns do not replenish usable stock or
                    // reverse the project's material consumption and cost.
                    const stockRow = await tx.inventoryStock.findUnique({
                        where: { storeId_itemId: { storeId: returnReq.storeId, itemId: item.itemId } },
                        select: { quantity: true },
                    });
                    const unitCost = await unitCostOf(item.itemId);
                    await AuditLedgerService.recordEntry({
                        storeId: returnReq.storeId,
                        itemId: item.itemId,
                        transactionType: 'WASTAGE_ADJUSTMENT',
                        referenceType: 'ProjectIR',
                        referenceId: returnReq.returnNumber,
                        quantityBefore: Number(stockRow?.quantity ?? 0),
                        quantityChange: 0,
                        quantityAfter: Number(stockRow?.quantity ?? 0),
                        unitPrice: unitCost,
                        performedById: approvedById,
                        idempotencyKey: `PROJECT_RETURN_DAMAGED:${returnReq.id}:${item.id}`,
                    }, tx as TransactionClient);
                    wastageItems.push({ itemId: item.itemId, quantity: Number(item.quantity) });
                }

                // Only reusable material reduces the project's consumed quantity/cost.
                const boqItem = item.condition === 'GOOD' ? await tx.projectBOQItem.findFirst({
                    where: { projectId: returnReq.projectId, materialId: item.itemId }
                }) : null;

                if (boqItem) {
                    const credit = Number(item.quantity) * Number(boqItem.unitRate);
                    await tx.projectBOQItem.update({
                        where: { id: boqItem.id },
                        data: {
                            actualQuantity: { decrement: item.quantity },
                            actualCost: { decrement: credit }
                        }
                    });
                }
            }

            // Create InventoryTransaction records for tracing
            if (transferInItems.length > 0) {
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'TRANSFER_IN',
                        storeId: returnReq.storeId,
                        referenceId: returnReq.id,
                        notes: `Project Return Approved (GOOD items) - Ref ${returnReq.returnNumber}`,
                        userId: approvedById,
                        items: {
                            create: transferInItems.map(i => ({
                                itemId: i.itemId,
                                quantity: i.quantity
                            }))
                        }
                    }
                });
            }

            if (wastageItems.length > 0) {
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'WASTAGE',
                        storeId: returnReq.storeId,
                        referenceId: returnReq.id,
                        notes: `Project Return Approved (DAMAGED items) - Ref ${returnReq.returnNumber}`,
                        userId: approvedById,
                        items: {
                            create: wastageItems.map(i => ({
                                itemId: i.itemId,
                                quantity: i.quantity
                            }))
                        }
                    }
                });
            }

            // 3. Project total cost is recomputed from the ledger (issues minus returns) so it can never drift
            await LedgerService.logProjectMaterialReturn(tx as TransactionClient, returnReq.id, returnedValue, `Project material return ${returnReq.returnNumber}`);
            if (returnReq.projectId) await syncProjectActualCost(tx as TransactionClient, returnReq.projectId);
        });

        return { success: true };
    }
}
