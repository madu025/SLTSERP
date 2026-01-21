import { prisma } from '@/lib/prisma';
import { NotificationService } from './notification.service';
import { startOfDay, endOfDay, subDays, subMonths } from 'date-fns';

export class AutomationService {
    /**
     * 1. Low Stock Audit - Daily summary of items below min level
     */
    static async runLowStockAudit() {
        console.log('[AUTOMATION] Running Low Stock Audit...');

        // Fetch all stock records with item data (manually filter to avoid complex field-to-field comparisons)
        const allStocks = await prisma.inventoryStock.findMany({
            include: {
                item: true,
                store: true
            }
        });

        const criticalItems = allStocks.filter(s => s.item.minLevel > 0 && s.quantity < s.item.minLevel);

        if (criticalItems.length > 0) {
            // Group by store
            const storeGroups = criticalItems.reduce((acc: any, curr) => {
                if (!acc[curr.store.name]) acc[curr.store.name] = [];
                acc[curr.store.name].push(curr.item.name);
                return acc;
            }, {});

            for (const [storeName, items] of Object.entries(storeGroups)) {
                await NotificationService.notifyByRole({
                    roles: ['STORES_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
                    title: 'Daily Low Stock Summary',
                    message: `Store "${storeName}" has ${(items as string[]).length} items below minimum level: ${(items as string[]).slice(0, 3).join(', ')}...`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/stocks'
                });
            }
        }
        return { checked: allStocks.length, critical: criticalItems.length };
    }

    /**
     * 2. Pending Approvals Reminder - Items pending for > 24 hours
     */
    static async runPendingApprovalReminder() {
        console.log('[AUTOMATION] Checking for stalled approvals...');
        const threshold = subDays(new Date(), 1);

        // a) Stalled Contractors
        const stalledContractors = await prisma.contractor.count({
            where: {
                status: { in: ['ARM_PENDING', 'OSP_PENDING'] },
                updatedAt: { lt: threshold }
            }
        });

        if (stalledContractors > 0) {
            await NotificationService.notifyByRole({
                roles: ['OSP_MANAGER', 'AREA_MANAGER', 'ADMIN'],
                title: 'Stalled Contractor Approvals',
                message: `There are ${stalledContractors} contractor registrations pending for more than 24 hours.`,
                type: 'CONTRACTOR',
                priority: 'MEDIUM',
                link: '/admin/contractors/approvals'
            });
        }

        // b) Stalled Material Requests
        const stalledRequests = await prisma.stockRequest.count({
            where: {
                status: 'PENDING',
                createdAt: { lt: threshold }
            }
        });

        if (stalledRequests > 0) {
            await NotificationService.notifyByRole({
                roles: ['STORES_MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
                title: 'Stalled Material Requests',
                message: `There are ${stalledRequests} material requests awaiting approval for over 24 hours.`,
                type: 'INVENTORY',
                priority: 'HIGH',
                link: '/admin/inventory/requests'
            });
        }

        return { stalledContractors, stalledRequests };
    }

    /**
     * 3. Daily Performance Summary
     */
    static async runDailyPerformanceSummary() {
        console.log('[AUTOMATION] Generating Daily Performance Summary...');
        const today = new Date();
        const start = startOfDay(today);
        const end = endOfDay(today);

        const [completed, returned] = await Promise.all([
            prisma.serviceOrder.count({ where: { sltsStatus: 'COMPLETED', completedDate: { gte: start, lte: end } } }),
            prisma.serviceOrder.count({ where: { sltsStatus: 'RETURN', updatedAt: { gte: start, lte: end } } })
        ]);

        await NotificationService.notifyByRole({
            roles: ['OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'OFFICE_ADMIN'],
            title: 'Daily Operational Summary',
            message: `Performance for today: ${completed} SODs Completed successfully, ${returned} SODs Returned. Check reports for details.`,
            type: 'PROJECT',
            priority: 'MEDIUM',
            link: '/reports/daily-operational'
        });

        return { completed, returned };
    }

    /**
     * 4. Automatic System Cleanup - Older than 3 months Audit Logs & Notifications
     */
    static async runAuditLogCleanup() {
        console.log('[AUTOMATION] Cleaning up old audit logs and notifications...');
        const threeMonthsAgo = subMonths(new Date(), 3);
        const oneMonthAgo = subMonths(new Date(), 1);

        // Clean old audit logs (3 months)
        const auditResult = await prisma.auditLog.deleteMany({
            where: { createdAt: { lt: threeMonthsAgo } }
        });

        // Clean old read notifications (1 month)
        const notificationResult = await prisma.notification.deleteMany({
            where: {
                createdAt: { lt: oneMonthAgo },
                isRead: true
            }
        });

        console.log(`[AUTOMATION] Deleted ${auditResult.count} audit logs (>3 months) and ${notificationResult.count} notifications (>1 month).`);
        return { auditLogs: auditResult.count, notifications: notificationResult.count };
    }

    /**
     * Master Runner
     */
    static async runAllDailyTasks() {
        const results = {
            lowStock: await this.runLowStockAudit(),
            reminders: await this.runPendingApprovalReminder(),
            performance: await this.runDailyPerformanceSummary(),
            cleanup: await this.runAuditLogCleanup()
        };
        return results;
    }
}
