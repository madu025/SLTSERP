
/**
 * Scheduled Reminder & Escalation Scheduler
 * Runs on a cron schedule to check for:
 * - Upcoming appointments (24h/1h reminders)
 * - Task due date reminders
 * - Milestone due date alerts
 * - Batch expiry reminders
 * - Unread notification escalations
 * - Daily digest emails
 */

import { prisma } from '@/lib/prisma';
import { NotificationService } from './index';
import { DomainNotificationPolicies } from './domain-policies.service';
import { NotificationRetryService } from './retry.service';

interface SchedulerResult {
    name: string;
    itemsProcessed: number;
    notificationsCreated: number;
    errors: number;
}

export class ReminderSchedulerService {

    /**
     * Main scheduler entry point - run every 15 minutes via cron
     */
    static async runAll(): Promise<SchedulerResult[]> {
        const results: SchedulerResult[] = [];

        results.push(await this.checkAppointmentReminders());
        results.push(await this.checkTaskDueDates());
        results.push(await this.checkMilestoneDueDates());
        results.push(await this.checkBatchExpirations());
        results.push(await this.checkNotificationEscalations());

        return results;
    }

    /**
     * Run hourly tasks (lighter checks)
     */
    static async runHourly(): Promise<SchedulerResult[]> {
        const results: SchedulerResult[] = [];

        results.push(await this.checkNotificationEscalations());

        // Send daily digest at configured hour (e.g., 8 AM)
        const now = new Date();
        if (now.getHours() === 8) {
            results.push(await this.sendDailyDigests());
        }

        return results;
    }

    /**
     * Check for upcoming appointments within 24 hours and 1 hour
     */
    static async checkAppointmentReminders(): Promise<SchedulerResult> {
        const result: SchedulerResult = {
            name: 'appointment-reminders',
            itemsProcessed: 0,
            notificationsCreated: 0,
            errors: 0,
        };

        try {
            const now = new Date();
            const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Find appointments that are scheduled in the next 24 hours
            const upcomingAppointments = await prisma.serviceOrder.findMany({
                where: {
                    scheduledDate: {
                        gte: now,
                        lte: twentyFourHoursFromNow,
                    },
                    status: 'INPROGRESS',
                },
                select: {
                    id: true,
                    soNum: true,
                    customerName: true,
                    scheduledDate: true,
                    scheduledTime: true,
                    techContact: true,
                    opmcId: true,
                    contractorId: true,
                    opmc: {
                        select: {
                            rtom: true
                        }
                    }
                },
                take: 100,
            });

            // Define timing windows in minutes:
            // 12h: [660m, 720m]
            // 5h:  [270m, 300m]
            // 3h:  [150m, 180m]
            // 1h:  [40m,  60m]
            // 30m: [10m,  30m]
            const intervals = [
                { name: '12h', minLimit: 660, maxLimit: 720 },
                { name: '5h', minLimit: 270, maxLimit: 300 },
                { name: '3h', minLimit: 150, maxLimit: 180 },
                { name: '1h', minLimit: 40, maxLimit: 60 },
                { name: '30m', minLimit: 10, maxLimit: 30 }
            ];

            for (const order of upcomingAppointments) {
                if (!order.scheduledDate) continue;
                result.itemsProcessed++;

                const appointmentTime = new Date(
                    order.scheduledDate.getFullYear(),
                    order.scheduledDate.getMonth(),
                    order.scheduledDate.getDate(),
                    ...(order.scheduledTime ? order.scheduledTime.split(':').map(Number) : [0, 0]),
                );

                const minutesUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);

                // Find if the order falls into an active reminder window
                const activeInterval = intervals.find(inv => minutesUntil > inv.minLimit && minutesUntil <= inv.maxLimit);

                if (activeInterval) {
                    const targetLink = `/service-orders?search=${order.soNum}&rtom=${order.opmc.rtom}`;
                    // Check if this specific interval reminder has already been sent to avoid duplicate spam
                    const alreadySent = await prisma.notification.findFirst({
                        where: {
                            link: targetLink,
                            metadata: {
                                path: ['interval'],
                                equals: activeInterval.name
                            }
                        },
                        select: { id: true }
                    });

                    if (!alreadySent) {
                        await DomainNotificationPolicies.notifyAppointmentReminder({
                            id: order.id,
                            soNum: order.soNum,
                            customerName: order.customerName || 'Customer',
                            date: order.scheduledDate,
                            time: order.scheduledTime || 'Unknown',
                            assignedToId: undefined,
                            contactNumber: order.techContact || undefined,
                            interval: activeInterval.name,
                            rtom: order.opmc.rtom
                        });

                        result.notificationsCreated++;
                    }
                }
            }
        } catch (error) {
            console.error('[Scheduler] Appointment reminder check failed:', error);
            result.errors++;
        }

        return result;
    }

    /**
     * Check for tasks due in the next 24-48 hours
     */
    static async checkTaskDueDates(): Promise<SchedulerResult> {
        const result: SchedulerResult = {
            name: 'task-due-dates',
            itemsProcessed: 0,
            notificationsCreated: 0,
            errors: 0,
        };

        try {
            const now = new Date();
            const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

            // Find project tasks due in next 48 hours
            const dueTasks = await (prisma as any).projectTask.findMany({
                where: {
                    dueDate: {
                        gte: now,
                        lte: fortyEightHoursFromNow,
                    },
                    status: { notIn: ['COMPLETED', 'CANCELLED'] },
                },
                include: {
                    project: {
                        select: { id: true, name: true, code: true },
                    },
                    assignedTo: {
                        select: { id: true },
                    },
                },
                take: 50,
            });

            for (const task of dueTasks) {
                if (!task.dueDate || !task.assignedTo?.id) continue;
                result.itemsProcessed++;

                await NotificationRetryService.enqueue({
                    userId: task.assignedTo.id,
                    title: 'Task Due Reminder',
                    message: `Task "${task.title}" in project "${task.project?.name || 'Unknown'}" is due on ${new Date(task.dueDate).toLocaleDateString()}. Priority: ${task.priority || 'MEDIUM'}`,
                    type: 'PROJECT',
                    priority: 'HIGH',
                    link: `/projects/${task.project?.id}/tasks`,
                    metadata: { taskId: task.id, projectCode: task.project?.code },
                    channels: ['IN_APP', 'PUSH'],
                });
                result.notificationsCreated++;
            }
        } catch (error) {
            console.error('[Scheduler] Task due date check failed:', error);
            result.errors++;
        }

        return result;
    }

    /**
     * Check for upcoming milestone due dates
     */
    static async checkMilestoneDueDates(): Promise<SchedulerResult> {
        const result: SchedulerResult = {
            name: 'milestone-due-dates',
            itemsProcessed: 0,
            notificationsCreated: 0,
            errors: 0,
        };

        try {
            const now = new Date();
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const dueMilestones = await (prisma as any).projectMilestone.findMany({
                where: {
                    dueDate: {
                        gte: now,
                        lte: sevenDaysFromNow,
                    },
                    status: { not: 'COMPLETED' },
                },
                include: {
                    project: {
                        select: { id: true, name: true, code: true },
                    },
                },
                take: 30,
            });

            for (const milestone of dueMilestones) {
                if (!milestone.dueDate || !milestone.project) continue;

                const daysRemaining = Math.ceil(
                    (new Date(milestone.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );

                // Only alert for close deadlines (1, 3, 7 days)
                if ([1, 3, 7].includes(daysRemaining)) {
                    result.itemsProcessed++;

                    await DomainNotificationPolicies.notifyMilestoneDue({
                        id: milestone.project.id,
                        name: milestone.project.name,
                        code: milestone.project.code,
                        milestoneName: milestone.name,
                        dueDate: new Date(milestone.dueDate),
                        daysRemaining,
                    });
                    result.notificationsCreated++;
                }
            }
        } catch (error) {
            console.error('[Scheduler] Milestone due date check failed:', error);
            result.errors++;
        }

        return result;
    }

    /**
     * Check for inventory batch expirations (FEFO compliance)
     */
    static async checkBatchExpirations(): Promise<SchedulerResult> {
        const result: SchedulerResult = {
            name: 'batch-expirations',
            itemsProcessed: 0,
            notificationsCreated: 0,
            errors: 0,
        };

        try {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const expiringBatches = await prisma.inventoryBatch.findMany({
                where: {
                    expiryDate: {
                        lte: thirtyDaysFromNow,
                        gt: new Date(),
                    },
                },
                include: {
                    item: true,
                    storeStocks: {
                        where: { quantity: { gt: 0 } },
                        include: { store: true },
                    },
                },
                take: 30,
            });

            for (const batch of expiringBatches) {
                for (const bs of batch.storeStocks) {
                    result.itemsProcessed++;



                    const { NotificationPolicyService } = await import('./notification-policy.service');
                    await NotificationPolicyService.notifyLowStock(
                        bs.store.name,
                        batch.item.name,
                        Number(bs.quantity),
                        0 // Using 0 to always trigger notification for expiring items
                    );

                    result.notificationsCreated++;
                }
            }
        } catch (error) {
            console.error('[Scheduler] Batch expiry check failed:', error);
            result.errors++;
        }

        return result;
    }

    /**
     * Check for unread notifications that need escalation
     */
    static async checkNotificationEscalations(): Promise<SchedulerResult> {
        const result: SchedulerResult = {
            name: 'notification-escalations',
            itemsProcessed: 0,
            notificationsCreated: 0,
            errors: 0,
        };

        try {
            const { escalated } = await DomainNotificationPolicies.checkEscalations();
            result.itemsProcessed = 1;
            result.notificationsCreated = escalated;
        } catch (error) {
            console.error('[Scheduler] Escalation check failed:', error);
            result.errors++;
        }

        return result;
    }

    /**
     * Send daily digest emails to all active users
     */
    static async sendDailyDigests(): Promise<SchedulerResult> {
        const result: SchedulerResult = {
            name: 'daily-digests',
            itemsProcessed: 0,
            notificationsCreated: 0,
            errors: 0,
        };

        try {
            // Get active users with email who have unread notifications
            const users = await prisma.user.findMany({
                where: {
                    email: { not: "" },
                    notifications: {
                        some: { isRead: false },
                    },
                },
                select: { id: true, email: true },
                take: 100,
            });

            for (const user of users) {
                if (!user.email) continue;

                try {
                    await DomainNotificationPolicies.sendDailyDigest(user.id, user.email);
                    result.itemsProcessed++;
                } catch (err) {
                    console.error(`[Scheduler] Digest failed for user ${user.id}:`, err);
                    result.errors++;
                }
            }
        } catch (error) {
            console.error('[Scheduler] Daily digest check failed:', error);
            result.errors++;
        }

        return result;
    }

    /**
     * Run auto-cleanup of old notifications
     */
    static async cleanupOldNotifications(days = 30): Promise<{ deleted: number }> {
        try {
            return await NotificationService.cleanup(days);
        } catch (error) {
            console.error('[Scheduler] Notification cleanup failed:', error);
            return { deleted: 0 };
        }
    }
}