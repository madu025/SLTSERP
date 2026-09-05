import { Worker } from 'bullmq';
import { createQueueConnection } from '@/lib/redis-queue';
import { QUEUE_NAMES } from '@/lib/queue';
import { PushNotificationService } from '@/services/notification/push/push.service';
import { EmailService } from '@/services/notification/email.service';
import { NotificationTemplateEngineService } from '@/services/notification/template-engine.service';
import { prisma } from '@/lib/prisma';

export const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATIONS, async (job) => {
    if (job.name === 'process-notification') {
        const { userId, title, message, link, priority } = job.data;
        
        // 1. Fetch user to check email and push endpoints
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true }
        });

        if (!user) return;

        // 2. Send Web Push
        try {
            await PushNotificationService.sendToUser(userId, {
                title,
                body: message,
                data: { url: link }
            });
        } catch (e) {
            console.error(`[NOTIFICATION-WORKER] Push failed for ${userId}:`, e);
        }

        // 3. Send Email (if critical or high)
        if (user.email && (priority === 'CRITICAL' || priority === 'HIGH')) {
            try {
                const notifVars: Record<string, string> = {
                    user: user.name || user.email,
                    title,
                    message,
                    actionUrl: link ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app'}${link}` : '#',
                    date: new Date().toLocaleString()
                };
                const dbTemplate = await NotificationTemplateEngineService.renderEmailByCode('NOTIFICATION_GENERIC', notifVars);

                await EmailService.sendMail({
                    to: user.email,
                    subject: dbTemplate?.subject || title,
                    text: dbTemplate?.text || `${message}\n\nLink: ${link ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app'}${link}` : 'N/A'}`,
                    html: dbTemplate?.html
                });
            } catch (e) {
                console.error(`[NOTIFICATION-WORKER] Email failed for ${userId}:`, e);
            }
        }

        // 4. Send SMS / WhatsApp (if CRITICAL alert for Field personnel)
        if (priority === 'CRITICAL' && (user as unknown as { phone?: string }).phone) {
            try {
                const { SMSService } = await import('@/services/notification/sms.service');
                await SMSService.send({
                    to: (user as unknown as { phone: string }).phone,
                    message: `[SLTS CRITICAL] ${title}: ${message}`
                });
            } catch (e) {
                console.error(`[NOTIFICATION-WORKER] SMS failed for ${userId}:`, e);
            }
        }
    }
}, { connection: createQueueConnection('worker:notification') });

notificationWorker.on('failed', (job, err) => {
    console.error(`[NOTIFICATION-WORKER] Job ${job?.id} failed with error:`, err.message);
});

console.log(`👷 [WORKER] Started Notification Worker for queue: ${QUEUE_NAMES.NOTIFICATIONS}`);
