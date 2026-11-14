import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CompanyHealthService, type HealthException } from '@/services/core/company-health.service';
import { NotificationService } from './index';

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Daily management alert pass: the same exceptions the dashboard's "Company health" tab lists
 * (loss-making month, negative cash, aged receivables, aged service orders, projects over budget,
 * expired insurance, SLA breaches, stale stock requests) pushed to the management audience, so
 * problems are found without anyone opening a page.
 *
 * Notification only: it never changes business data. One row per recipient per exception per day
 * (dedupKey), so a re-run, or a worker catching up after downtime, does not spam.
 */
export class ManagementAlertService {
    static async run(now: Date = new Date()): Promise<{ processed: number; notified: number }> {
        // The audience (ADMINISTRATORS) is a management-level, DB-configurable capability group, so the
        // digest covers every module, exactly like the company-wide dashboard tab.
        const health = await CompanyHealthService.getCompanyHealth(Object.values(RBAC_PERMISSIONS), now);
        const actionable = health.exceptions.filter((e: HealthException) => e.severity !== 'info');

        let notified = 0;
        for (const e of actionable) {
            const result = await NotificationService.notifyByAudience({
                audience: 'ADMINISTRATORS',
                title: `${e.severity === 'critical' ? '⛔' : '⚠️'} ${e.title}`,
                message: `${e.detail} (${e.area}). Open the Company health tab for the full picture.`,
                type: 'SYSTEM',
                priority: e.severity === 'critical' ? 'HIGH' : 'MEDIUM',
                link: e.href,
                metadata: { source: 'management-alerts', exceptionId: e.id, area: e.area },
                dedupKey: `management-alert:${e.id}:${day(now)}`,
            });
            if (result) notified++;
        }
        return { processed: actionable.length, notified };
    }
}
