import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { LedgerService } from '../finance/ledger.service';
import { AuditLedgerService } from './audit-ledger.service';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { Prisma } from '@prisma/client';

export interface CreateCycleCountInput {
    storeId: string;
    countedById: string;
    countType?: 'BLIND' | 'REGULAR';
    remarks?: string;
    itemIds?: string[];
}

export interface SubmitCycleCountLineInput {
    lineId: string;
    countedQty: number;
    notes?: string;
}

export class CycleCountService {
    static async createCycleCount(data: CreateCycleCountInput) {
        const store = await prisma.inventoryStore.findUnique({
            where: { id: data.storeId }
        });

        if (!store) {
            throw AppError.notFound("Store not found");
        }

        const countNumber = await AuditLedgerService.getNextDocumentNumber('CC');

        // Fetch store current stocks
        const stockQuery: Prisma.InventoryStockWhereInput = { storeId: data.storeId };
        if (data.itemIds && data.itemIds.length > 0) {
            stockQuery.itemId = { in: data.itemIds };
        }

        const currentStocks = await prisma.inventoryStock.findMany({
            where: stockQuery,
            include: { item: true }
        });

        if (currentStocks.length === 0) {
            throw AppError.badRequest("No inventory items found in this store to count.");
        }

        const header = await prisma.cycleCountHeader.create({
            data: {
                countNumber,
                storeId: data.storeId,
                countedById: data.countedById,
                countType: data.countType || 'BLIND',
                status: 'DRAFT',
                remarks: data.remarks,
                lines: {
                    create: currentStocks.map(s => {
                        const unitCost = Number(s.item.costPrice || s.item.unitPrice || 0);
                        return {
                            itemId: s.itemId,
                            systemQty: s.quantity,
                            countedQty: 0,
                            varianceQty: 0,
                            unitCost,
                            varianceValue: 0
                        };
                    })
                }
            },
            include: {
                lines: {
                    include: { item: true }
                },
                store: true,
                countedBy: {
                    select: { id: true, name: true, username: true }
                }
            }
        });

        return header;
    }

    static async getCycleCounts(storeId?: string, status?: string) {
        const where: Prisma.CycleCountHeaderWhereInput = {};
        if (storeId) where.storeId = storeId;
        if (status) where.status = status;

        return await prisma.cycleCountHeader.findMany({
            where,
            include: {
                store: { select: { id: true, name: true } },
                countedBy: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                _count: { select: { lines: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async getCycleCountById(id: string) {
        const header = await prisma.cycleCountHeader.findUnique({
            where: { id },
            include: {
                store: true,
                countedBy: { select: { id: true, name: true, username: true } },
                approvedBy: { select: { id: true, name: true, username: true } },
                lines: {
                    include: { item: true, batch: true }
                }
            }
        });

        if (!header) {
            throw AppError.notFound("Cycle count audit record not found");
        }

        return header;
    }

    static async submitCountResults(headerId: string, lines: SubmitCycleCountLineInput[]) {
        const header = await prisma.cycleCountHeader.findUnique({
            where: { id: headerId },
            include: { lines: true }
        });

        if (!header) {
            throw AppError.notFound("Cycle count header not found");
        }

        if (header.status !== 'DRAFT' && header.status !== 'IN_PROGRESS') {
            throw AppError.badRequest("Cannot update cycle count that is not in DRAFT or IN_PROGRESS state.");
        }

        let totalVarianceValue = 0;

        await prisma.$transaction(async (tx) => {
            for (const lineInput of lines) {
                const existingLine = header.lines.find(l => l.id === lineInput.lineId);
                if (!existingLine) continue;

                const sysQty = Number(existingLine.systemQty);
                const cntQty = Number(lineInput.countedQty);
                const varQty = cntQty - sysQty;
                const cost = Number(existingLine.unitCost);
                const varValue = varQty * cost;

                totalVarianceValue += Math.abs(varValue);

                await tx.cycleCountLine.update({
                    where: { id: lineInput.lineId },
                    data: {
                        countedQty: cntQty,
                        varianceQty: varQty,
                        varianceValue: varValue,
                        notes: lineInput.notes
                    }
                });
            }

            await tx.cycleCountHeader.update({
                where: { id: headerId },
                data: {
                    status: 'PENDING_APPROVAL',
                    totalVarianceValue,
                    completedDate: new Date()
                }
            });
        });

        return { message: "Cycle count submitted for approval", totalVarianceValue };
    }

    static async approveCycleCount(headerId: string, approvedById: string) {
        const header = await prisma.cycleCountHeader.findUnique({
            where: { id: headerId },
            include: { lines: { include: { item: true } } }
        });

        if (!header) {
            throw AppError.notFound("Cycle count header not found");
        }

        // Fast pre-check only — the atomic updateMany claim inside the
        // transaction below is the real concurrency gate.
        if (header.status !== 'PENDING_APPROVAL') {
            throw AppError.badRequest("Cycle count is not pending approval.");
        }

        // Fail closed BEFORE the counter-vs-approver comparison: a null/empty/missing
        // approver identity must never reach the SoD inequality check (where it would
        // silently pass), and must not be persisted as approvedById.
        if (!approvedById) {
            throw AppError.unauthorized('APPROVER_ID_MISSING');
        }

        // Segregation of Duties (SoD): the counter cannot approve their own count.
        // SUPER_ADMIN bypass follows the stock-request precedent.
        const approver = await prisma.user.findUnique({
            where: { id: approvedById },
            select: { role: true }
        });
        if (!approver) {
            throw AppError.unauthorized('USER_NOT_FOUND');
        }
        if (approver.role !== 'SUPER_ADMIN' && approver.role !== 'ADMIN' && header.countedById === approvedById) {
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: The cycle counter cannot approve their own count.');
        }

        await prisma.$transaction(async (tx: TransactionClient) => {
            // Atomic approval claim: flip PENDING_APPROVAL → APPROVED in a single
            // conditional write so two concurrent approvals cannot both proceed.
            const claimed = await tx.cycleCountHeader.updateMany({
                where: { id: headerId, status: 'PENDING_APPROVAL' },
                data: { status: 'APPROVED', approvedById }
            });
            if (claimed.count === 0) {
                throw AppError.conflict('CYCLE_COUNT_ALREADY_PROCESSED: This cycle count is no longer pending approval.');
            }

            // Apply adjustments to stock
            for (const line of header.lines) {
                const varQty = Number(line.varianceQty);
                if (varQty === 0) continue;

                // Capture true pre-adjustment balance for the immutable ledger chain
                const existingStock = await tx.inventoryStock.findUnique({
                    where: {
                        storeId_itemId: {
                            storeId: header.storeId,
                            itemId: line.itemId
                        }
                    },
                    select: { quantity: true }
                });
                const quantityBefore = existingStock ? Number(existingStock.quantity) : 0;

                // Update InventoryStock
                await tx.inventoryStock.upsert({
                    where: {
                        storeId_itemId: {
                            storeId: header.storeId,
                            itemId: line.itemId
                        }
                    },
                    update: {
                        quantity: { increment: varQty }
                    },
                    create: {
                        storeId: header.storeId,
                        itemId: line.itemId,
                        quantity: Number(line.countedQty)
                    }
                });

                // Write immutable Inventory Ledger entry (approved correction path)
                await AuditLedgerService.recordEntry({
                    storeId: header.storeId,
                    itemId: line.itemId,
                    batchId: line.batchId,
                    transactionType: 'CYCLE_COUNT_CORRECTION',
                    referenceType: 'CycleCount',
                    referenceId: header.id,
                    quantityBefore,
                    quantityChange: varQty,
                    quantityAfter: quantityBefore + varQty,
                    unitPrice: Number(line.unitCost || 0),
                    performedById: approvedById,
                    idempotencyKey: `cycle-count-${header.id}-${line.id}`
                }, tx);
            }

            // Log Inventory Transaction
            await tx.inventoryTransaction.create({
                data: {
                    type: 'CYCLE_COUNT_ADJUSTMENT',
                    storeId: header.storeId,
                    referenceId: header.countNumber,
                    notes: `Cycle count physical adjustment (${header.countNumber})`,
                    userId: approvedById,
                    items: {
                        create: header.lines.map(l => ({
                            itemId: l.itemId,
                            quantity: l.varianceQty
                        }))
                    }
                }
            });

            // Post GL Journal Entry if variance value > 0
            if (Number(header.totalVarianceValue) !== 0) {
                await LedgerService.logCycleCountAdjustment(
                    tx,
                    header.id,
                    header.countNumber,
                    Number(header.totalVarianceValue),
                    `Physical Stock Adjustment - ${header.countNumber}`
                );
            }
        });

        return { message: "Cycle count approved and stock adjusted successfully" };
    }
}
