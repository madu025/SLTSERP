import { apiHandler } from '@/lib/api-handler';
import { ArApService } from '@/services/finance/ar-ap.service';
import { ROLE_GROUPS } from "@/config/roles";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const report = await ArApService.getArAgingReport();
    return report;
}, {
    roles: ROLE_GROUPS.FINANCE_ALL
});
