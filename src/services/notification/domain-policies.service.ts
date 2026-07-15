/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Domain Integration Notification Policies
 * Covers Helpdesk, Service Orders, Projects, and Finance notification triggers.
 * All methods follow the pattern: detect business event → create notification → emit event.
 */

import { NotificationService, NotificationPriority } from './index';
import { NotificationRetryService } from './retry.service';
import { prisma } from '@/lib/prisma';
import { emitSystemEvent } from '@/lib/events';

export class DomainNotificationPolicies {

    // ============================================================
    // HELPDESK POLICIES
    // ============================================================

    static async notifyTicketCreated(ticket: {
        id: string;
        ticketNumber: string;
        title: string;
        priority: string;
        category: string;
        createdById: string;
        assignedToId?: string | null;
    }) {
        // Notify the assignee (if assigned at creation)
        if (ticket.assignedToId) {
            await NotificationRetryService.enqueue({
                userId: ticket.assignedToId,
                title: 'New Ticket Assigned',
                message: `Ticket #${ticket.ticketNumber}: "${ticket.title}" has been assigned to you. Priority: ${ticket.priority}`,
                type: 'HELPDESK',
                priority: ticket.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                link: `/helpdesk/tickets/${ticket.id}`,
                metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
                channels: ['IN_APP', 'PUSH'],
            });
        }

        // Notify helpdesk managers about new unassigned tickets
        if (!ticket.assignedToId) {
            await NotificationService.notifyByRole({
                roles: ['HELPDESK_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
                title: 'New Unassigned Ticket',
                message: `Ticket #${ticket.ticketNumber}: "${ticket.title}" is awaiting assignment.`,
                type: 'HELPDESK',
                priority: 'HIGH',
                link: `/helpdesk/tickets/${ticket.id}`,
                metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
            });
        }

        emitSystemEvent('HELPDESK_CREATED', { ticketId: ticket.id });
    }

    static async notifyTicketAssigned(ticket: {
        id: string;
        ticketNumber: string;
        title: string;
        assignedToId: string;
        assignedByName?: string;
    }) {
        await NotificationRetryService.enqueue({
            userId: ticket.assignedToId,
            title: 'Ticket Assigned to You',
            message: `Ticket #${ticket.ticketNumber}: "${ticket.title}" has been assigned to you${ticket.assignedByName ? ` by ${ticket.assignedByName}` : ''}.`,
            type: 'HELPDESK',
            priority: 'HIGH',
            link: `/helpdesk/tickets/${ticket.id}`,
            metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
            channels: ['IN_APP', 'PUSH', 'EMAIL'],
        });
    }

    static async notifyTicketStatusChanged(ticket: {
        id: string;
        ticketNumber: string;
        title: string;
        status: string;
        previousStatus: string;
        changedById: string;
        createdById: string;
        assignedToId?: string | null;
    }) {
        const statusLabel = ticket.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Notify ticket creator about status changes
        if (ticket.createdById !== ticket.changedById) {
            await NotificationService.send({
                userId: ticket.createdById,
                title: 'Ticket Status Updated',
                message: `Your ticket #${ticket.ticketNumber}: "${ticket.title}" is now ${statusLabel}.`,
                type: 'HELPDESK',
                priority: 'MEDIUM',
                link: `/helpdesk/tickets/${ticket.id}`,
                metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, status: ticket.status },
            });
        }

        // Notify assignee about status changes (if different from changer)
        if (ticket.assignedToId && ticket.assignedToId !== ticket.changedById) {
            await NotificationService.send({
                userId: ticket.assignedToId,
                title: 'Assigned Ticket Updated',
                message: `Ticket #${ticket.ticketNumber}: "${ticket.title}" is now ${statusLabel}.`,
                type: 'HELPDESK',
                priority: 'MEDIUM',
                link: `/helpdesk/tickets/${ticket.id}`,
                metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, status: ticket.status },
            });
        }

        emitSystemEvent('HELPDESK_STATUS_CHANGED', { ticketId: ticket.id, status: ticket.status });
    }

    static async notifyTicketResolved(ticket: {
        id: string;
        ticketNumber: string;
        title: string;
        createdById: string;
        resolvedById: string;
    }) {
        await NotificationRetryService.enqueue({
            userId: ticket.createdById,
            title: 'Ticket Resolved',
            message: `Your ticket #${ticket.ticketNumber}: "${ticket.title}" has been resolved. Please confirm the resolution.`,
            type: 'HELPDESK',
            priority: 'HIGH',
            link: `/helpdesk/tickets/${ticket.id}`,
            metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
            channels: ['IN_APP', 'PUSH'],
        });

        emitSystemEvent('HELPDESK_RESOLVED', { ticketId: ticket.id });
    }

    static async notifyTicketCommented(ticket: {
        id: string;
        ticketNumber: string;
        title: string;
        commenterName: string;
        createdById: string;
        assignedToId?: string | null;
        commenterId: string;
    }) {
        const recipients = new Set<string>();
        if (ticket.createdById !== ticket.commenterId) recipients.add(ticket.createdById);
        if (ticket.assignedToId && ticket.assignedToId !== ticket.commenterId) recipients.add(ticket.assignedToId);

        for (const userId of recipients) {
            await NotificationService.send({
                userId,
                title: 'New Comment on Ticket',
                message: `${ticket.commenterName} commented on ticket #${ticket.ticketNumber}: "${ticket.title}"`,
                type: 'HELPDESK',
                priority: 'MEDIUM',
                link: `/helpdesk/tickets/${ticket.id}`,
                metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
            });
        }
    }

    // ============================================================
    // SERVICE ORDER POLICIES
    // ============================================================

    static async notifySODStatusChanged(order: {
        soNum: string;
        status: string;
        previousStatus: string;
        customerName?: string;
        changedByUserId: string;
        opmcId?: string;
    }) {
        const statusLabel = order.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER'],
            title: 'Service Order Status Updated',
            message: `SO #${order.soNum} for ${order.customerName || 'customer'} changed from ${order.previousStatus} to ${statusLabel}.`,
            type: 'PROJECT',
            priority: order.status === 'RETURNED' ? 'CRITICAL' : 'MEDIUM',
            link: '/service-orders',
            opmcId: order.opmcId,
            metadata: { soNum: order.soNum, status: order.status, previousStatus: order.previousStatus },
        });

        emitSystemEvent('SOD_STATUS_CHANGED', { soNum: order.soNum, status: order.status });
    }

    static async notifySODCompleted(order: {
        soNum: string;
        customerName?: string;
        completedByUserId: string;
        opmcId?: string;
        materialsCount?: number;
        cpeCount?: number;
    }) {
        const details = [];
        if (order.materialsCount) details.push(`${order.materialsCount} materials consumed`);
        if (order.cpeCount) details.push(`${order.cpeCount} CPE devices collected`);
        const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';

        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER'],
            title: 'Service Order Completed',
            message: `SO #${order.soNum} for ${order.customerName || 'customer'} has been completed${detailStr}.`,
            type: 'PROJECT',
            priority: 'HIGH',
            link: '/service-orders/completed',
            opmcId: order.opmcId,
            metadata: { soNum: order.soNum, status: 'COMPLETED' },
        });

        emitSystemEvent('SOD_COMPLETED', { soNum: order.soNum });
    }

    static async notifySODAssignment(order: {
        soNum: string;
        customerName?: string;
        assignedToUserId?: string;
        teamName?: string;
        contractorName?: string;
        opmcId?: string;
    }) {
        const assignee = order.teamName || order.contractorName || 'a team';

        await NotificationService.notifyByRole({
            roles: ['AREA_MANAGER', 'ENGINEER'],
            title: 'Service Order Assigned',
            message: `SO #${order.soNum} for ${order.customerName || 'customer'} assigned to ${assignee}.`,
            type: 'PROJECT',
            priority: 'MEDIUM',
            link: '/service-orders',
            opmcId: order.opmcId,
            metadata: { soNum: order.soNum },
        });

        if (order.assignedToUserId) {
            await NotificationRetryService.enqueue({
                userId: order.assignedToUserId,
                title: 'New Service Order Assigned',
                message: `SO #${order.soNum} for ${order.customerName || 'customer'} has been assigned to you.`,
                type: 'PROJECT',
                priority: 'HIGH',
                link: '/service-orders',
                metadata: { soNum: order.soNum },
                channels: ['IN_APP', 'PUSH'],
            });
        }
    }

    // ============================================================
    // PROJECT POLICIES
    // ============================================================

    static async notifyMilestoneDue(project: {
        id: string;
        name: string;
        code: string;
        milestoneName: string;
        dueDate: Date;
        daysRemaining: number;
    }) {
        const urgency = project.daysRemaining <= 1 ? 'CRITICAL' : project.daysRemaining <= 3 ? 'HIGH' : 'MEDIUM';

        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'ENGINEER'],
            title: 'Milestone Due Soon',
            message: `Project "${project.name}" (${project.code}): Milestone "${project.milestoneName}" is due in ${project.daysRemaining} day(s) (${project.dueDate.toLocaleDateString()}).`,
            type: 'PROJECT',
            priority: urgency as NotificationPriority,
            link: `/projects/${project.id}/milestones`,
            metadata: { projectId: project.id, projectCode: project.code, milestoneName: project.milestoneName },
        });
    }

    static async notifyProjectTaskAssigned(task: {
        id: string;
        title: string;
        projectName: string;
        projectCode: string;
        assignedToId: string;
        dueDate?: Date;
        priority: string;
    }) {
        const dueStr = task.dueDate ? ` | Due: ${task.dueDate.toLocaleDateString()}` : '';

        await NotificationRetryService.enqueue({
            userId: task.assignedToId,
            title: 'New Task Assigned',
            message: `Task "${task.title}" in project "${task.projectName}" (${task.projectCode}) assigned to you. Priority: ${task.priority}${dueStr}`,
            type: 'PROJECT',
            priority: task.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
            link: `/projects/${task.id}`,
            metadata: { taskId: task.id, projectCode: task.projectCode },
            channels: ['IN_APP', 'PUSH', 'EMAIL'],
        });
    }

    static async notifyProjectBudgetAlert(project: {
        id: string;
        name: string;
        code: string;
        budgetUtilization: number; // percentage
        totalBudget: number;
        spent: number;
    }) {
        const urgency: NotificationPriority = project.budgetUtilization >= 95 ? 'CRITICAL' : project.budgetUtilization >= 80 ? 'HIGH' : 'MEDIUM';

        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'FINANCE_MANAGER'],
            title: 'Project Budget Alert',
            message: `Project "${project.name}" (${project.code}) has utilized ${project.budgetUtilization}% of budget (${project.spent.toLocaleString()} / ${project.totalBudget.toLocaleString()}).`,
            type: 'FINANCE',
            priority: urgency,
            link: `/projects/${project.id}/finance`,
            metadata: { projectId: project.id, projectCode: project.code, budgetUtilization: project.budgetUtilization },
        });
    }

    static async notifyVariationOrderCreated(vo: {
        id: string;
        voNumber: string;
        projectName: string;
        projectCode: string;
        amount: number;
        reason: string;
        status: string;
    }) {
        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'FINANCE_MANAGER'],
            title: 'New Variation Order',
            message: `VO #${vo.voNumber} created for "${vo.projectName}" (${vo.projectCode}): Amount ${vo.amount.toLocaleString()} LKR. Reason: ${vo.reason}`,
            type: 'FINANCE',
            priority: 'HIGH',
            link: `/projects/${vo.id}/variations`,
            metadata: { voId: vo.id, voNumber: vo.voNumber, projectCode: vo.projectCode },
        });
    }

    static async notifyProjectResourceShortage(project: {
        id: string;
        name: string;
        code: string;
        resourceType: string;
        required: number;
        available: number;
    }) {
        await NotificationService.notifyByRole({
            roles: ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
            title: 'Resource Shortage',
            message: `Project "${project.name}" (${project.code}): ${project.resourceType} shortage (Required: ${project.required}, Available: ${project.available}).`,
            type: 'PROJECT',
            priority: 'CRITICAL',
            link: `/projects/${project.id}/resources`,
            metadata: { projectId: project.id, projectCode: project.code, resourceType: project.resourceType },
        });
    }

    // ============================================================
    // FINANCE POLICIES
    // ============================================================

    static async notifyPaymentReceived(payment: {
        id: string;
        invoiceNumber: string;
        amount: number;
        payer: string;
        projectId?: string;
        projectName?: string;
    }) {
        const projectRef = payment.projectName ? ` for ${payment.projectName}` : '';

        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'],
            title: 'Payment Received',
            message: `Payment of ${payment.amount.toLocaleString()} LKR received from ${payment.payer}${projectRef} (Invoice: ${payment.invoiceNumber}).`,
            type: 'FINANCE',
            priority: 'MEDIUM',
            link: payment.projectId ? `/projects/${payment.projectId}/finance` : '/finance',
            metadata: { paymentId: payment.id, invoiceNumber: payment.invoiceNumber },
        });
    }

    static async notifyInvoiceDue(invoice: {
        id: string;
        invoiceNumber: string;
        amount: number;
        dueDate: Date;
        daysOverdue: number;
        clientName: string;
    }) {
        const urgency: NotificationPriority = invoice.daysOverdue > 7 ? 'CRITICAL' : invoice.daysOverdue > 3 ? 'HIGH' : 'MEDIUM';

        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'],
            title: 'Invoice Overdue',
            message: `Invoice #${invoice.invoiceNumber} for ${invoice.amount.toLocaleString()} LKR from ${invoice.clientName} is ${invoice.daysOverdue} day(s) overdue (Due: ${invoice.dueDate.toLocaleDateString()}).`,
            type: 'FINANCE',
            priority: urgency,
            link: '/finance/invoices',
            metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, daysOverdue: invoice.daysOverdue },
        });
    }

    static async notifyExpenseApproval(expense: {
        id: string;
        expenseNumber: string;
        amount: number;
        submittedByName: string;
        category: string;
        projectName?: string;
    }) {
        const projectRef = expense.projectName ? ` for ${expense.projectName}` : '';

        await NotificationService.notifyByRole({
            roles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
            title: 'Expense Requires Approval',
            message: `${expense.submittedByName} submitted ${expense.category} expense of ${expense.amount.toLocaleString()} LKR${projectRef} (Ref: ${expense.expenseNumber}).`,
            type: 'FINANCE',
            priority: 'HIGH',
            link: '/finance/expenses',
            metadata: { expenseId: expense.id, expenseNumber: expense.expenseNumber },
        });
    }

    // ============================================================
    // APPOINTMENT/SCHEDULING POLICIES
    // ============================================================

    static async notifyAppointmentReminder(appointment: {
        id: string;
        soNum: string;
        customerName: string;
        date: Date;
        time: string;
        assignedToId?: string;
        contactNumber?: string;
        interval?: string;
        rtom?: string;
    }) {
        const appointmentDate = appointment.date.toLocaleDateString();
        const intervalLabel = appointment.interval ? ` in ${appointment.interval}` : '';
        const message = `Reminder: Appointment for SO #${appointment.soNum} (${appointment.customerName}) is scheduled${intervalLabel} (on ${appointmentDate} at ${appointment.time}).`;
        const rtomParam = appointment.rtom ? `&rtom=${appointment.rtom}` : '';
        const targetLink = `/service-orders?search=${appointment.soNum}${rtomParam}`;

        // Notify the assigned technician/team
        if (appointment.assignedToId) {
            await NotificationRetryService.enqueue({
                userId: appointment.assignedToId,
                title: `Appointment Reminder (${appointment.interval || 'Upcoming'})`,
                message,
                type: 'PROJECT',
                priority: 'HIGH',
                link: targetLink,
                metadata: { soNum: appointment.soNum, appointmentId: appointment.id, interval: appointment.interval, rtom: appointment.rtom },
                channels: ['IN_APP', 'PUSH'],
            });
        }

        // Notify relevant managers
        await NotificationService.notifyByRole({
            roles: ['AREA_MANAGER', 'ENGINEER'],
            title: `Upcoming Appointment (${appointment.interval || 'Upcoming'})`,
            message: `Appointment for SO #${appointment.soNum} (${appointment.customerName}) is scheduled${intervalLabel} at ${appointment.time}${appointment.contactNumber ? ` | Contact: ${appointment.contactNumber}` : ''}.`,
            type: 'PROJECT',
            priority: 'MEDIUM',
            link: targetLink,
            metadata: { soNum: appointment.soNum, interval: appointment.interval, rtom: appointment.rtom },
        });
    }

    // ============================================================
    // BATCH/DIGEST NOTIFICATION HELPERS
    // ============================================================

    /**
     * Send a daily digest of unread notifications to a user
     */
    static async sendDailyDigest(userId: string, userEmail: string): Promise<void> {
        try {
            const unreadNotifications = await NotificationService.getUserNotifications(userId, 20);
            const unread = unreadNotifications.filter((n: any) => !n.isRead);

            if (unread.length === 0) return;

            const criticalCount = unread.filter((n: any) => n.priority === 'CRITICAL').length;
            const highCount = unread.filter((n: any) => n.priority === 'HIGH').length;

            const summary = `You have ${unread.length} unread notification(s) (${criticalCount} critical, ${highCount} high priority).`;

            // Send digest email
            const { EmailService } = await import('./email.service');
            const htmlRows = unread.slice(0, 10).map((n: any) =>
                `<tr>
                    <td style="padding:8px;border-bottom:1px solid #e2e8f0;">
                        <span style="background:${n.priority === 'CRITICAL' ? '#fee2e2' : n.priority === 'HIGH' ? '#fef3c7' : '#f1f5f9'};padding:2px 8px;border-radius:4px;font-size:11px;">${n.priority}</span>
                        <strong style="margin-left:8px;">${n.title}</strong>
                        <div style="font-size:12px;color:#64748b;margin-top:4px;">${n.message}</div>
                    </td>
                </tr>`
            ).join('');

            await EmailService.sendMail({
                to: userEmail,
                subject: `[SLTS NEXUS] Daily Summary - ${unread.length} Unread Notifications`,
                text: summary,
                html: `<div style="font-family:sans-serif;padding:20px;max-width:600px;">
                    <h2>📋 Daily Notification Summary</h2>
                    <p>${summary}</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">${htmlRows}</table>
                    <p style="font-size:12px;color:#94a3b8;">Login to <a href="${process.env.NEXT_PUBLIC_APP_URL}">SLTS NEXUS</a> to view all notifications.</p>
                </div>`,
            });
        } catch (error) {
            console.error(`Daily digest failed for user ${userId}:`, error);
        }
    }

    /**
     * Check for and notify about stale/escalated notifications
     */
    static async checkEscalations(): Promise<{ escalated: number }> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Find CRITICAL unread notifications older than 1 hour
        const criticalUnread = await prisma.notification.findMany({
            where: {
                isRead: false,
                priority: 'CRITICAL',
                createdAt: { lt: oneHourAgo },
            },
        });

        // Find HIGH unread notifications older than 24 hours
        const highUnread = await prisma.notification.findMany({
            where: {
                isRead: false,
                priority: 'HIGH',
                createdAt: { lt: twentyFourHoursAgo },
            },
        });

        const escalated = [...criticalUnread, ...highUnread];

        for (const notification of escalated) {
            // Escalate to admins
            await NotificationService.notifyByRole({
                roles: ['SUPER_ADMIN', 'ADMIN'],
                title: 'Escalated: Unread Notification',
                message: `CRITICAL notification "${notification.title}" for user ${notification.userId} remains unread after ${notification.priority === 'CRITICAL' ? '1 hour' : '24 hours'}.`,
                type: 'SYSTEM',
                priority: 'CRITICAL',
                link: notification.link || undefined,
                metadata: { originalNotificationId: notification.id, escalatedUserId: notification.userId },
            });
        }

        return { escalated: escalated.length };
    }
}