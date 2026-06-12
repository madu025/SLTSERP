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

            // Fetch users to process
            const users = await prisma.user.findMany({
                where: userId ? { id: userId } : {},
                include: { accessibleOpmcs: true }
            });

            for (const user of users) {
                const opmcIds = user.accessibleOpmcs.map(o => o.id);
                
                // Construct query to find active scheduled appointments for today
                const whereClause: Prisma.ServiceOrderWhereInput = {
                    scheduledDate: {
                        gte: todayStart,
                        lt: todayEnd
                    },
                    sltsStatus: { notIn: ["COMPLETED", "RETURN"] }
                };

                // Filter by OPMC for non-admin users
                if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
                    if (opmcIds.length === 0) continue; // Skip if user has no assigned OPMCs
                    whereClause.opmcId = { in: opmcIds };
                }

                const appointments = await prisma.serviceOrder.findMany({
                    where: whereClause
                });

                for (const sod of appointments) {
                    // 1. Notify user about today's scheduled appointments
                    const todayTitle = `Today Appointment: ${sod.soNum}`;
                    const todayMsg = `Appointment scheduled today for Customer: ${sod.customerName || 'N/A'}${sod.scheduledTime ? ` at ${sod.scheduledTime}` : ''}. DP: ${sod.dp || '-'}`;
                    
                    const existingToday = await prisma.notification.findFirst({
                        where: {
                            userId: user.id,
                            title: todayTitle
                        }
                    });

                    if (!existingToday) {
                        await NotificationService.send({
                            userId: user.id,
                            title: todayTitle,
                            message: todayMsg,
                            type: 'SYSTEM',
                            priority: 'MEDIUM',
                            link: `/service-orders?search=${sod.soNum}`
                        });
                    }

                    // 2. Proactive reminders: 2 hours, 1 hour, 30 minutes before appointment time
                    if (sod.scheduledDate && sod.scheduledTime) {
                        const [hoursStr, minutesStr] = sod.scheduledTime.split(':');
                        const hours = parseInt(hoursStr, 10);
                        const minutes = parseInt(minutesStr, 10);

                        if (!isNaN(hours) && !isNaN(minutes)) {
                            const appointmentTime = new Date(sod.scheduledDate);
                            appointmentTime.setHours(hours, minutes, 0, 0);

                            const diffMs = appointmentTime.getTime() - now.getTime();
                            const diffMinutes = Math.round(diffMs / 60000);

                            // Helper function to send reminder if within the target time range
                            const checkAndSendReminder = async (label: string, minLimit: number, maxLimit: number, text: string) => {
                                if (diffMinutes >= minLimit && diffMinutes <= maxLimit) {
                                    const reminderTitle = `${label} Reminder: ${sod.soNum}`;
                                    const existingReminder = await prisma.notification.findFirst({
                                        where: {
                                            userId: user.id,
                                            title: reminderTitle
                                        }
                                    });

                                    if (!existingReminder) {
                                        await NotificationService.send({
                                            userId: user.id,
                                            title: reminderTitle,
                                            message: `Appointment in ${text} for Customer: ${sod.customerName || 'N/A'} at ${sod.scheduledTime}. DP: ${sod.dp || '-'}`,
                                            type: 'SYSTEM',
                                            priority: 'HIGH',
                                            link: `/service-orders?search=${sod.soNum}`
                                        });
                                    }
                                }
                            };

                            // Range checks to prevent missed notifications due to minor timing variations
                            // 2 hours reminder (90 to 130 minutes before)
                            await checkAndSendReminder("2h", 90, 130, "2 hours");

                            // 1 hour reminder (45 to 75 minutes before)
                            await checkAndSendReminder("1h", 45, 75, "1 hour");

                            // 30 minutes reminder (15 to 40 minutes before)
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
