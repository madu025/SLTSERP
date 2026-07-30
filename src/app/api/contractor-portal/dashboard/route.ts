import { apiHandler } from '@/lib/api-handler';
import { verifyJWT } from '@/lib/auth';
import { ContractorDashboardService } from '@/services/contractor-portal/dashboard.service';
import { safe } from "@/utils/safe-await.util";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    // Extract token from cookie or Authorization header
    const cookieHeader = req.headers.get('cookie') || '';
    const authHeader = req.headers.get('authorization') || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        const match = cookieHeader.match(/token=([^;]+)/);
        if (match) token = match[1];
    }

    let contractorId = req.headers.get('x-contractor-id') || undefined;

    if (token) {
        const [err, payload] = await safe(verifyJWT(token));
        if (err) {
            console.warn(`[ContractorDashboard] JWT verification failed:`, err.message);
        } else if (payload && payload.contractorId) {
            contractorId = payload.contractorId as string;
        }
    }

    const dashboardData = await ContractorDashboardService.getDashboardData(contractorId);
    return dashboardData;
});
