import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

export interface CreateLedgerEntryInput {
    storeId: string;
    itemId: string;
    batchId?: string | null;
    transactionType: 'GRN_RECEIPT' | 'CONTRACTOR_ISSUE' | 'CONTRACTOR_RETURN' | 'SOD_INSTALLATION' | 'WASTAGE_ADJUSTMENT' | 'CYCLE_COUNT_CORRECTION';
    referenceType: 'GRN' | 'ContractorMaterialIssue' | 'SOD' | 'MRN' | 'CycleCount' | 'Adjustment';
    referenceId: string;
    quantityBefore: number | Decimal;
    quantityChange: number | Decimal;
    quantityAfter: number | Decimal;
    unitPrice?: number | Decimal;
    performedById: string;
}

type Decimal = Prisma.Decimal;

export class AuditLedgerService {
    /**
     * Compute SHA-256 Checksum for tamper prevention
     */
    private static generateChecksum(
        storeId: string,
        itemId: string,
        quantityAfter: string | number,
        createdAt: string
    ): string {
        const payload = `${storeId}:${itemId}:${quantityAfter}:${createdAt}`;
        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Record an immutable transaction entry in the Inventory Ledger
     */
    static async recordEntry(input: CreateLedgerEntryInput) {
        const qtyBefore = new Prisma.Decimal(String(input.quantityBefore));
        const qtyChange = new Prisma.Decimal(String(input.quantityChange));
        const qtyAfter = new Prisma.Decimal(String(input.quantityAfter));
        const price = new Prisma.Decimal(String(input.unitPrice || 0));
        const totalVal = qtyChange.abs().mul(price);
        const now = new Date();
        const nowIso = now.toISOString();

        const checksum = this.generateChecksum(
            input.storeId,
            input.itemId,
            qtyAfter.toString(),
            nowIso
        );

        return prisma.inventoryLedger.create({
            data: {
                storeId: input.storeId,
                itemId: input.itemId,
                batchId: input.batchId || null,
                transactionType: input.transactionType,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
                quantityBefore: qtyBefore,
                quantityChange: qtyChange,
                quantityAfter: qtyAfter,
                unitPrice: price,
                totalValue: totalVal,
                performedById: input.performedById,
                checksum,
                createdAt: now,
            }
        });
    }

    /**
     * Audit & Verify ledger entry checksum integrity
     */
    static async verifyLedgerIntegrity(storeId?: string, itemId?: string) {
        const ledgers = await prisma.inventoryLedger.findMany({
            where: {
                ...(storeId ? { storeId } : {}),
                ...(itemId ? { itemId } : {}),
            },
            orderBy: { createdAt: 'asc' },
            take: 1000,
        });

        let tamperedCount = 0;
        const auditResults = ledgers.map((entry) => {
            const expectedChecksum = this.generateChecksum(
                entry.storeId,
                entry.itemId,
                entry.quantityAfter.toString(),
                entry.createdAt.toISOString()
            );

            const isValid = entry.checksum === expectedChecksum;
            if (!isValid) tamperedCount++;

            return {
                id: entry.id,
                referenceId: entry.referenceId,
                transactionType: entry.transactionType,
                isValid,
            };
        });

        return {
            totalChecked: ledgers.length,
            tamperedCount,
            isIntegral: tamperedCount === 0,
            auditResults,
        };
    }
}
