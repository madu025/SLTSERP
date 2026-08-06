import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { MRN, Prisma } from '@prisma/client';
import { NotificationService } from '@/services/notification/notification.service';
import { emitSystemEvent } from '@/lib/events';
import { StockService } from './stock.service';
import { AuditLedgerService } from './audit-ledger.service';
import { StoreService } from './store.service';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { LedgerService } from '../finance/ledger.service';

export class MRNService {
    static async createMRN(data: {
        storeId: string;
        returnType: string;
        returnTo?: string;
        supplier?: string;
        reason?: string;
        grnId?: string;
        returnedById: string;
        items: { itemId: string; quantity: string | number; reason?: string }[];
    }): Promise<MRN> {
        const { storeId, returnType, returnTo, supplier, reason, grnId, returnedById, items } = data;

        // Store-Scope Enforcement: creator must be authorized for the returning store
        await StoreService.assertStoreWriteAccess(returnedById, storeId);

        // Atomic multi-step write: document number reservation + MRN header + item rows
        const mrn = await prisma.$transaction(async (tx: TransactionClient) => {
            const mrnNumber = await AuditLedgerService.generateMRNNumber(tx);

            return await tx.mRN.create({
                data: {
                    mrnNumber,
                    storeId,
                    returnType,
                    returnTo: returnTo || null,
                    supplier: supplier || null,
                    reason: reason || null,
                    grnId: grnId || null,
                    returnedById,
                    status: 'PENDING',
                    items: {
                        create: items.map((i) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity.toString()),
                            reason: i.reason || null
                        }))
                    }
                }
            });
        });

        const [nErr] = await safe(NotificationService.notifyByRole({
            roles: ROLE_GROUPS.STORES_MANAGERS,
            title: 'New MRN Created',
            message: `New Material Return Note ${mrn.mrnNumber} has been created and requires approval.`,
            type: 'INVENTORY',
            priority: 'MEDIUM',
            link: '/admin/inventory/mrns'
        }));
        if (nErr) {
            console.error("Failed to notify for MRN:", nErr);
        }

        return mrn;
    }

    static async getMRNs(storeId?: string, status?: string) {
        const where: Prisma.MRNWhereInput = {};
        if (storeId) where.storeId = storeId;
        if (status) where.status = status;

        return await prisma.mRN.findMany({
            where,
            include: {
                store: true,
                returnedBy: true,
                approvedBy: true,
                items: {
                    include: { item: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async updateMRNStatus(mrnId: string, action: 'APPROVE' | 'REJECT', approvedById: string): Promise<MRN> {
        // Approver identity must be a real authenticated user (session-derived)
        const approver = await prisma.user.findUnique({
            where: { id: approvedById },
            select: { role: true }
        });
        if (!approver) {
            throw AppError.unauthorized('USER_NOT_FOUND');
        }

        // Segregation of Duties (SoD): MRN creator cannot approve/reject their own
        // return note. SUPER_ADMIN/ADMIN bypass follows the stock-request precedent
        // (single-staff stores otherwise deadlock; ADMIN is the operational
        // escalation role).
        const targetMrn = await prisma.mRN.findUnique({
            where: { id: mrnId },
            select: { returnedById: true, status: true }
        });
        if (!targetMrn) {
            throw AppError.notFound('MRN_NOT_FOUND');
        }
        if (!ROLE_GROUPS.CORE_ADMINS.includes(approver.role) && targetMrn.returnedById === approvedById) {
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: MRN creator cannot approve or reject their own material return note.');
        }
        if (targetMrn.status !== 'PENDING') {
            throw AppError.badRequest('MRN_ALREADY_PROCESSED');
        }

        if (action === 'REJECT') {
            // Atomic claim: a single conditional write flips PENDING → REJECTED,
            // so concurrent approve/reject calls cannot both succeed.
            const claimed = await prisma.mRN.updateMany({
                where: { id: mrnId, status: 'PENDING' },
                data: {
                    status: 'REJECTED',
                    approvedById
                }
            });
            if (claimed.count === 0) {
                throw AppError.conflict('MRN_ALREADY_PROCESSED: This material return note has already been approved or rejected.');
            }

            const updated = await prisma.mRN.findUnique({
                where: { id: mrnId },
                include: { returnedBy: true }
            });
            if (!updated) {
                throw AppError.notFound('MRN_NOT_FOUND');
            }

            const [nErr] = await safe(NotificationService.send({
                userId: updated.returnedById,
                title: 'MRN Rejected',
                message: `Your Material Return Note ${updated.mrnNumber} has been rejected.`,
                type: 'INVENTORY',
                priority: 'HIGH',
                link: '/admin/inventory/mrns'
            }));
            
            if (nErr) {
                console.error("Failed to notify MRN rejection:", nErr);
            }
            return updated;
        }

        if (action === 'APPROVE') {
            return await prisma.$transaction(async (tx: TransactionClient) => {
                // Atomic claim: a single conditional write flips PENDING → COMPLETED,
                // replacing the non-atomic findUnique re-check as the concurrency gate.
                const claimed = await tx.mRN.updateMany({
                    where: { id: mrnId, status: 'PENDING' },
                    data: {
                        status: 'COMPLETED',
                        approvedById
                    }
                });
                if (claimed.count === 0) {
                    throw AppError.conflict('MRN_ALREADY_PROCESSED: This material return note has already been approved or rejected.');
                }

                const mrn = await tx.mRN.findUnique({
                    where: { id: mrnId },
                    include: { items: true }
                });

                if (!mrn) throw AppError.notFound("MRN_NOT_FOUND");
                if (!mrn.storeId) throw AppError.badRequest("MRN_STORE_REQUIRED");
                const storeId = mrn.storeId;

                const transactionItems: { itemId: string; quantity: number }[] = [];
                let totalMrnCost = 0;
                for (const item of mrn.items) {
                    const itemMeta = await tx.inventoryItem.findUnique({
                        where: { id: item.itemId },
                        select: { costPrice: true, unitPrice: true }
                    });
                    const costPrice = Number(itemMeta?.costPrice || itemMeta?.unitPrice || 0);
                    totalMrnCost += costPrice * Number(item.quantity);

                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, storeId, item.itemId, item.quantity.toNumber());

                    for (const picked of pickedBatches) {
                        if (!picked.batchId) continue;
                        await tx.inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    const updatedStoreStock = await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId, itemId: item.itemId } },
                        update: { quantity: { decrement: item.quantity } },
                        create: { storeId, itemId: item.itemId, quantity: -item.quantity }
                    });

                    // Write Immutable Inventory Ledger Entry
                    const currentQtyAfter = updatedStoreStock?.quantity ? Number(updatedStoreStock.quantity) : 0;
                    await AuditLedgerService.recordEntry({
                        storeId,
                        itemId: item.itemId,
                        transactionType: 'MRN_APPROVAL',
                        referenceType: 'MRN',
                        referenceId: mrn.id,
                        quantityBefore: currentQtyAfter + Number(item.quantity),
                        quantityChange: -Number(item.quantity),
                        quantityAfter: currentQtyAfter,
                        performedById: approvedById
                    }, tx);

                    transactionItems.push({
                        itemId: item.itemId,
                        quantity: -item.quantity
                    });
                }

                await tx.inventoryTransaction.create({
                    data: {
                        type: 'RETURN',
                        storeId,
                        referenceId: mrn.id,
                        userId: approvedById,
                        notes: `MRN ${mrn.mrnNumber} - ${mrn.returnType}`,
                        items: {
                            create: transactionItems
                        }
                    }
                });

                await LedgerService.logMrnReturn(tx, mrn.id, totalMrnCost);

                const [nErr] = await safe(NotificationService.send({
                    userId: mrn.returnedById,
                    title: 'MRN Completed',
                    message: `Your Material Return Note ${mrn.mrnNumber} has been approved and stock updated.`,
                    type: 'INVENTORY',
                    priority: 'MEDIUM',
                    link: '/admin/inventory/mrns'
                }));
                
                if (nErr) {
                    console.error("Failed to notify MRN completion:", nErr);
                }

                emitSystemEvent('INVENTORY_UPDATE');
                return mrn;
            });
        }

        throw AppError.badRequest('INVALID_ACTION');
    }
}
