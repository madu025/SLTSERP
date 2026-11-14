import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { computeEvm, plannedPercent } from '@/lib/project-evm';

export class ProjectKPIService {
    static async getKPIAnalytics(projectId: string) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                name: true,
                projectCode: true,
                budget: true,
                actualCost: true,
                progress: true,
                startDate: true,
                endDate: true,
                estimatedDuration: true,
                actualDuration: true
            }
        });

        if (!project) {
            throw AppError.notFound('Project not found');
        }

        const budget = Number(project.budget || 0);
        const actualCost = Number(project.actualCost || 0);

        // Planned value comes from the task schedule (s-curve), not from the progress itself: the old
        // `PV = budget x (progress + 10%)` made SPI a function of progress alone.
        const tasks = await prisma.projectTask.findMany({
            where: { projectId },
            select: { plannedStartDate: true, plannedEndDate: true, estimatedCost: true, plannedDuration: true },
        });
        const now = new Date();
        const plannedPct = plannedPercent(
            tasks.map((t) => ({ plannedStart: t.plannedStartDate, plannedEnd: t.plannedEndDate, estimatedCost: t.estimatedCost === null ? null : Number(t.estimatedCost), plannedDurationDays: t.plannedDuration })),
            { startDate: project.startDate, endDate: project.endDate },
            now,
        );
        // A missing actual-cost ledger is not evidence of infinite cost efficiency: AC stays null (CPI pending) until cost exists.
        const evm = computeEvm({ bac: budget, progressPct: Number(project.progress || 0), plannedPct, actualCost: actualCost > 0 ? actualCost : null });
        const EV = evm.ev;
        const PV = evm.pv ?? 0;
        const AC = actualCost;
        const SPI = evm.spi;
        const CPI = evm.cpi ?? 0;
        const budgetNum = budget;

        const budgetUtilization = budgetNum > 0 ? (actualCost / budgetNum) * 100 : 0;

        const startDate = project.startDate;
        const endDate = project.endDate;
        const estimatedDuration = project.estimatedDuration;
        const actualDuration = project.actualDuration;
        
        let timelineDaysElapsed = 0;
        let timelineDaysRemaining = estimatedDuration || 0;
        let timelinePercentElapsed = 0;

        if (startDate) {
            if (endDate) {
                const totalMs = endDate.getTime() - startDate.getTime();
                const elapsedMs = now.getTime() - startDate.getTime();
                timelineDaysElapsed = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
                const totalDays = Math.floor(totalMs / (1000 * 60 * 60 * 24));
                timelineDaysRemaining = Math.max(0, totalDays - timelineDaysElapsed);
                timelinePercentElapsed = totalDays > 0 ? (timelineDaysElapsed / totalDays) * 100 : 0;
            } else if (estimatedDuration) {
                timelineDaysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                timelineDaysRemaining = Math.max(0, estimatedDuration - timelineDaysElapsed);
                timelinePercentElapsed = estimatedDuration > 0 ? (timelineDaysElapsed / estimatedDuration) * 100 : 0;
            }
        }

        return {
            project: {
                id: project.id,
                name: project.name,
                projectCode: project.projectCode
            },
            metrics: {
                budget: budgetNum,
                actualCost: AC,
                earnedValue: Number(EV.toFixed(2)),
                plannedValue: Number(PV.toFixed(2)),
                plannedPercent: plannedPct,
                spi: SPI === null ? null : Number(SPI.toFixed(2)),
                cpi: Number(CPI.toFixed(2)),
                estimateAtCompletion: evm.eac,
                estimateToComplete: evm.etc,
                varianceAtCompletion: evm.vac,
                evmStatus: evm.status,
                gaps: evm.gaps,
                variance: Number((EV - AC).toFixed(2)),
                budgetUtilization: Number(budgetUtilization.toFixed(1)),
                progressPercent: project.progress || 0
            },
            timeline: {
                daysElapsed: timelineDaysElapsed,
                daysRemaining: timelineDaysRemaining,
                percentElapsed: Number(timelinePercentElapsed.toFixed(1)),
                scheduledDurationDays: estimatedDuration,
                actualDurationDays: actualDuration,
                startDate: startDate?.toISOString() || null,
                endDate: endDate?.toISOString() || null
            },
            status: {
                costStatus: budgetNum > 0
                    ? (AC > 0 ? (CPI >= 1.0 ? 'UNDER_BUDGET' : 'OVER_BUDGET') : 'ACTUAL_COST_PENDING')
                    : 'NOT_SET',
                scheduleStatus: SPI === null ? 'NOT_PLANNED' : SPI >= 1.0 ? 'AHEAD_OF_SCHEDULE' : SPI >= 0.95 ? 'ON_TRACK' : 'BEHIND_SCHEDULE'
            }
        };
    }
}
