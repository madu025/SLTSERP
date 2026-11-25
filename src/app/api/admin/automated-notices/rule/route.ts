import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { NoticeRulesService } from '@/services/notification/notice-rules.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    job: z.string().min(1).max(60),
    module: z.string().min(1).max(20),
    minLevel: z.string().min(1).max(20),
    area: z.string().min(1).max(20),
});

// POST /api/admin/automated-notices/rule - set the recipient rule of a report: the module, the lowest job level that receives it, the area (audited)
export const POST = apiHandler(async (_req, params, body) => NoticeRulesService.setRule(params._userId ?? '', body.job, { module: body.module, minLevel: body.minLevel, area: body.area }), {
    schema: bodySchema,
    permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
});

// GET /api/admin/automated-notices/rule?job=... - the people the rule of a report reaches (flagged when they have no area)
export const GET = apiHandler(async (req) => NoticeRulesService.people(new URL(req.url).searchParams.get('job') ?? ''), {
    permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
});
