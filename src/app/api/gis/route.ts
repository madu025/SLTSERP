// ============================================================================
// GET /api/gis - List GIS import sessions and status
// GET /api/gis?importId=xxx - Get specific session details
// ============================================================================
import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { GISImportService } from '@/services/gis/GISImportService';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { logger } from '@/lib/logger';
import { safe } from '@/utils/safe-await.util';
import { AppError } from '@/lib/error';
import { assertProjectAccess } from '@/lib/project-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
export const dynamic = 'force-dynamic';
export const GET = apiHandler(async (request, params) => {
  logger.info('[GIS-API] Received GIS status request');
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');
    const projectId = searchParams.get('projectId');
    // Return specific import session
    if (importId) {
      const session = await GISImportService.getSession(importId);
      if (!session) {
        return NextResponse.json(
          { error: `Import session ${importId} not found.` },
          { status: 404 }
        );
      }
      if (session.projectId) {
        await assertProjectAccess(session.projectId, userId);
      } else if (session.createdById !== userId && !params._permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) {
        throw AppError.forbidden('You are not allowed to view this GIS session');
      }
      // Don't expose file content in status response
      const safeSession = {
        id: session.id,
        projectName: session.projectName,
        region: session.region,
        district: session.district,
        createdById: session.createdById,
        status: session.status,
        fileCount: session.files.length,
        qgisProjectPresent: session.qgisProjectPresent ?? false,
        qgisProjectFiles: session.qgisProjectFiles ?? [],
        fileNames: session.files.map((f) => ({
          fileName: f.fileName,
          layerType: f.layerType,
          format: f.detectedFormat,
          size: f.size,
        })),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
      return NextResponse.json({ session: safeSession });
    }
    // Return GIS data for a specific project
    if (projectId) {
      await assertProjectAccess(projectId, userId);
      const [gisErr, data] = await safe(GISRouteService.getProjectGISData(projectId));
      if (gisErr || !data) {
        logger.error('[GIS-API] Status request failed', {
          error: gisErr?.message || 'Failed to retrieve GIS status',
        });
        return NextResponse.json(
          {
            error: 'Failed to retrieve GIS status',
            message: gisErr?.message || 'Internal server error',
          },
          { status: 500 }
        );
      }
      return NextResponse.json(data);
    }
    // List all active sessions
    const canViewAll = params._permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC);
    const sessions = (await GISImportService.listSessions())
      .filter((session) => canViewAll || session.createdById === userId)
      .map((s) => ({
      id: s.id,
      projectName: s.projectName,
      status: s.status,
      fileCount: s.files.length,
      qgisProjectPresent: s.qgisProjectPresent ?? false,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    return NextResponse.json({
      sessions,
      total: sessions.length,
    });
}, { rawResponse: true });
