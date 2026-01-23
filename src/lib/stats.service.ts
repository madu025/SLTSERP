import { prisma } from './prisma';

export type DashboardField = 'pending' | 'completed' | 'returned' | 'patPassed' | 'patRejected' | 'sltsPatRejected';

export class StatsService {
    /**
     * Increment or decrement a specific stat for an OPMC.
     */
    static async updateStat(opmcId: string, field: DashboardField, increment: number) {
        try {
            const opmc = await prisma.oPMC.findUnique({ where: { id: opmcId }, select: { rtom: true } });
            if (!opmc) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).dashboardStat.upsert({
                where: { opmcId },
                create: {
                    opmcId,
                    rtom: opmc.rtom,
                    [field]: Math.max(0, increment)
                },
                update: {
                    [field]: { increment }
                }
            });
        } catch (error) {
            console.error('Error updating dashboard stats:', error);
        }
    }

    /**
     * Handle status transition for an SOD.
     */
    static async handleStatusChange(opmcId: string, oldStatus: string | null, newStatus: string) {
        if (oldStatus === newStatus) return;

        const fieldMap: Record<string, DashboardField> = {
            'INPROGRESS': 'pending',
            'COMPLETED': 'completed',
            'RETURN': 'returned'
        };

        const oldField = oldStatus ? fieldMap[oldStatus] : null;
        const newField = fieldMap[newStatus];

        if (oldField) await this.updateStat(opmcId, oldField, -1);
        if (newField) await this.updateStat(opmcId, newField, 1);
    }

    /**
     * Handle PAT status transition.
     */
    static async handlePatStatusChange(opmcId: string, field: 'patPassed' | 'patRejected' | 'sltsPatRejected', isAdded: boolean) {
        await this.updateStat(opmcId, field, isAdded ? 1 : -1);
    }

    /**
     * Sync stats for a specific OPMC by performing counts for the current year (2026).
     */
    static async syncOpmcStats(opmcId: string) {
        const opmc = await prisma.oPMC.findUnique({ where: { id: opmcId }, select: { rtom: true } });
        if (!opmc) return;

        const currentYearStart = new Date('2026-01-01T00:00:00Z');
        const nextYearStart = new Date('2027-01-01T00:00:00Z');


        const [
            pending,
            completed,
            returned,
            patPassed,
            patRejected,
            sltsPatRejected
        ] = await Promise.all([
            prisma.serviceOrder.count({ where: { opmcId, sltsStatus: 'INPROGRESS', receivedDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId, status: 'INSTALL_CLOSED', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId, sltsStatus: 'RETURN', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId, patStatus: 'PASS', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId, patStatus: 'REJECTED', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId, sltsPatStatus: 'REJECTED', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).dashboardStat.upsert({
            where: { opmcId },
            create: {
                opmcId,
                rtom: opmc.rtom,
                pending, completed, returned, patPassed, patRejected, sltsPatRejected
            },
            update: {
                pending, completed, returned, patPassed, patRejected, sltsPatRejected
            }
        });
    }

    /**
     * Full system-wide recalculation of dashboard stats.
     */
    static async globalRecalculate() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true } });
        for (const opmc of opmcs) {
            await this.syncOpmcStats(opmc.id);
        }
    }

    /**
     * Drift Correction: Periodically verifies and fixes inconsistencies between 
     * cached DashboardStat and actual ServiceOrder counts.
     */
    static async driftCorrection() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
        let correctedCount = 0;

        for (const opmc of opmcs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const before = await (prisma as any).dashboardStat.findUnique({ where: { opmcId: opmc.id } });
            await this.syncOpmcStats(opmc.id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const after = await (prisma as any).dashboardStat.findUnique({ where: { opmcId: opmc.id } });

            // Check if any field changed (ignoring updatedTime etc)
            const b = { ...before }; delete b.lastUpdated; delete b.id;
            const a = { ...after }; delete a.lastUpdated; delete a.id;

            if (JSON.stringify(b) !== JSON.stringify(a)) {
                correctedCount++;
                const { logger } = await import('./logger');
                logger.warn(`Stats Drift Corrected for RTOM: ${opmc.rtom}`, {
                    opmcId: opmc.id,
                    before: b,
                    after: a
                });
            }
        }

        return correctedCount;
    }
}
