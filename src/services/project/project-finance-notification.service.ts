import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { NotificationService } from '@/services/notification/notification.service';
import { MY_TASKS_LINK } from '@/services/project/project-task-notification.service';

export type InvoiceHandOff = 'DRAFT_CREATED' | 'ISSUED' | 'SUBMITTED' | 'OVERDUE' | 'COMPLETED';
export type FinanceAssignmentRole = 'LEAD_CONTROLLER' | 'PREPARER' | 'REVIEWER' | 'APPROVER';

interface HandOffRule {
    /** Project finance roles that must act on, or be told about, the next step. */
    roles: FinanceAssignmentRole[];
    title: string;
    verb: string;
    priority: 'HIGH' | 'MEDIUM';
    /** Nobody assigned: fall back to the project-manager audience, because the step still needs an owner. */
    fallbackToManagers: boolean;
}

/** Who is handed the work after each invoice transition (Draft -> Issued -> SLT -> Paid). */
const HAND_OFFS: Record<InvoiceHandOff, HandOffRule> = {
    DRAFT_CREATED: { roles: ['APPROVER', 'LEAD_CONTROLLER'], title: '🧾 Invoice awaiting your approval', verb: 'was prepared and needs approval', priority: 'HIGH', fallbackToManagers: true },
    ISSUED: { roles: ['PREPARER', 'LEAD_CONTROLLER'], title: '✅ Invoice approved - submit to SLT', verb: 'was approved and is ready to submit to SLT', priority: 'HIGH', fallbackToManagers: true },
    SUBMITTED: { roles: ['LEAD_CONTROLLER', 'REVIEWER'], title: '📤 Invoice submitted to SLT', verb: 'was submitted to SLT; track the payment', priority: 'MEDIUM', fallbackToManagers: false },
    OVERDUE: { roles: ['LEAD_CONTROLLER', 'PREPARER'], title: '⏰ Invoice overdue - follow up', verb: 'is past its due date and still unpaid', priority: 'HIGH', fallbackToManagers: true },
    COMPLETED: { roles: ['LEAD_CONTROLLER'], title: '🏁 Invoice fully paid', verb: 'is fully paid and completed', priority: 'MEDIUM', fallbackToManagers: false },
};

export interface InvoiceRef {
    id: string;
    invoiceNumber: string;
    projectId: string;
    type?: string | null;
}

export interface FinanceWorkItem {
    invoiceId: string;
    invoiceNumber: string;
    title: string | null;
    projectId: string;
    projectName: string;
    totalAmount: number;
    dueDate: Date | null;
    status: string;
    action: 'APPROVE' | 'SUBMIT_TO_SLT' | 'FOLLOW_UP';
    actionLabel: string;
}

/**
 * Hands project invoice work to the finance roles assigned to that project, so the next person
 * is told automatically and sees the item in their queue instead of being phoned.
 */
export class ProjectFinanceNotificationService {
    static async notifyHandOff(invoice: InvoiceRef, event: InvoiceHandOff, actorId: string | null, dayStamp?: string): Promise<number> {
        const rule = HAND_OFFS[event];
        // Only client invoices go to SLT, so "ready to submit" is meaningless for the others.
        if (event === 'ISSUED' && invoice.type && invoice.type !== 'CLIENT') return 0;

        try {
            const now = new Date();
            const [project, assignments] = await Promise.all([
                prisma.project.findUnique({ where: { id: invoice.projectId }, select: { name: true, projectCode: true, opmcId: true } }),
                prisma.projectFinanceAssignment.findMany({
                    where: {
                        projectId: invoice.projectId,
                        status: 'ACTIVE',
                        assignmentRole: { in: rule.roles },
                        startsAt: { lte: now },
                        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
                    },
                    select: { userId: true },
                }),
            ]);
            const projectLabel = project ? `${project.name} (${project.projectCode})` : 'a project';
            const message = `Invoice ${invoice.invoiceNumber} on ${projectLabel} ${rule.verb}.`;
            const recipients = [...new Set(assignments.map(a => a.userId))].filter(id => id !== actorId);

            for (const userId of recipients) {
                await NotificationService.send({
                    userId,
                    title: rule.title,
                    message,
                    type: 'PROJECT',
                    priority: rule.priority,
                    link: MY_TASKS_LINK,
                    metadata: { invoiceId: invoice.id, projectId: invoice.projectId, handOff: event },
                    dedupKey: `project-invoice:${invoice.id}:${event}:${dayStamp ?? 'once'}:${userId}`,
                });
            }

            if (recipients.length === 0 && rule.fallbackToManagers) {
                await NotificationService.notifyByAudience({
                    audience: 'PROJECT_MANAGERS',
                    title: `${rule.title} (no finance owner assigned)`,
                    message: `${message} No project finance role is assigned, so assign one.`,
                    type: 'PROJECT',
                    priority: rule.priority,
                    link: `/projects/${invoice.projectId}`,
                    opmcId: project?.opmcId ?? undefined,
                    metadata: { invoiceId: invoice.id, projectId: invoice.projectId, handOff: event },
                    dedupKey: `project-invoice:${invoice.id}:${event}:${dayStamp ?? 'once'}:managers`,
                });
            }
            return recipients.length;
        } catch (error) {
            console.error(`Failed to send project invoice hand-off (${event}):`, error);
            return 0;
        }
    }

    /** Invoice work currently waiting on this user, derived from their active project finance roles. */
    static async listWorkForUser(userId: string): Promise<FinanceWorkItem[]> {
        const now = new Date();
        const assignments = await prisma.projectFinanceAssignment.findMany({
            where: { userId, status: 'ACTIVE', startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            select: { projectId: true, assignmentRole: true },
        });
        if (assignments.length === 0) return [];

        const rolesByProject = new Map<string, Set<string>>();
        for (const a of assignments) {
            rolesByProject.set(a.projectId, (rolesByProject.get(a.projectId) ?? new Set()).add(a.assignmentRole));
        }

        const scope = await resolveOpmcScope(userId);
        const invoices = await prisma.projectInvoice.findMany({
            where: {
                projectId: { in: [...rolesByProject.keys()] },
                ...(scope === undefined ? {} : { project: { opmcId: { in: scope } } }),
                OR: [
                    { status: 'DRAFT' },
                    { type: 'CLIENT', status: 'ISSUED', submissionStatus: { not: 'SUBMITTED_TO_SLT' } },
                    { status: 'FOLLOW_UP' },
                    { paymentStatus: 'OVERDUE' },
                ],
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
            take: 300,
            select: {
                id: true, invoiceNumber: true, title: true, projectId: true, status: true, type: true,
                submissionStatus: true, paymentStatus: true, totalAmount: true, dueDate: true, createdById: true,
                project: { select: { name: true } },
            },
        });

        const items: FinanceWorkItem[] = [];
        for (const inv of invoices) {
            const roles = rolesByProject.get(inv.projectId);
            if (!roles) continue;
            const has = (...r: FinanceAssignmentRole[]) => r.some(x => roles.has(x));
            let action: FinanceWorkItem['action'] | null = null;
            let actionLabel = '';
            if (inv.status === 'DRAFT' && has('APPROVER', 'LEAD_CONTROLLER') && inv.createdById !== userId) {
                action = 'APPROVE'; actionLabel = 'Awaiting your approval';
            } else if (inv.status === 'ISSUED' && inv.type === 'CLIENT' && has('PREPARER', 'LEAD_CONTROLLER')) {
                action = 'SUBMIT_TO_SLT'; actionLabel = 'Ready to submit to SLT';
            } else if ((inv.status === 'FOLLOW_UP' || inv.paymentStatus === 'OVERDUE') && has('LEAD_CONTROLLER', 'PREPARER')) {
                action = 'FOLLOW_UP'; actionLabel = 'Overdue - follow up with SLT';
            }
            if (!action) continue;
            items.push({
                invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, title: inv.title, projectId: inv.projectId,
                projectName: inv.project.name, totalAmount: Number(inv.totalAmount), dueDate: inv.dueDate,
                status: inv.status, action, actionLabel,
            });
        }
        return items;
    }

    /** Daily reminder for submitted client invoices that are past due and still unpaid. */
    static async remindOverdueInvoices(): Promise<{ processed: number; notified: number }> {
        const now = new Date();
        const overdue = await prisma.projectInvoice.findMany({
            where: {
                type: 'CLIENT',
                submissionStatus: 'SUBMITTED_TO_SLT',
                status: { notIn: ['COMPLETED', 'CANCELLED', 'DRAFT'] },
                balanceAmount: { gt: 0 },
                dueDate: { lt: now },
            },
            select: { id: true, invoiceNumber: true, projectId: true, type: true },
            take: 200,
        });
        const dayStamp = now.toISOString().slice(0, 10);
        let notified = 0;
        for (const invoice of overdue) {
            notified += await this.notifyHandOff(invoice, 'OVERDUE', null, dayStamp);
        }
        return { processed: overdue.length, notified };
    }
}
