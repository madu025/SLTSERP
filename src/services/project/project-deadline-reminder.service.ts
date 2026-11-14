import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification/notification.service';
import { MY_TASKS_LINK } from '@/services/project/project-task-notification.service';
import { SPI_ALERT_THRESHOLD } from '@/lib/project-evm';

const DAY = 24 * 60 * 60 * 1000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const label = (p: { name: string; projectCode: string }) => `${p.name} (${p.projectCode})`;

/**
 * Time-based reminders for things that otherwise lapse silently: permits that expire during construction,
 * the end of a defect-liability period (final retention release is forgotten), approval steps and task
 * plans that sit unactioned. Notification only: nothing here changes project state.
 */
export class ProjectDeadlineReminderService {
    private static async projectManagers(projectId: string, opmcId: string | null, title: string, message: string, dedupKey: string, link: string) {
        await NotificationService.notifyByAudience({
            audience: 'PROJECT_MANAGERS', title: `${title} (no owner found)`, message, type: 'PROJECT', priority: 'HIGH',
            link, opmcId: opmcId ?? undefined, metadata: { projectId }, dedupKey: `${dedupKey}:managers`,
        });
    }

    /** Permits expiring within 30 days: reminded at the 30-day and 7-day marks, then daily once expired. */
    static async remindPermitExpiry(now = new Date()): Promise<{ processed: number; notified: number }> {
        const permits = await prisma.projectPermit.findMany({
            where: {
                expiryDate: { not: null, lte: new Date(now.getTime() + 30 * DAY), gte: new Date(now.getTime() - 14 * DAY) },
                status: { notIn: ['DRAFT', 'REJECTED', 'CANCELLED', 'CLOSED'] },
                project: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            },
            select: {
                id: true, permitNumber: true, expiryDate: true, appliedById: true,
                project: { select: { id: true, name: true, projectCode: true, opmcId: true } },
            },
            take: 300,
        });
        let notified = 0;
        for (const permit of permits) {
            const days = Math.ceil((permit.expiryDate!.getTime() - now.getTime()) / DAY);
            const stage = days < 0 ? `expired:${day(now)}` : days <= 7 ? '7d' : '30d';
            const title = days < 0 ? '⛔ Permit expired' : '⚠️ Permit expiring';
            const message = days < 0
                ? `Permit ${permit.permitNumber ?? ''} for ${label(permit.project)} expired ${-days} day(s) ago. Renew it before work continues.`
                : `Permit ${permit.permitNumber ?? ''} for ${label(permit.project)} expires in ${days} day(s). Renew it before construction needs it.`;
            const link = `/projects/${permit.project.id}`;
            const supervisors = await prisma.projectSupervisorAssignment.findMany({ where: { projectId: permit.project.id, status: 'ASSIGNED' }, select: { supervisorId: true } });
            const recipients = [...new Set([permit.appliedById, ...supervisors.map((s) => s.supervisorId)].filter((id): id is string => !!id))];
            const dedupBase = `project-permit-expiry:${permit.id}:${stage}`;
            if (recipients.length === 0) await this.projectManagers(permit.project.id, permit.project.opmcId, title, message, dedupBase, link);
            for (const userId of recipients) {
                await NotificationService.send({ userId, title, message, type: 'PROJECT', priority: 'HIGH', link, metadata: { permitId: permit.id, projectId: permit.project.id }, dedupKey: `${dedupBase}:${userId}` });
            }
            notified += Math.max(recipients.length, 1);
        }
        return { processed: permits.length, notified };
    }

    /** Defect liability ends within 14 days (or has passed) while retention is still held: tell finance. */
    static async remindDefectLiabilityEnd(now = new Date()): Promise<{ processed: number; notified: number }> {
        const retentions = await prisma.projectRetention.findMany({
            where: { status: { notIn: ['RELEASED', 'CANCELLED'] }, balanceAmount: { gt: 0 }, defectLiabilityEnd: { not: null, lte: new Date(now.getTime() + 14 * DAY) } },
            select: { id: true, title: true, defectLiabilityEnd: true, project: { select: { id: true, name: true, projectCode: true, opmcId: true } } },
            take: 300,
        });
        let notified = 0;
        for (const retention of retentions) {
            const days = Math.ceil((retention.defectLiabilityEnd!.getTime() - now.getTime()) / DAY);
            // Weekly while approaching and after it has passed, so it is not forgotten but not spammed.
            const week = Math.floor(now.getTime() / (7 * DAY));
            const title = days < 0 ? '⏰ Defect liability ended - release retention' : '📅 Defect liability ending soon';
            const message = days < 0
                ? `The defect liability period for ${label(retention.project)} ended ${-days} day(s) ago and retention "${retention.title}" is still held. Clear defects and release it.`
                : `The defect liability period for ${label(retention.project)} ends in ${days} day(s). Prepare the final retention release.`;
            const finance = await prisma.projectFinanceAssignment.findMany({
                where: { projectId: retention.project.id, status: 'ACTIVE', assignmentRole: { in: ['LEAD_CONTROLLER', 'APPROVER'] } },
                select: { userId: true },
            });
            const dedupBase = `project-dlp-end:${retention.id}:${week}`;
            const link = `/projects/${retention.project.id}`;
            if (finance.length === 0) await this.projectManagers(retention.project.id, retention.project.opmcId, title, message, dedupBase, link);
            for (const { userId } of finance) {
                await NotificationService.send({ userId, title, message, type: 'PROJECT', priority: 'HIGH', link, metadata: { retentionId: retention.id, projectId: retention.project.id }, dedupKey: `${dedupBase}:${userId}` });
            }
            notified += Math.max(finance.length, 1);
        }
        return { processed: retentions.length, notified };
    }

    /**
     * Projects in trouble, once a week each: past the planned end date (review schedule and liquidated damages),
     * spend above budget, schedule performance below the alert threshold, and active projects that cannot be
     * tracked at all because they have no budget or no dates. Notification only: nothing here changes a project.
     */
    static async remindProjectHealth(now = new Date()): Promise<{ processed: number; notified: number }> {
        const week = Math.floor(now.getTime() / (7 * DAY));
        const active = await prisma.project.findMany({
            where: { status: { in: ['IN_PROGRESS', 'ON_HOLD'] } },
            select: {
                id: true, name: true, projectCode: true, opmcId: true, budget: true, actualCost: true, endDate: true, startDate: true,
                evm: { select: { spi: true, source: true } },
            },
            take: 300,
        });
        let processed = 0;
        let notified = 0;
        const send = async (p: (typeof active)[number], kind: string, title: string, message: string) => {
            processed++;
            const result = await NotificationService.notifyByAudience({
                audience: 'PROJECT_MANAGERS', title, message, type: 'PROJECT', priority: 'HIGH',
                link: `/projects/${p.id}`, opmcId: p.opmcId ?? undefined,
                metadata: { projectId: p.id, kind }, dedupKey: `project-health:${kind}:${p.id}:${week}`,
            });
            if (result) notified++;
        };

        for (const p of active) {
            const budget = Number(p.budget ?? 0);
            if (p.endDate && p.endDate < now) {
                const late = Math.ceil((now.getTime() - p.endDate.getTime()) / DAY);
                await send(p, 'overdue', '⏰ Project past its planned end date', `${label(p)} is ${late} day(s) past its planned end date. Re-plan it, and check whether liquidated damages apply under the contract.`);
            }
            if (budget > 0 && Number(p.actualCost ?? 0) > budget) {
                await send(p, 'overrun', '💸 Project over budget', `${label(p)} has spent more than its budget (${Math.round(Number(p.actualCost)).toLocaleString('en-US')} against ${Math.round(budget).toLocaleString('en-US')}). Review the cost to complete.`);
            }
            const spi = p.evm?.spi === null || p.evm?.spi === undefined ? null : Number(p.evm.spi);
            if (spi !== null && spi < SPI_ALERT_THRESHOLD) {
                await send(p, 'spi', '🐢 Project behind schedule', `${label(p)} is running at a schedule performance index of ${spi.toFixed(2)} (below ${SPI_ALERT_THRESHOLD}). Work is progressing slower than planned.`);
            }
            if (budget <= 0 || !p.endDate) {
                const missing = [budget <= 0 ? 'a budget' : null, !p.endDate ? 'a planned end date' : null].filter(Boolean).join(' and ');
                await send(p, 'untracked', 'ℹ️ Project cannot be tracked', `${label(p)} is in progress but has no ${missing}, so schedule and cost performance cannot be measured. Add them on the project.`);
            }
        }
        return { processed, notified };
    }

    /** Approval steps due for more than 2 days, and submitted task plans nobody approved: nudge once a day. */
    static async remindStaleActions(now = new Date()): Promise<{ processed: number; notified: number }> {
        const cutoff = new Date(now.getTime() - 2 * DAY);
        let processed = 0;
        let notified = 0;
        const steps = await prisma.projectApprovalStep.findMany({
            where: { status: 'PENDING', assignedUserId: { not: null }, updatedAt: { lt: cutoff }, request: { status: 'PENDING', project: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } } },
            select: { id: true, assignedUserId: true, stepNumber: true, request: { select: { id: true, title: true, project: { select: { id: true, name: true, projectCode: true } }, steps: { select: { stepNumber: true, status: true } } } } },
            take: 200,
        });
        for (const step of steps) {
            if (step.request.steps.some((s) => s.stepNumber < step.stepNumber && s.status !== 'APPROVED')) continue; // not their turn yet
            processed++;
            await NotificationService.send({
                userId: step.assignedUserId!, title: '⏳ Approval still waiting for you',
                message: `"${step.request.title}" on ${label(step.request.project)} has been waiting more than 2 days for your approval.`,
                type: 'PROJECT', priority: 'HIGH', link: MY_TASKS_LINK, metadata: { requestId: step.request.id },
                dedupKey: `project-approval-stale:${step.id}:${day(now)}`,
            });
            notified++;
        }
        const plans = await prisma.projectTaskPlan.findMany({
            where: { status: 'SUBMITTED', configuredAt: { lt: cutoff }, project: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
            select: { projectId: true, project: { select: { name: true, projectCode: true, opmcId: true } } },
            take: 100,
        });
        for (const plan of plans) {
            processed++;
            await NotificationService.notifyByAudience({
                audience: 'PROJECT_MANAGERS', title: '⏳ Task plan still waiting for approval',
                message: `The task plan for ${label(plan.project)} has been submitted for more than 2 days. Approve it so the tasks reach their assignees.`,
                type: 'PROJECT', priority: 'HIGH', link: MY_TASKS_LINK, opmcId: plan.project.opmcId ?? undefined,
                metadata: { projectId: plan.projectId }, dedupKey: `project-plan-stale:${plan.projectId}:${day(now)}`,
            });
            notified++;
        }
        return { processed, notified };
    }
}
