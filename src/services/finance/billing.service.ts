import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { LedgerService } from './ledger.service';
import crypto from 'crypto';

export class BillingService {
    /**
     * Generates a Draft Invoice for a specific contractor for unbilled COMPLETED Service Orders.
     * Implements FSM Settlement (Retention, Advances, WHT).
     */
    static async generateContractorInvoice(data: {
        contractorId: string;
        projectId?: string;
        description?: string;
        retentionPercent?: number; // e.g. 5 for 5%
        whtPercent?: number;       // e.g. 5 for 5%
        advanceDeduction?: number;
    }) {
        const { contractorId, projectId, description, retentionPercent = 0, whtPercent = 0, advanceDeduction = 0 } = data;

        // Idempotency / Concurrency Guard
        const idempotencyKey = `INV_GEN_${contractorId}_${new Date().toISOString().slice(0, 7)}`;

        return await prisma.$transaction(async (tx: TransactionClient) => {
            // Check for duplicate running transactions for the same month
            const existingInv = await tx.invoice.findUnique({ where: { idempotencyKey } });
            if (existingInv) throw AppError.badRequest('Invoice generation already in progress or completed for this month.');

            // 1. Fetch unbilled, completed SODs
            const unbilledSods = await tx.serviceOrder.findMany({
                where: {
                    contractorId,
                    sltsStatus: 'COMPLETED',
                    invoiceId: null,
                    invoiced: false,
                    ...(projectId ? { projectId } : {})
                }
            });

            if (unbilledSods.length === 0) {
                throw AppError.badRequest('No unbilled completed SODs found for this contractor.');
            }

            // 2. Aggregate Payouts
            let totalContractorAmount = new Prisma.Decimal(0);
            for (const sod of unbilledSods) {
                totalContractorAmount = totalContractorAmount.add(new Prisma.Decimal(sod.contractorAmount || 0));
            }

            // 3. Calculate Splits
            const amountNum = totalContractorAmount.toNumber();
            const retentionAmount = (amountNum * retentionPercent) / 100;
            const whtAmount = (amountNum * whtPercent) / 100;
            
            const netAmountToPay = amountNum - retentionAmount - whtAmount - advanceDeduction;

            // 4. Generate Invoice Number
            const count = await tx.invoice.count();
            const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

            // 5. Create DRAFT Invoice
            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    contractorId,
                    projectId,
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    amount: amountNum,
                    totalAmount: netAmountToPay,
                    status: 'PENDING',
                    approvalStatus: 'DRAFT',
                    description,
                    retentionAmount,
                    whtAmount,
                    whtPercent,
                    advanceDeduction,
                    idempotencyKey,
                    sods: {
                        connect: unbilledSods.map(s => ({ id: s.id }))
                    }
                }
            });

            // 6. Update SOD status
            await tx.serviceOrder.updateMany({
                where: { id: { in: unbilledSods.map(s => s.id) } },
                data: {
                    invoiced: true,
                    // invoiceId will be linked by the `sods: { connect: ... }` above
                }
            });

            return invoice;
        });
    }

    static async getUnbilledSods(contractorId: string) {
        if (!contractorId) {
            throw AppError.badRequest('contractorId is required');
        }

        const sods = await prisma.serviceOrder.findMany({
            where: {
                contractorId,
                sltsStatus: 'COMPLETED',
                invoiceId: null,
                invoiced: false,
            },
            select: {
                id: true,
                soNum: true,
                serviceType: true,
                completedDate: true,
                revenueAmount: true,
                contractorAmount: true
            },
            orderBy: { completedDate: 'desc' }
        });

        const totalAmount = sods.reduce((sum, sod) => sum + (sod.contractorAmount ? new Prisma.Decimal(sod.contractorAmount).toNumber() : 0), 0);

        return {
            sods,
            totalAmount
        };
    }
}
