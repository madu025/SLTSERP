import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CompanyHealthService, type HealthException } from '@/services/core/company-health.service';
import { SodPerformanceService } from '@/services/service-order/sod-performance.service';
import { SOD_TURNAROUND_SLA_DAYS } from '@/lib/constants/sod-constants';
import { getAppBaseUrl } from '@/lib/app-url';
import { NotificationService } from './index';
import { EmailService } from './email.service';
import { NotificationTemplateEngineService } from './template-engine.service';

export const OPS_DIGEST_TEMPLATE_CODE = 'OPS_WEEKLY_DIGEST';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One line per exception, as an HTML list for the email body (values are escaped). */
export function exceptionsHtml(items: Pick<HealthException, 'severity' | 'title' | 'detail' | 'area'>[]): string {
    if (items.length === 0) return '<p style="margin:0;color:#065f46;">No operations or project exceptions this week.</p>';
    return `<ul style="margin:0;padding-left:18px;color:#1e293b;">${items.map((e) =>
        `<li style="margin:0 0 6px;"><strong>${esc(e.title)}</strong> <span style="color:${e.severity === 'critical' ? '#b91c1c' : '#b45309'};">(${esc(e.area)}, ${e.severity})</span><br/><span style="color:#475569;">${esc(e.detail)}</span></li>`).join('')}</ul>`;
}

/**
 * Monday-morning operations digest for the SOD/project management audience: service-level result for the last 30 days,
 * the oldest backlogs, and every operations or project exception, as an in-app notification and an email.
 *
 * Notification only. The audience is capability-backed (SOD_PROJECT), so who receives it is managed in the database.
 */
export class OpsWeeklyDigestService {
    static async run(now: Date = new Date()): Promise<{ exceptions: number; notified: boolean; emailed: number }> {
        const [headline, health] = await Promise.all([
            SodPerformanceService.getHeadline(now),
            CompanyHealthService.getCompanyHealth(Object.values(RBAC_PERMISSIONS), now),
        ]);
        const items = health.exceptions.filter((e) => e.severity !== 'info' && (e.area === 'Operations' || e.area === 'Projects'));
        const week = Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
        const link = '/service-orders/performance';
        const worst = headline.worstRtoms.map((r) => `${r.rtom} (${r.over14} of ${r.open} open > 14 days)`).join(', ') || 'none';
        const slaText = headline.slaPct30d === null ? 'no completed orders' : `${headline.slaPct30d}% within ${SOD_TURNAROUND_SLA_DAYS} days`;
        const summary = `Last 30 days: ${headline.completed30d.toLocaleString('en-US')} orders completed, ${slaText}. Oldest backlogs: ${worst}. ${items.length} operations/project exception(s).`;

        const sent = await NotificationService.notifyByAudience({
            audience: 'SOD_PROJECT', title: '📊 Weekly operations digest', message: summary, type: 'SYSTEM',
            priority: items.some((e) => e.severity === 'critical') ? 'HIGH' : 'MEDIUM', link,
            metadata: { source: 'ops-weekly-digest' }, dedupKey: `ops-weekly-digest:${week}`,
        });

        const recipients = (await NotificationService.getAudienceRecipients({ audience: 'SOD_PROJECT' })).filter((r) => r.email);
        const dashboardUrl = `${getAppBaseUrl()}${link}`;
        let emailed = 0;
        for (const r of recipients) {
            const vars = {
                user: r.email as string,
                weekLabel: now.toISOString().slice(0, 10),
                completed: headline.completed30d.toLocaleString('en-US'),
                slaPct: headline.slaPct30d === null ? 'n/a' : `${headline.slaPct30d}%`,
                slaDays: SOD_TURNAROUND_SLA_DAYS,
                oldestBacklogs: esc(worst),
                exceptions: exceptionsHtml(items),
                dashboardUrl,
            };
            const rendered = await NotificationTemplateEngineService.renderEmailByCode(OPS_DIGEST_TEMPLATE_CODE, vars);
            const subject = rendered?.subject ?? `Weekly operations digest - ${vars.weekLabel}`;
            const html = rendered?.html ?? `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#1e293b;">
                <h2 style="margin:0 0 12px;">Weekly operations digest</h2>
                <p>Dear ${esc(vars.user)},</p>
                <p>Last 30 days: <strong>${vars.completed}</strong> orders completed, <strong>${vars.slaPct}</strong> within the ${vars.slaDays}-day target.<br/>Oldest backlogs: ${vars.oldestBacklogs}</p>
                <h3 style="margin:16px 0 8px;">Needs attention</h3>${vars.exceptions}
                <p style="margin-top:20px;"><a href="${vars.dashboardUrl}" style="background:#1e40af;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;white-space:nowrap;">Open performance view</a></p>
                <p style="font-size:12px;color:#64748b;">SLTS Nexus ERP - Outside Plant Operations</p></body></html>`;
            const text = rendered?.text ?? summary;
            try {
                await EmailService.sendMail({ to: r.email as string, subject, text, html });
                emailed++;
            } catch (error) {
                console.error('[OPS-DIGEST] Email failed:', error instanceof Error ? error.message : error);
            }
        }
        return { exceptions: items.length, notified: !!sent, emailed };
    }
}
