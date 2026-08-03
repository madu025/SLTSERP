import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { TransactionClient } from './types';

export interface CreateLedgerEntryInput {
    storeId: string;
    itemId: string;
    batchId?: string | null;
    transactionType: 'GRN_RECEIPT' | 'CONTRACTOR_ISSUE' | 'CONTRACTOR_RETURN' | 'MRN_APPROVAL' | 'SOD_INSTALLATION' | 'WASTAGE_ADJUSTMENT' | 'CYCLE_COUNT_CORRECTION' | 'PROJECT_ISSUE' | 'PROJECT_RETURN' | 'VIRTUAL_SWAP' | 'STOCK_ISSUE' | 'STORE_TRANSFER_OUT' | 'STORE_TRANSFER_IN';
    referenceType: 'GRN' | 'ContractorMaterialIssue' | 'SOD' | 'MRN' | 'CycleCount' | 'Adjustment' | 'StockIssue' | 'ProjectIR' | 'VirtualSwap' | 'ContractorWastage' | 'StockRequest';
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
    /** Only real user UUIDs may be stored; 'SYSTEM'/'STOREKEEPER' actors map to null */
    private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
     * Atomically reserve the next document number for a given type using the
     * DocumentCounter table: `${type}-YYYY-MM-XXXX`. Safe under concurrency
     * (single-row atomic increment); pass the surrounding transaction when available.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async getNextDocumentNumber(type: string, tx?: TransactionClient): Promise<string> {
        const client = tx || prisma;
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const period = `${year}-${month}`;

        const counter = await client.documentCounter.upsert({
            where: { type_period: { type, period } },
            update: { sequence: { increment: 1 } },
            create: { type, period, sequence: 1 }
        });

        return `${type}-${year}-${month}-${String(counter.sequence).padStart(4, '0')}`;
    }

    /**
     * Generate Atomic MIN (Material Issue Note) Number: MIN-YYYY-MM-XXXX
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async generateMINNumber(tx?: TransactionClient): Promise<string> {
        return this.getNextDocumentNumber('MIN', tx);
    }

    /**
     * Generate Atomic MRN (Material Return Note) Number: MRN-YYYY-MM-XXXX
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async generateMRNNumber(tx?: TransactionClient): Promise<string> {
        return this.getNextDocumentNumber('MRN', tx);
    }

    /**
     * Record an immutable transaction entry in the Inventory Ledger (supports $transaction)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async recordEntry(input: CreateLedgerEntryInput, tx?: TransactionClient) {
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
                performedById: this.UUID_RE.test(input.performedById) ? input.performedById : null,
                idempotencyKey: input.idempotencyKey || null,
                previousChecksum: previousChecksum,
                checksum: checksum,
                createdAt: now
            }
        });
    }

    /**
     * Audit & Verify ledger entry checksum integrity (hash-chain aware)
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

        // Track the last checksum per store+item chain to verify linkage
        const chainTails = new Map<string, string>();

        let tamperedCount = 0;
        let legacyCount = 0;
        const auditResults = ledgers.map((entry) => {
            // Entries written before hash chaining have no previousChecksum — report
            // them as legacy instead of tampered.
            if (entry.previousChecksum === null) {
                legacyCount++;
                return {
                    id: entry.id,
                    referenceId: entry.referenceId,
                    transactionType: entry.transactionType,
                    isValid: true,
                    legacy: true,
                };
            }

            const expectedChecksum = this.generateChecksum(
                entry.storeId,
                entry.itemId,
                entry.quantityAfter.toString(),
                entry.createdAt.toISOString(),
                entry.previousChecksum
            );

            // Verify chain linkage against the previous entry of the same store+item
            const chainKey = `${entry.storeId}:${entry.itemId}`;
            const expectedPrevious = chainTails.get(chainKey);
            const chainLinked = expectedPrevious === undefined || entry.previousChecksum === expectedPrevious;
            chainTails.set(chainKey, entry.checksum);

            const isValid = entry.checksum === expectedChecksum && chainLinked;
            if (!isValid) tamperedCount++;

            return {
                id: entry.id,
                referenceId: entry.referenceId,
                transactionType: entry.transactionType,
                isValid,
                legacy: false,
            };
        });

        return {
            totalChecked: ledgers.length,
            tamperedCount,
            legacyCount,
            isIntegral: tamperedCount === 0,
            auditResults,
        };
    }
}
