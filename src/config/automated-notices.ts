import type { NotificationAudienceId } from '@/services/notification/notification-audiences';
import type { AccessLevel, MenuModule } from '@/config/menu-access';
import type { NoticeRule } from '@/lib/notice-recipient-rules';

/**
 * The catalogue of what the system sends by itself, for the administrator's page "Automated reports & alerts"
 * (Administration). It says, in plain words, what is sent, when and to whom. Who is in each audience is decided in the database
 * (the capability notification.audience.*), and the administrator changes it on that page.
 *
 * A test keeps this list complete: every audience and every scheduled job that notifies somebody must be described here, so nothing is
 * sent by the system without the administrator being able to see it.
 */
export interface AudienceInfo {
    label: string;
    description: string;
    /** Is a notice to this audience limited to the area (RTOM / OPMC) it is about? Company-wide ones go to everybody in the audience. */
    areaScope: 'area' | 'company' | 'mixed';
}

export const AUDIENCE_INFO: Record<NotificationAudienceId, AudienceInfo> = {
    ADMINISTRATORS: { label: 'Management alerts', description: 'Company-health alerts, escalations of very late approvals, system and security notices.', areaScope: 'company' },
    PROJECT_MANAGERS: { label: 'Project managers', description: 'Project approvals, deadlines, invoices and task plans. Some notices name the project area, some go company-wide.', areaScope: 'mixed' },
    STORES_MANAGERS: { label: 'Stores managers', description: 'Stock, returns and store notices.', areaScope: 'company' },
    OFFICE_ADMINS: { label: 'Office administration', description: 'Notices for the office and site office administration.', areaScope: 'company' },
    OPERATIONS: { label: 'Operations (service orders)', description: 'Service-order operations notices for the area they are about.', areaScope: 'area' },
    SOD_PROJECT: { label: 'Service order and project notices', description: 'Ordinary service-order notices for the area they are about (the weekly digest has its own audience).', areaScope: 'area' },
    OPS_DIGEST: { label: 'Weekly operations digest (not used)', description: 'Replaced by the recipient rule of the Weekly operations digest report (module, job level, area). No report sends to this audience any more.', areaScope: 'company' },
    FINANCE_APPROVERS: { label: 'Finance approvers', description: 'Payments and Head Office requests waiting for a finance approval.', areaScope: 'company' },
    FINANCE_ALL: { label: 'Finance team', description: 'General finance notices.', areaScope: 'company' },
    INVENTORY_LOW_STOCK: { label: 'Low stock (in-app)', description: 'Items below the reorder level.', areaScope: 'company' },
    INVENTORY_ALERT_EMAIL: { label: 'Inventory alerts (email)', description: 'The same stock alerts by email.', areaScope: 'company' },
    STOCK_REQUEST_ARM: { label: 'Stock requests: Area Manager step', description: 'Stock requests waiting for the Area Manager.', areaScope: 'area' },
    STOCK_REQUEST_PROCUREMENT: { label: 'Stock requests: procurement step', description: 'Stock requests that need a purchase.', areaScope: 'company' },
    HELPDESK_TICKET_MANAGERS: { label: 'Help desk: new tickets', description: 'Every new IT help desk ticket. Meant for the IT staff who work the queue.', areaScope: 'company' },
    PROCESS_GATE_OSP_MANAGER: { label: 'Approval step: OSP Manager', description: 'Items waiting at the OSP Manager step of an approval chain.', areaScope: 'company' },
    PROCESS_GATE_HEAD_OF_SECTION: { label: 'Approval step: Head of Section', description: 'Items waiting at the Head of Section step of an approval chain.', areaScope: 'company' },
    PROCESS_GATE_PROCUREMENT: { label: 'Approval step: Procurement', description: 'Items waiting at the Procurement step of an approval chain.', areaScope: 'company' },
    PROCESS_GATE_STORES: { label: 'Approval step: Stores', description: 'Items waiting at the Stores step of an approval chain.', areaScope: 'company' },
};

export interface ScheduledNotice {
    /** The name of the scheduled job (sod.sync.service TICK_DAILY_JOBS). */
    job: string;
    title: string;
    description: string;
    schedule: string;
    channels: Array<'in-app' | 'email'>;
    /** The audiences it goes to, or null when it goes to the people named by the data itself (the owner, the assignee). Not used by a report with a rule. */
    audiences: NotificationAudienceId[] | null;
    /** The default recipient rule: the module the report belongs to, the lowest job level that receives it, and the area. The administrator changes it on the page. */
    rule?: NoticeRule;
    to: string;
}

export const SCHEDULED_NOTICES: readonly ScheduledNotice[] = [
    { job: 'ops-weekly-digest', title: 'Weekly operations digest', description: 'Service-level result of the last 30 days, the oldest backlogs and every operations or project exception, company-wide.', schedule: 'Every Monday 07:50', channels: ['in-app', 'email'], audiences: null, rule: { module: 'REPORTS', minLevel: 'company', area: 'company' }, to: 'People with the company-wide reports level' },
    { job: 'management-alerts', title: 'Management alerts', description: 'Company-health exceptions (expired insurance, SLA breaches, stale stock requests).', schedule: 'Every day 07:45', channels: ['in-app'], audiences: null, rule: { module: 'REPORTS', minLevel: 'company', area: 'company' }, to: 'People with the company-wide reports level' },
    { job: 'supply-chain-alerts', title: 'Low stock per store', description: 'Which stores are below reorder level (weekly per store).', schedule: 'Every day 07:35', channels: ['in-app'], audiences: null, to: 'The managers of each store' },
    { job: 'approval-sla', title: 'Approvals past their target time', description: 'A reminder to the approver, and an escalation of the very late ones.', schedule: 'Every day 07:38', channels: ['in-app'], audiences: null, rule: { module: 'REPORTS', minLevel: 'company', area: 'company' }, to: 'The assigned approver; the very late ones also to the people with the company-wide reports level' },
    { job: 'project-reminders', title: 'Project reminders', description: 'Task due, overdue invoices, permit expiry, end of the defects period, approvals waiting too long.', schedule: 'Every day 07:30', channels: ['in-app'], audiences: null, rule: { module: 'PROJECTS', minLevel: 'operate', area: 'area' }, to: 'The project owner; when there is none, the people who work on projects in that area' },
    { job: 'daily-automation', title: 'Daily automation notices', description: 'Daily checks on projects, stores and offices.', schedule: 'Every day 06:30', channels: ['in-app'], audiences: ['PROJECT_MANAGERS', 'STORES_MANAGERS', 'OFFICE_ADMINS'], to: 'Project managers, stores managers, office administration' },
    { job: 'appointment-reminders', title: 'Appointment reminders', description: 'Reminders of the appointments of the day.', schedule: 'Every day 05:45', channels: ['in-app'], audiences: null, to: 'The people the appointments are assigned to' },
];

/** Scheduled jobs that notify nobody (data jobs); listed so the completeness test knows they were looked at. */
export const SCHEDULED_JOBS_WITHOUT_NOTICE: readonly string[] = ['daily-report-snapshot', 'evm-snapshot', 'rop-recalc', 'notification-cleanup'];

/** The default rule of every report that has one, by job name. */
export const RULE_BASED_NOTICES: Readonly<Record<string, NoticeRule>> = Object.fromEntries(SCHEDULED_NOTICES.filter((n) => n.rule).map((n) => [n.job, n.rule as NoticeRule]));

/** Plain words for the module and job level choices on the page. */
export const MODULE_LABELS: Readonly<Record<MenuModule, string>> = {
    SOD: 'Service Orders', INVENTORY: 'Inventory and stores', PROJECTS: 'Projects', REPORTS: 'Reports', ITMS: 'IT help desk', FLEET: 'Vehicles and fleet',
};
export const LEVEL_LABELS: Readonly<Record<AccessLevel, string>> = {
    view: 'Can look', operate: 'Works in it', invoice: 'Works in it and invoices', approve: 'Approves', admin: 'Administers', area: 'Reports of own areas', company: 'Reports of the whole company',
};
