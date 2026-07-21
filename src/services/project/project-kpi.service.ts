import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

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

        const budget = project.budget || 0;
        const actualCost = project.actualCost || 0;
        const progress = (project.progress || 0) / 100;

        const EV = budget * progress;
        const PV = budget * Math.min(progress + 0.1, 1);
        const AC = actualCost;

        const SPI = PV > 0 ? EV / PV : (budget > 0 ? EV / (budget * 0.1) : 1);
        const CPI = AC > 0 ? EV / AC : (EV > 0 ? 999 : 1);

        const budgetUtilization = budget > 0 ? (actualCost / budget) * 100 : 0;

        const now = new Date();
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
                budget,
                actualCost: AC,
                earnedValue: Number(EV.toFixed(2)),
                plannedValue: Number(PV.toFixed(2)),
                spi: Number(SPI.toFixed(2)),
                cpi: Number(CPI.toFixed(2)),
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
                costStatus: budget > 0 ? (CPI >= 1.0 ? 'UNDER_BUDGET' : 'OVER_BUDGET') : 'NOT_SET',
                scheduleStatus: SPI >= 1.0 ? 'AHEAD_OF_SCHEDULE' : 'BEHIND_SCHEDULE'
            }
        };
    }
}