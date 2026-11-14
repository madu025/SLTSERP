import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { AccessRiskService } from '@/services/control/access-risk.service';
import { SodBreachService } from '@/services/control/sod-breach.service';
import { ApprovalAgeingService } from '@/services/control/approval-ageing.service';
import { FinanceControlsService } from '@/services/control/finance-controls.service';
import { AuditActivityService } from '@/services/control/audit-activity.service';

export const dynamic = 'force-dynamic';

const VIEWS = ['access', 'breaches', 'approvals', 'finance', 'audit'] as const;
type View = (typeof VIEWS)[number];

// GET /api/admin/control?view=access|breaches|approvals|finance|audit&days=30
// Control monitor. Company-wide only. Access, breaches and audit views need admin.rbac; approvals and finance
// controls are also open to finance auditors (finance.audit).
export const GET = apiHandler(async (req, params) => {
    if (await resolveOpmcScope(params._userId) !== undefined) throw AppError.forbidden('The control monitor requires company-wide access');
    const sp = new URL(req.url).searchParams;
    const view = sp.get('view') as View | null;
    if (!view || !VIEWS.includes(view)) throw AppError.badRequest(`view must be one of ${VIEWS.join(', ')}`);
    const days = Math.min(180, Math.max(1, Number(sp.get('days') ?? 30) || 30));

    const perms = params._permissions ?? [];
    const isAdmin = perms.includes(RBAC_PERMISSIONS.ADMIN_RBAC);
    if (!isAdmin && (view === 'access' || view === 'breaches' || view === 'audit')) throw AppError.forbidden('This view needs administrator access');

    switch (view) {
        case 'access': return AccessRiskService.getReport();
        case 'breaches': return SodBreachService.getReport(days);
        case 'approvals': return ApprovalAgeingService.getReport();
        case 'finance': return FinanceControlsService.getReport(days);
        case 'audit': return AuditActivityService.getReport(days);
    }
}, { permissions: [RBAC_PERMISSIONS.ADMIN_RBAC, RBAC_PERMISSIONS.FINANCE_AUDIT] });
