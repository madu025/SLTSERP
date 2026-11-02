export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { SOCAnalystService } from '@/services/admin/soc-analyst.service';

export const GET = apiHandler(
    async () => {
        const report = await SOCAnalystService.generateSecurityReport();
        return report;
    },
    {
        audit: {
            action: 'SOC_ANALYST_SECURITY_REPORT',
            entity: 'SystemSecurity'
        }
    }
);
