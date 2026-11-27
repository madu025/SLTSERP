import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { ServiceOrderRepository } from '@/repositories/service-order.repository';
import { StockRequestRepository } from '@/repositories/stock-request.repository';
import { NotificationRepository } from '@/repositories/notification.repository';
import { NotificationService } from '@/services/notification/notification.service';
import { startOfDay, endOfDay, subDays, subMonths } from 'date-fns';

export class AutomationService {
    /**
     * 1. Low Stock Audit - Daily summary of items below min level
     */
    static async runLowStockAudit() {
        console.log('[AUTOMATION] Running Low Stock Audit...');

        // Fetch all stock records with item data
        const allStocks = await InventoryRepository.findManyStocks(
            {},
            {
                item: true,
                store: true
            }
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const criticalItems = allStocks.filter((s: any) => s.item.minLevel > 0 && s.quantity < s.item.minLevel);

        if (criticalItems.length > 0) {
            // Group by store
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const storeGroups = criticalItems.reduce((acc: Record<string, string[]>, curr: any) => {
                if (!acc[curr.store.name]) acc[curr.store.name] = [];
                acc[curr.store.name].push(curr.item.name);
                return acc;
            }, {});

            for (const [storeName, items] of Object.entries(storeGroups)) {
                await NotificationService.notifyByAudience({
                    audience: 'STORES_MANAGERS',
                    title: 'Daily Low Stock Summary',
                    message: `Store "${storeName}" has ${(items as string[]).length} items below minimum level: ${(items as string[]).slice(0, 3).join(', ')}...`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/inventory/stock'
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
        const stalledContractors = await ContractorRepository.count({
            where: {
                status: { in: ['ARM_PENDING', 'OSP_PENDING'] },
                updatedAt: { lt: threshold }
            }
        });

        if (stalledContractors > 0) {
            await NotificationService.notifyByAudience({
                audience: 'PROJECT_MANAGERS',
                title: 'Stalled Contractor Approvals',
                message: `There are ${stalledContractors} contractor registrations pending for more than 24 hours.`,
                type: 'CONTRACTOR',
                priority: 'MEDIUM',
                link: '/contractors/management/approvals'
            });
        }

        // b) Stalled Material Requests
        const stalledRequests = await StockRequestRepository.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: threshold }
            }
        });

        if (stalledRequests.length > 0) {
            await NotificationService.notifyByAudience({
                audience: 'PROJECT_MANAGERS',
                title: 'Stalled Material Requests',
                message: `There are ${stalledRequests.length} material requests awaiting approval for over 24 hours.`,
                type: 'INVENTORY',
                priority: 'HIGH',
                link: '/inventory/requests'
            });
        }

        return { stalledContractors, stalledRequests: stalledRequests.length };
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
            ServiceOrderRepository.count({ where: { sltsStatus: 'COMPLETED', completedDate: { gte: start, lte: end } } }),
            ServiceOrderRepository.count({ where: { sltsStatus: 'RETURN', updatedAt: { gte: start, lte: end } } })
        ]);

        await NotificationService.notifyByAudience({
            audience: 'OFFICE_ADMINS',
            title: 'Daily Operational Summary',
            message: `Performance for today: ${completed} SODs Completed successfully, ${returned} SODs Returned. Check reports for details.`,
            type: 'PROJECT',
            priority: 'MEDIUM',
            link: '/reports/daily-operational'
        });

        return { completed, returned };
    }

    /**
     * 4. Automatic System Cleanup - read notifications older than one month.
     * Audit logs are NOT deleted here: they are immutable (trigger trg_audit_log_immutable) and their retention is
     * AuditRetentionService (24 months, archived to storage first). The former 3-month delete hit the trigger, so the
     * whole DAILY_AUTOMATION job failed every day and this notification cleanup never ran (found by the Redis audit, 27 Nov 2026).
     */
    static async runAuditLogCleanup() {
        console.log('[AUTOMATION] Cleaning up old read notifications...');
        const oneMonthAgo = subMonths(new Date(), 1);

        const notificationResult = await NotificationRepository.deleteMany({
            createdAt: { lt: oneMonthAgo },
            isRead: true
        });

        console.log(`[AUTOMATION] Deleted ${notificationResult.count} read notifications (>1 month).`);
        return { auditLogs: 0, notifications: notificationResult.count };
    }

    /**
     * Master Runner
     */
    static async runAllDailyTasks() {
        const { StatsService } = await import('@/lib/stats.service');
        const results = {
            lowStock: await this.runLowStockAudit(),
            reminders: await this.runPendingApprovalReminder(),
            performance: await this.runDailyPerformanceSummary(),
            stats: await StatsService.globalRecalculate(),
            cleanup: await this.runAuditLogCleanup()
        };
        return results;
    }
}
