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
    idempotencyKey?: string;
}

type Decimal = Prisma.Decimal;

export class AuditLedgerService {
    /**
     * Compute SHA-256 Checksum for tamper prevention using Hash Chaining
     */
    private static generateChecksum(
        storeId: string,
        itemId: string,
        quantityAfter: string | number,
        createdAt: string,
        previousChecksum: string = 'GENESIS'
    ): string {
        const payload = `${storeId}:${itemId}:${quantityAfter}:${createdAt}:${previousChecksum}`;
        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Generate Atomic MIN (Material Issue Note) Number: MIN-YYYY-MM-XXXX
     */
    static async generateMINNumber(tx?: any): Promise<string> {
        const client = tx || prisma;
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const prefix = `MIN-${year}-${month}-`;

        const lastIssue = await client.contractorMaterialIssue.findFirst({
            where: { issueNumber: { startsWith: prefix } },
            orderBy: { issueNumber: 'desc' },
            select: { issueNumber: true }
        });

        let nextSeq = 1;
        if (lastIssue?.issueNumber) {
            const parts = lastIssue.issueNumber.split('-');
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }

        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    /**
     * Generate Atomic MRN (Material Return Note) Number: MRN-YYYY-MM-XXXX
     */
    static async generateMRNNumber(tx?: any): Promise<string> {
        const client = tx || prisma;
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const prefix = `MRN-${year}-${month}-`;

        const lastReturn = await client.contractorMaterialReturn.findFirst({
            where: { returnNumber: { startsWith: prefix } },
            orderBy: { returnNumber: 'desc' },
            select: { returnNumber: true }
        });

        let nextSeq = 1;
        if (lastReturn?.returnNumber) {
            const parts = lastReturn.returnNumber.split('-');
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }

        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    /**
     * Record an immutable transaction entry in the Inventory Ledger (supports $transaction)
     */
    static async recordEntry(input: CreateLedgerEntryInput, tx?: any) {
        const client = tx || prisma;
        
        // 1. Idempotency Check
        if (input.idempotencyKey) {
            const existing = await client.inventoryLedger.findUnique({
                where: { idempotencyKey: input.idempotencyKey }
            });
            if (existing) return existing;
        }

        // 2. Fetch Previous Checksum for Hash Chaining
        const lastEntry = await client.inventoryLedger.findFirst({
            where: { storeId: input.storeId, itemId: input.itemId },
            orderBy: { createdAt: 'desc' },
            select: { checksum: true }
        });
        const previousChecksum = lastEntry?.checksum || 'GENESIS';

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
            nowIso,
            previousChecksum
        );

        return client.inventoryLedger.create({
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
                idempotencyKey: input.idempotencyKey || null,
                previousChecksum: previousChecksum,
                checksum: checksum,
                createdAt: now
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
