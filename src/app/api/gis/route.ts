// ============================================================================
// GET /api/gis - List GIS import sessions and status
// GET /api/gis?importId=xxx - Get specific session details
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GISImportService } from '@/services/gis/GISImportService';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { logger } from '@/lib/logger';
import { safe } from '@/utils/safe-await.util';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  logger.info('[GIS-API] Received GIS status request');
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');
    const projectId = searchParams.get('projectId');

    // Return specific import session
    if (importId) {
      const session = GISImportService.getSession(importId);
      if (!session) {
        return NextResponse.json(
          { error: `Import session ${importId} not found.` },
          { status: 404 }
        );
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
    const sessions = GISImportService.listSessions().map((s) => ({
      id: s.id,
      projectName: s.projectName,
      status: s.status,
      fileCount: s.files.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json({
      sessions,
      total: sessions.length,
    });
}
