import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { createGISRouteSchema, CreateGISRouteSchema } from '@/lib/validations/gis.schema';
import { GISRoute } from '@prisma/client';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

/**
 * GET: List GIS routes for project with poles count
 */
export const GET = apiHandler<unknown[], void>(
    async (_request, params) => {
        const gisRoutes = await GISRouteService.listProjectRoutes(params.id);
        return gisRoutes;
    }, { permissions: [RBAC_PERMISSIONS.PROJECT_READ] }
);

/**
 * POST: Create a GIS route
 */
export const POST = apiHandler<GISRoute, CreateGISRouteSchema>(
    async (_request, params, body) => {
        const userId = params._userId;
        if (!userId) throw AppError.unauthorized('Authentication required');
        const gisRoute = await GISRouteService.createGISRoute(params.id, body, userId);
        return gisRoute;
    },
    { schema: createGISRouteSchema, permissions: [RBAC_PERMISSIONS.PROJECT_WRITE] }
);
