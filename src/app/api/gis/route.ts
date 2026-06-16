// ============================================================================
// GET /api/gis - List GIS import sessions and status
// GET /api/gis?importId=xxx - Get specific session details
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GISImportService } from '@/services/GISImportService';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  logger.info('[GIS-API] Received GIS status request');

  try {
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
      const gisRoutes = await prisma.gISRoute.findMany({
        where: { projectId },
        include: {
          poles: true,
          closures: true,
          cableSegments: true,
          generatedBOQs: {
            include: { items: true },
          },
        },
      });

      const assets = await prisma.projectAsset.findMany({
        where: { projectId },
      });

      const surveys = await prisma.surveyRequest.findMany({
        where: { projectId },
        include: {
          checkins: true,
          findings: true,
        },
      });

      const permits = await prisma.projectPermit.findMany({
        where: { projectId },
        include: {
          permitType: {
            include: { authority: true },
          },
        },
      });

      const fieldTasks = await prisma.fieldTask.findMany({
        where: { projectId },
      });

      const otdrTests = await prisma.oTDRTest.findMany({
        where: { projectId },
      });

      return NextResponse.json({
        projectId,
        gisRoutes,
        assets,
        surveys,
        permits,
        fieldTasks,
        otdrTests,
      });
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
  } catch (err: any) {
    logger.error('[GIS-API] Status request failed', {
      error: err.message,
    });

    return NextResponse.json(
      {
        error: 'Failed to retrieve GIS status',
        message: err.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
