import { prisma } from '@/lib/prisma';
import { MRN, Prisma } from '@prisma/client';
import { NotificationService } from '../notification.service';
import { emitSystemEvent } from '@/lib/events';
import { StockService } from './stock.service';
import { TransactionClient } from './types';

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

        const mrn = await prisma.mRN.create({
            data: {
                mrnNumber: `MRN-${Date.now()}`,
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

        try {
            await NotificationService.notifyByRole({
                roles: ['STORES_MANAGER', 'ADMIN'],
                title: 'New MRN Created',
                message: `New Material Return Note ${mrn.mrnNumber} has been created and requires approval.`,
                type: 'INVENTORY',
                priority: 'MEDIUM',
                link: '/admin/inventory/mrns'
            });
        } catch (nErr) {
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
        if (action === 'REJECT') {
            const updated = await prisma.mRN.update({
                where: { id: mrnId },
                data: {
                    status: 'REJECTED',
                    approvedById
                },
                include: { returnedBy: true }
            });

            try {
                await NotificationService.send({
                    userId: updated.returnedById,
                    title: 'MRN Rejected',
                    message: `Your Material Return Note ${updated.mrnNumber} has been rejected.`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/mrns'
                });
            } catch (nErr) {
                console.error("Failed to notify MRN rejection:", nErr);
            }
            return updated;
        }

        if (action === 'APPROVE') {
            return await prisma.$transaction(async (tx: TransactionClient) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mrn = await (tx as any).mRN.findUnique({
                    where: { id: mrnId },
                    include: { items: true }
                });

                if (!mrn) throw new Error("MRN_NOT_FOUND");

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updatedMrn = await (tx as any).mRN.update({
                    where: { id: mrnId },
                    data: {
                        status: 'COMPLETED',
                        approvedById
                    }
                });

                const transactionItems: { itemId: string; quantity: number }[] = [];
                for (const item of mrn.items) {
                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, mrn.storeId, item.itemId, item.quantity);

                    for (const picked of pickedBatches) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId: mrn.storeId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: mrn.storeId, itemId: item.itemId } },
                        update: { quantity: { decrement: item.quantity } },
                        create: { storeId: mrn.storeId, itemId: item.itemId, quantity: -item.quantity }
                    });

                    transactionItems.push({
                        itemId: item.itemId,
                        quantity: -item.quantity
                    });
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryTransaction.create({
                    data: {
                        type: 'RETURN',
                        storeId: mrn.storeId,
                        referenceId: mrn.id,
                        userId: approvedById,
                        notes: `MRN ${mrn.mrnNumber} - ${mrn.returnType}`,
                        items: {
                            create: transactionItems
                        }
                    }
                });

                try {
                    await NotificationService.send({
                        userId: updatedMrn.returnedById,
                        title: 'MRN Completed',
                        message: `Your Material Return Note ${updatedMrn.mrnNumber} has been approved and stock updated.`,
                        type: 'INVENTORY',
                        priority: 'MEDIUM',
                        link: '/admin/inventory/mrns'
                    });
                } catch (nErr) {
                    console.error("Failed to notify MRN completion:", nErr);
                }

                emitSystemEvent('INVENTORY_UPDATE');
                return updatedMrn;
            });
        }

        throw new Error('INVALID_ACTION');
    }
}
