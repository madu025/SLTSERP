import { prisma } from '@/lib/prisma';
import { NotificationService } from './index';
import { Prisma } from '@prisma/client';

export class AppointmentNotificationService {
    static async checkAndNotify(userId?: string) {
        try {
            const now = new Date();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(todayStart);
            todayEnd.setDate(todayEnd.getDate() + 1);

            // 1. Fetch users to process
            const users = await prisma.user.findMany({
                where: userId ? { id: userId } : {},
                include: { accessibleOpmcs: true }
            });

            if (users.length === 0) return;

            // 2. Fetch all active scheduled appointments for today in a single query
            const allAppointments = await prisma.serviceOrder.findMany({
                where: {
                    scheduledDate: {
                        gte: todayStart,
                        lt: todayEnd
                    },
                    sltsStatus: { notIn: ["COMPLETED", "RETURN"] }
                }
            });

            if (allAppointments.length === 0) return;

            // 3. Fetch all system notifications sent today to build an in-memory sent set
            const todayNotifications = await prisma.notification.findMany({
                where: {
                    createdAt: { gte: todayStart, lt: todayEnd },
                    type: 'SYSTEM'
                },
                select: { userId: true, title: true }
            });

            const sentSet = new Set<string>();
            for (const n of todayNotifications) {
                sentSet.add(`${n.userId}:${n.title}`);
            }

            // 4. Process notifications per user in-memory
            for (const user of users) {
                const opmcIds = new Set(user.accessibleOpmcs.map(o => o.id));
                
                // Filter appointments matching user OPMC visibility in-memory
                const userAppointments = allAppointments.filter(sod => {
                    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
                        return true;
                    }
                    return sod.opmcId && opmcIds.has(sod.opmcId);
                });

                for (const sod of userAppointments) {
                    // A. Daily Appointment Announcement
                    const todayTitle = `Today Appointment: ${sod.soNum}`;
                    const todayMsg = `Appointment scheduled today for Customer: ${sod.customerName || 'N/A'}${sod.scheduledTime ? ` at ${sod.scheduledTime}` : ''}. DP: ${sod.dp || '-'}`;
                    
                    const todayKey = `${user.id}:${todayTitle}`;
                    if (!sentSet.has(todayKey)) {
                        await NotificationService.send({
                            userId: user.id,
                            title: todayTitle,
                            message: todayMsg,
                            type: 'SYSTEM',
                            priority: 'MEDIUM',
                            link: `/service-orders?search=${sod.soNum}`
                        });
                        sentSet.add(todayKey);
                    }

                    // B. Proactive timing reminders
                    if (sod.scheduledDate && sod.scheduledTime) {
                        const [hoursStr, minutesStr] = sod.scheduledTime.split(':');
                        const hours = parseInt(hoursStr, 10);
                        const minutes = parseInt(minutesStr, 10);

                        if (!isNaN(hours) && !isNaN(minutes)) {
                            const appointmentTime = new Date(sod.scheduledDate);
                            appointmentTime.setHours(hours, minutes, 0, 0);

                            const diffMs = appointmentTime.getTime() - now.getTime();
                            const diffMinutes = Math.round(diffMs / 60000);

                            const checkAndSendReminder = async (label: string, minLimit: number, maxLimit: number, text: string) => {
                                if (diffMinutes >= minLimit && diffMinutes <= maxLimit) {
                                    const reminderTitle = `${label} Reminder: ${sod.soNum}`;
                                    const reminderKey = `${user.id}:${reminderTitle}`;

                                    if (!sentSet.has(reminderKey)) {
                                        await NotificationService.send({
                                            userId: user.id,
                                            title: reminderTitle,
                                            message: `Appointment in ${text} for Customer: ${sod.customerName || 'N/A'} at ${sod.scheduledTime}. DP: ${sod.dp || '-'}`,
                                            type: 'SYSTEM',
                                            priority: 'HIGH',
                                            link: `/service-orders?search=${sod.soNum}`
                                        });
                                        sentSet.add(reminderKey);
                                    }
                                }
                            };

                            // Proactive reminder windows
                            await checkAndSendReminder("2h", 90, 130, "2 hours");
                            await checkAndSendReminder("1h", 45, 75, "1 hour");
                            await checkAndSendReminder("30m", 15, 40, "30 minutes");
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to check and notify today's appointments:", error);
        }
    }
}
