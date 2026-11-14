import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { GisOpsOverlayService } from '@/services/gis/GisOpsOverlayService';

export const dynamic = 'force-dynamic';

// GET /api/gis/ops-overlay
// Troubled-project pins (late, over budget, low SPI) and approximate RTOM backlog circles for the national map.
// Projects are limited to the caller's OPMC scope; backlog circles need SOD read access.
export const GET = apiHandler(async (_req, params) => {
    const canSeeBacklog = (params._permissions ?? []).includes(RBAC_PERMISSIONS.SOD_READ);
    return GisOpsOverlayService.getOverlay(params._userId, canSeeBacklog);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ] });
