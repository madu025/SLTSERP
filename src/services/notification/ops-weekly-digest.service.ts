import { prisma } from '@/lib/prisma';
import { CompanyHealthService, type HealthException } from '@/services/core/company-health.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SodPerformanceService } from '@/services/service-order/sod-performance.service';
import { SOD_TURNAROUND_SLA_DAYS } from '@/lib/constants/sod-constants';
import { getAppBaseUrl } from '@/lib/app-url';
import { LEVEL_LABELS, MODULE_LABELS } from '@/config/automated-notices';
import { buildOpsDigestDocument, buildOpsDigestReport, buildOpsDigestText, type DigestEmailInput } from '@/lib/ops-digest-email';
import { EmailService } from './email.service';
import { NoticeRulesService } from './notice-rules.service';
import { NotificationTemplateEngineService } from './template-engine.service';

export const OPS_DIGEST_TEMPLATE_CODE = 'OPS_WEEKLY_DIGEST';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One line per exception, as an HTML list (values are escaped). Kept for the stored template's {{exceptions}} placeholder. */
export function exceptionsHtml(items: Pick<HealthException, 'severity' | 'title' | 'detail' | 'area'>[]): string {
    if (items.length === 0) return '<p style="margin:0;color:#065f46;">No operations or project exceptions this week.</p>';
    return `<ul style="margin:0;padding-left:18px;color:#1e293b;">${items.map((e) =>
        `<li style="margin:0 0 6px;"><strong>${esc(e.title)}</strong> <span style="color:${e.severity === 'critical' ? '#b91c1c' : '#b45309'};">(${esc(e.area)}, ${e.severity})</span><br/><span style="color:#475569;">${esc(e.detail)}</span></li>`).join('')}</ul>`;
}

/**
 * Monday-morning operations digest: service-level result for the last 30 days with charts (turnaround by week, age of the open orders,
 * the RTOMs with the largest backlog, the last 7 days) and every operations or project exception, as an in-app notification and an email.
 * The email is drawn with HTML tables (src/lib/ops-digest-email.ts) so it needs no images.
 *
 * Notification only. Who receives it is a rule (module, job level, area) kept in the system settings and changed by the administrator on the page
 * "Automated reports and alerts": by default the people with the company-wide reports level, since the figures are company-wide.
 */
export class OpsWeeklyDigestService {
    static async run(now: Date = new Date()): Promise<{ exceptions: number; notified: boolean; emailed: number }> {
        const [headline, health, data] = await Promise.all([
            SodPerformanceService.getHeadline(now),
            CompanyHealthService.getCompanyHealth(Object.values(RBAC_PERMISSIONS), now),
            SodPerformanceService.getDigestData(now),
        ]);
        const items = health.exceptions.filter((e) => e.severity !== 'info' && (e.area === 'Operations' || e.area === 'Projects'));
        const week = Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
        const link = '/service-orders/performance';
        const worst = headline.worstRtoms.map((r) => `${r.rtom} (${r.over14} of ${r.open} open > 14 days)`).join(', ') || 'none';
        const slaText = headline.slaPct30d === null ? 'no completed orders' : `${headline.slaPct30d}% within ${SOD_TURNAROUND_SLA_DAYS} days`;
        const summary = `Last 30 days: ${headline.completed30d.toLocaleString('en-US')} orders completed, ${slaText}. Oldest backlogs: ${worst}. ${items.length} operations/project exception(s).`;

        const sent = await NoticeRulesService.notify('ops-weekly-digest', {
            title: '📊 Weekly operations digest', message: summary, type: 'SYSTEM',
            priority: items.some((e) => e.severity === 'critical') ? 'HIGH' : 'MEDIUM', link,
            metadata: { source: 'ops-weekly-digest' }, dedupKey: `ops-weekly-digest:${week}`,
        });

        const recipients = (await NoticeRulesService.resolve('ops-weekly-digest')).filter((r) => r.email);
        const dashboardUrl = `${getAppBaseUrl()}${link}`;
        const rule = (await NoticeRulesService.getRules())['ops-weekly-digest'];
        const reason = rule
            ? `You receive this because you work in ${MODULE_LABELS[rule.module]} at the level "${LEVEL_LABELS[rule.minLevel]}" or above. Administration, Automated Reports & Alerts shows and changes who receives it.`
            : 'Administration, Automated Reports & Alerts shows and changes who receives this digest.';
        // A stored template (admin-editable) is used only when it carries the report ({{reportHtml}}); an older stored design would hide the charts
        const stored = await prisma.notificationTemplate.findUnique({ where: { code: OPS_DIGEST_TEMPLATE_CODE, isActive: true }, select: { htmlBody: true } }).catch(() => null);
        const storedHasReport = !!stored?.htmlBody?.includes('{{reportHtml}}');
        const weekLabel = now.toISOString().slice(0, 10);
        let emailed = 0;
        for (const r of recipients) {
            const input: DigestEmailInput = {
                user: r.name || (r.email as string), weekLabel, dashboardUrl, slaDays: SOD_TURNAROUND_SLA_DAYS, reason,
                completed30d: headline.completed30d, slaPct30d: headline.slaPct30d,
                weeks: data.weeks, ageing: data.ageing, openTotal: data.openTotal, rtoms: data.rtoms, received7d: data.received7d, completed7d: data.completed7d,
                exceptions: items.map((e) => ({ severity: e.severity, title: e.title, detail: e.detail, area: e.area })),
            };
            const reportHtml = buildOpsDigestReport(input);
            const vars = {
                user: input.user, weekLabel, completed: headline.completed30d.toLocaleString('en-US'),
                slaPct: headline.slaPct30d === null ? 'n/a' : `${headline.slaPct30d}%`, slaDays: SOD_TURNAROUND_SLA_DAYS,
                oldestBacklogs: esc(worst), exceptions: exceptionsHtml(items), dashboardUrl, reportHtml, reason: esc(reason),
            };
            const rendered = storedHasReport ? await NotificationTemplateEngineService.renderEmailByCode(OPS_DIGEST_TEMPLATE_CODE, vars) : null;
            const subject = rendered?.subject ?? `Weekly operations digest - ${weekLabel}`;
            const html = rendered?.html ?? buildOpsDigestDocument(input, reportHtml);
            const text = buildOpsDigestText(input);
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
