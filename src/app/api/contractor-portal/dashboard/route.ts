import { apiHandler } from '@/lib/api-handler';
import { verifyJWT } from '@/lib/auth';
import { ContractorDashboardService } from '@/services/contractor-portal/dashboard.service';

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
        try {
            const payload = await verifyJWT(token);
            if (payload && payload.contractorId) {
                contractorId = payload.contractorId as string;
            }
        } catch {
            // Ignore JWT verify errors
        }
    }

    try {
        const dashboardData = await ContractorDashboardService.getDashboardData(contractorId);
        return Response.json({
            success: true,
            data: dashboardData
        });
    } catch (error: any) {
        return Response.json({
            success: false,
            message: error.message || 'Failed to fetch dashboard data'
        }, { status: 404 });
    }
});
