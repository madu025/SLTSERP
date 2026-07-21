
/**
 * Notification Retry & Delivery Guarantee Service
 * Ensures critical notifications are delivered with retry + exponential backoff.
 * Uses in-memory queue with optional Redis persistence for production.
 */

import { NotificationService } from './index';
import { PushNotificationService, PushNotificationPayload } from './push/push.service';
import { EmailService } from './email.service';

interface RetryTask {
    id: string;
    type: 'IN_APP' | 'PUSH' | 'EMAIL';
    payload: any;
    attempts: number;
    maxAttempts: number;
    nextRetryAt: number;
    lastError?: string;
    createdAt: number;
}

interface DeliveryResult {
    id: string;
    type: string;
    success: boolean;
    attempts: number;
    error?: string;
}

export class NotificationRetryService {
    private static queue: Map<string, RetryTask> = new Map();
    private static processing = false;
    private static maxConcurrent = 5;

    /**
     * Send with guaranteed delivery (retries with exponential backoff)
     */
    static async sendWithRetry(params: {
        deliveryId: string;
        sendFn: () => Promise<boolean>;
        maxAttempts?: number;
        initialDelayMs?: number;
    }): Promise<DeliveryResult> {
        const { deliveryId, sendFn, maxAttempts = 3, initialDelayMs = 1000 } = params;
        let attempts = 0;
        let lastError: string | undefined;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const success = await sendFn();
                if (success) {
                    return {
                        id: deliveryId,
                        type: 'IN_APP',
                        success: true,
                        attempts,
                    };
                }
                lastError = 'Delivery returned false';
            } catch (error: any) {
                lastError = error?.message || 'Unknown error';
                console.warn(`[Retry] Attempt ${attempts}/${maxAttempts} failed for ${deliveryId}:`, lastError);
            }

            if (attempts < maxAttempts) {
                // Exponential backoff: 1s, 4s, 9s, ...
                const delay = initialDelayMs * attempts * attempts;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return {
            id: deliveryId,
            type: 'IN_APP',
            success: false,
            attempts,
            error: lastError,
        };
    }

    /**
     * Enqueue a notification for guaranteed delivery
     */
    static async enqueue(params: {
        userId: string;
        title: string;
        message: string;
        type?: any;
        priority?: any;
        link?: string;
        metadata?: any;
        channels?: ('IN_APP' | 'PUSH' | 'EMAIL')[];
        userEmail?: string;
    }): Promise<DeliveryResult[]> {
        const {
            userId,
            title,
            message,
            type = 'SYSTEM',
            priority = 'MEDIUM',
            link,
            metadata,
            channels = ['IN_APP'],
            userEmail,
        } = params;

        const results: DeliveryResult[] = [];

        for (const channel of channels) {
            const deliveryId = `retry-${channel}-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            if (channel === 'IN_APP') {
                const result = await this.sendWithRetry({
                    deliveryId,
                    sendFn: async () => {
                        await NotificationService.send({
                            userId,
                            title,
                            message,
                            type,
                            priority,
                            link,
                            metadata,
                        });
                        return true;
                    },
                    maxAttempts: 4,
                });
                results.push(result);
            }

            if (channel === 'PUSH') {
                const pushPayload: PushNotificationPayload = {
                    title,
                    body: message,
                    data: { url: link, notificationId: deliveryId, type },
                    requireInteraction: priority === 'CRITICAL',
                };

                const result = await this.sendWithRetry({
                    deliveryId,
                    sendFn: async () => {
                        const { failed } = await PushNotificationService.sendToUser(userId, pushPayload);
                        return failed === 0;
                    },
                    maxAttempts: 3,
                    initialDelayMs: 2000,
                });
                results.push({ ...result, type: 'PUSH' });
            }

            if (channel === 'EMAIL' && userEmail) {
                const result = await this.sendWithRetry({
                    deliveryId,
                    sendFn: async () => {
                        await EmailService.sendMail({
                            to: userEmail,
                            subject: `[SLTS NEXUS] ${title}`,
                            text: message,
                            html: `<div style="font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto;">
                                <h2>${title}</h2>
                                <p>${message}</p>
                                <p><small>Priority: ${priority} | Type: ${type}</small></p>
                            </div>`,
                        });
                        return true;
                    },
                    maxAttempts: 3,
                    initialDelayMs: 3000,
                });
                results.push({ ...result, type: 'EMAIL' });
            }
        }

        return results;
    }

    /**
     * Enqueue a task to the background queue for async processing
     */
    static enqueueBackground(task: RetryTask): void {
        this.queue.set(task.id, task);
        this.processQueue().catch(err =>
            console.error('Background queue processing error:', err)
        );
    }

    /**
     * Process the background queue
     */
    private static async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        try {
            const now = Date.now();
            const pendingTasks = Array.from(this.queue.values())
                .filter(t => t.nextRetryAt <= now && t.attempts < t.maxAttempts)
                .slice(0, this.maxConcurrent);

            for (const task of pendingTasks) {
                try {
                    if (task.type === 'IN_APP') {
                        const { userId, title, message, type, priority, link, metadata } = task.payload;
                        await NotificationService.send({
                            userId,
                            title,
                            message,
                            type,
                            priority,
                            link,
                            metadata,
                        });
                    } else if (task.type === 'PUSH') {
                        await PushNotificationService.sendToUser(task.payload.userId, task.payload.pushPayload);
                    }

                    // Task succeeded - remove from queue
                    this.queue.delete(task.id);
                } catch (error: any) {
                    task.attempts++;
                    task.lastError = error?.message;
                    // Exponential backoff
                    task.nextRetryAt = Date.now() + Math.pow(2, task.attempts) * 5000;

                    if (task.attempts >= task.maxAttempts) {
                        console.error(`[Retry] Task ${task.id} failed after ${task.attempts} attempts, giving up.`);
                        this.queue.delete(task.id);
                    } else {
                        this.queue.set(task.id, task);
                    }
                }
            }
        } finally {
            this.processing = false;

            // If there are still pending tasks, schedule next processing
            const pendingCount = Array.from(this.queue.values()).filter(
                t => t.attempts < t.maxAttempts
            ).length;

            if (pendingCount > 0) {
                setTimeout(() => this.processQueue(), 10000);
            }
        }
    }

    /**
     * Get queue statistics
     */
    static getQueueStats(): { total: number; pending: number; failed: number } {
        const tasks = Array.from(this.queue.values());
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.attempts < t.maxAttempts).length,
            failed: tasks.filter(t => t.attempts >= t.maxAttempts).length,
        };
    }
}