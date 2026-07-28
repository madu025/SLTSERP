import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { buildGrafanaDashboard } from '@/services/admin/grafana-dashboard';

export const dynamic = 'force-dynamic';

// GET /api/admin/monitoring/dashboard - Download the import-ready Grafana dashboard JSON
export const GET = apiHandler(async () => {
    const dashboard = buildGrafanaDashboard();

    return new Response(JSON.stringify(dashboard, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': 'attachment; filename="sltserp-dashboard.json"',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
}, {
    roles: ROLE_GROUPS.ADMINS,
    rawResponse: true
});
