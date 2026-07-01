import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';

export interface CreateMemoItemInput {
    itemName: string;
    quantity: number;
    unitCost: number;
}

export interface CreateMemoPayload {
    title: string;
    description?: string;
    allocationTarget?: string;
    approvedAt?: string | Date | null;
    receivedAt?: string | Date | null;
    documentUrl?: string;
    items: CreateMemoItemInput[];
}

export class CostAllocationService {
    static async createAllocationMemo(payload: CreateMemoPayload) {
        const { title, description, allocationTarget = "General", approvedAt, receivedAt, documentUrl, items } = payload;
        
        if (!items || items.length === 0) {
            throw new Error("INVALID_PAYLOAD: Memo must contain at least one item.");
        }

        // Calculate item costs and total cost
        const itemCreates = items.map(item => {
            const qty = Number(item.quantity) || 1;
            const cost = Number(item.unitCost) || 0;
            const total = qty * cost;
            return {
                itemName: item.itemName,
                quantity: qty,
                unitCost: cost,
                totalCost: total
            };
        });

        const totalCost = itemCreates.reduce((sum, item) => sum + item.totalCost, 0);

        // Start database transaction
        return await prisma.$transaction(async (tx) => {
            // Generate memo number
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const count = await tx.costAllocationMemo.count({
                where: { memoNumber: { startsWith: `MEMO-${dateStr}` } }
            });
            const seq = String(count + 1).padStart(3, '0');
            const memoNumber = `MEMO-${dateStr}-${seq}`;

            // Convert date formats if present
            const approvedDate = approvedAt ? new Date(approvedAt) : null;
            const receivedDate = receivedAt ? new Date(receivedAt) : null;

            // 1. Create the Memo record with nested items
            const memo = await tx.costAllocationMemo.create({
                data: {
                    memoNumber,
                    title,
                    description,
                    allocationTarget,
                    approvedAt: approvedDate,
                    receivedAt: receivedDate,
                    documentUrl,
                    totalCost,
                    items: {
                        create: itemCreates
                    }
                },
                include: {
                    items: true
                }
            });

            // 2. Post corresponding double-entry to General Ledger
            const journal = await LedgerService.logCostAllocationMemo(
                tx,
                memo.id,
                totalCost,
                allocationTarget,
                description
            );

            // 3. Link journalEntryId back to the memo
            if (journal) {
                return await tx.costAllocationMemo.update({
                    where: { id: memo.id },
                    data: { journalEntryId: journal.id },
                    include: {
                        items: true
                    }
                });
            }

            return memo;
        }, { timeout: 20000 });
    }

    static async getAllocationMemos() {
        return await prisma.costAllocationMemo.findMany({
            include: {
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
