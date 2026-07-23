import { prisma } from '@/lib/prisma';
import { FiscalPeriodStatus } from '@prisma/client';
import { AppError } from '@/lib/error';
import { TransactionClient } from '../inventory/types';

export class FiscalPeriodService {
    /**
     * Assert that the fiscal period for a given date is OPEN for transactions.
     * Throws AppError (400) if the period is CLOSED or LOCKED.
     */
    static async assertPeriodOpen(tx: TransactionClient | typeof prisma, date: Date = new Date()) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1; // 1-12

        let period = await tx.fiscalPeriod.findUnique({
            where: { year_month: { year, month } }
        });

        // Auto-create OPEN period if it doesn't exist yet for current operational dates
        if (!period) {
            period = await tx.fiscalPeriod.create({
                data: {
                    year,
                    month,
                    status: FiscalPeriodStatus.OPEN
                }
            });
        }

        if (period.status !== FiscalPeriodStatus.OPEN) {
            throw AppError.badRequest(
                `Posting rejected: Fiscal Period ${year}-${String(month).padStart(2, '0')} is ${period.status}`
            );
        }

        return period;
    }

    /**
     * List all fiscal periods
     */
    static async getAllPeriods() {
        return await prisma.fiscalPeriod.findMany({
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });
    }

    /**
     * Set Period Status (OPEN, CLOSED, LOCKED)
     */
    static async setPeriodStatus(year: number, month: number, status: FiscalPeriodStatus, closedById?: string) {
        return await prisma.fiscalPeriod.upsert({
            where: { year_month: { year, month } },
            update: {
                status,
                closedById: status !== FiscalPeriodStatus.OPEN ? closedById : null,
                closedAt: status !== FiscalPeriodStatus.OPEN ? new Date() : null
            },
            create: {
                year,
                month,
                status,
                closedById: status !== FiscalPeriodStatus.OPEN ? closedById : null,
                closedAt: status !== FiscalPeriodStatus.OPEN ? new Date() : null
            }
        });
    }
}
