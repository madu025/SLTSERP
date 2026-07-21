
/**
 * Web Push Notification Service
 * Delivers push notifications via the Web Push API (VAPID protocol)
 * for users who have subscribed to push notifications.
 */

import webPush from 'web-push';
import { prisma } from '@/lib/prisma';

// Configure VAPID keys (generate once with: webpush.generateVAPIDKeys())
const vapidKeys = {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@slterp.lk',
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
    webPush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);
}

export interface PushSubscriptionPayload {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    icon?: string;
    image?: string;
    badge?: string;
    tag?: string;
    data?: {
        url?: string;
        notificationId?: string;
        type?: string;
        [key: string]: any;
    };
    actions?: Array<{ action: string; title: string; icon?: string }>;
    requireInteraction?: boolean;
    vibrate?: number[];
    timestamp?: number;
}

export class PushNotificationService {
    /**
     * Save a push subscription for a user
     */
    static async saveSubscription(userId: string, subscription: PushSubscriptionPayload): Promise<void> {
        try {
            await prisma.pushSubscription.upsert({
                where: {
                    userId_endpoint: {
                        userId,
                        endpoint: subscription.endpoint || '',
                    },
                },
                create: {
                    userId,
                    endpoint: subscription.endpoint || '',
                    p256dh: subscription.keys?.p256dh || '',
                    auth: subscription.keys?.auth || '',
                },
                update: {
                    p256dh: subscription.keys?.p256dh || '',
                    auth: subscription.keys?.auth || '',
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Failed to save push subscription:', error);
        }
    }

    /**
     * Remove a push subscription
     */
    static async removeSubscription(userId: string, endpoint: string): Promise<void> {
        try {
            await prisma.pushSubscription.deleteMany({
                where: { userId, endpoint },
            });
        } catch (error) {
            console.error('Failed to remove push subscription:', error);
        }
    }

    /**
     * Send push notification to a single user
     */
    static async sendToUser(
        userId: string,
        payload: PushNotificationPayload,
    ): Promise<{ success: number; failed: number }> {
        try {
            const subscriptions = await prisma.pushSubscription.findMany({
                where: { userId },
            });

            if (subscriptions.length === 0) {
                return { success: 0, failed: 0 };
            }

            let success = 0;
            let failed = 0;

            const pushPayload = JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/logo5.png',
                badge: payload.badge || '/logo5.png',
                image: payload.image,
                tag: payload.tag,
                data: payload.data,
                actions: payload.actions,
                requireInteraction: payload.requireInteraction ?? false,
                vibrate: payload.vibrate ?? [200, 100, 200],
                timestamp: payload.timestamp ?? Date.now(),
            });

            for (const sub of subscriptions) {
                try {
                    await webPush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        },
                        pushPayload,
                    );
                    success++;
                } catch (error: any) {
                    // If subscription is expired/unsubscribed, remove it
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await this.removeSubscription(userId, sub.endpoint);
                    }
                    failed++;
                    console.warn(`Push delivery failed for ${userId} (endpoint: ${sub.endpoint}):`, error.statusCode);
                }
            }

            return { success, failed };
        } catch (error) {
            console.error('Failed to send push notification:', error);
            return { success: 0, failed: 1 };
        }
    }

    /**
     * Send push notification to multiple users
     */
    static async sendToUsers(
        userIds: string[],
        payload: PushNotificationPayload,
    ): Promise<{ totalSuccess: number; totalFailed: number }> {
        let totalSuccess = 0;
        let totalFailed = 0;

        for (const userId of userIds) {
            const { success, failed } = await this.sendToUser(userId, payload);
            totalSuccess += success;
            totalFailed += failed;
        }

        return { totalSuccess, totalFailed };
    }

    /**
     * Get public VAPID key for client-side subscription
     */
    static getPublicKey(): string {
        return vapidKeys.publicKey;
    }

    /**
     * Check if push service is configured
     */
    static isConfigured(): boolean {
        return !!(vapidKeys.publicKey && vapidKeys.privateKey);
    }
}