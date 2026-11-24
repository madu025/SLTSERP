import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { listSiteOffices } from '@/lib/site-office-access';

export const dynamic = 'force-dynamic';

// GET /api/finance/site-offices: the site offices the caller may keep petty cash, floats and IOUs for (finance data scope)
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return { data: await listSiteOffices(params._userId) };
}, {});
