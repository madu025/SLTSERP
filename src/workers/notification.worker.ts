import { Worker } from 'bullmq';
import { redis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue';
import { PushNotificationService } from '@/services/notification/push/push.service';
import { EmailService } from '@/services/notification/email.service';
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
                await EmailService.sendMail({
                    to: user.email,
                    subject: title,
                    text: `${message}\n\nLink: ${link ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${link}` : 'N/A'}`
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
}, { connection: redis as unknown as import('bullmq').ConnectionOptions });

notificationWorker.on('failed', (job, err) => {
    console.error(`[NOTIFICATION-WORKER] Job ${job?.id} failed with error:`, err.message);
});

console.log(`👷 [WORKER] Started Notification Worker for queue: ${QUEUE_NAMES.NOTIFICATIONS}`);
