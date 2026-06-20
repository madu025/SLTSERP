import { NextResponse } from 'next/server';
import { QFieldCloudSyncService } from '@/services/qfieldcloud-sync.service';
import { SURVEY_LAYERS } from '@/config/survey-layers';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/qfield-sync - Get sync history and status
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [syncHistory, lastSync, surveyStats] = await Promise.all([
      QFieldCloudSyncService.getSyncHistory(projectId),
      prisma.qFieldCloudSyncLog.findFirst({
        where: { projectId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true, featuresCount: true, syncType: true },
      }),
      prisma.surveyPoint.groupBy({
        by: ['layerId', 'verificationStatus'],
        where: { projectId },
        _count: { id: true },
      }),
    ]);

    // Aggregate survey stats by layer
    const layerStats = SURVEY_LAYERS.map((layer) => {
      const layerPoints = surveyStats.filter((s) => s.layerId === layer.id);
      const total = layerPoints.reduce((sum, s) => sum + s._count.id, 0);
      const pending = layerPoints
        .filter((s) => s.verificationStatus === 'PENDING_VERIFICATION')
        .reduce((sum, s) => sum + s._count.id, 0);
      const verified = layerPoints
        .filter((s) => s.verificationStatus === 'VERIFIED')
        .reduce((sum, s) => sum + s._count.id, 0);
      const approved = layerPoints
        .filter((s) => s.verificationStatus === 'APPROVED')
        .reduce((sum, s) => sum + s._count.id, 0);

      return {
        layerId: layer.id,
        label: layer.label,
        icon: layer.icon,
        color: layer.color,
        total,
        pending,
        verified,
        approved,
      };
    });

    const totalPending = layerStats.reduce((sum, l) => sum + l.pending, 0);
    const totalApproved = layerStats.reduce((sum, l) => sum + l.approved, 0);
    const totalPoints = layerStats.reduce((sum, l) => sum + l.total, 0);

    // Get active sessions
    const activeSessions = await prisma.mobileSurveySession.findMany({
      where: { projectId, status: 'IN_PROGRESS' },
      select: {
        id: true,
        supervisorId: true,
        startedAt: true,
        pointsCount: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json({
      projectId,
      surveyLayers: layerStats,
      summary: {
        totalPoints,
        totalPending,
        totalApproved,
        activeSessions: activeSessions.length,
        lastSync: lastSync?.completedAt || null,
        lastSyncFeatures: lastSync?.featuresCount || 0,
      },
      activeSessions,
      syncHistory,
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
  }
}

// POST /api/projects/[id]/qfield-sync - Trigger full sync with QFieldCloud
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, qfieldProjectId } = body;

    if (!qfieldProjectId) {
      return NextResponse.json(
        { error: 'qfieldProjectId is required. Create a QFieldCloud project first.' },
        { status: 400 }
      );
    }

    // ── Action: FULL SYNC ────────────────────────────────────────────────
    if (action === 'full_sync' || !action) {
      const result = await QFieldCloudSyncService.fullSync(projectId, qfieldProjectId);

      return NextResponse.json({
        message: 'Full sync completed',
        result,
        surveyLayers: SURVEY_LAYERS,
      });
    }

    // ── Action: PUSH LAYERS ──────────────────────────────────────────────
    if (action === 'push_layers') {
      const service = new QFieldCloudSyncService();
      await service.pushSurveyLayers(qfieldProjectId);

      return NextResponse.json({
        message: 'Survey layers pushed to QFieldCloud',
        layersCount: SURVEY_LAYERS.length,
      });
    }

    // ── Action: CREATE PROJECT ───────────────────────────────────────────
    if (action === 'create_project') {
      const service = new QFieldCloudSyncService();
      const template = body.qgisTemplate || 'QGIS Project Template/QGIS.qgz';
      const qfieldProject = await service.createQFieldProject(projectId, template);

      // Push layers after project creation
      await service.pushSurveyLayers(qfieldProject.id);

      // Store QFieldCloud project reference — merge with existing gisMapping to preserve material mappings
      const existingProject = await prisma.project.findUnique({
        where: { id: projectId },
        select: { gisMapping: true },
      });
      const existingGisMapping = (existingProject?.gisMapping as Record<string, unknown> | null) || {};
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gisMapping: { ...existingGisMapping, qfieldProjectId: qfieldProject.id },
        },
      });

      return NextResponse.json(
        {
          message: 'QFieldCloud project created with 12 survey layers',
          qfieldProject,
          layersCount: SURVEY_LAYERS.length,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: create_project, push_layers, full_sync' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QFieldCloud sync failed';
    console.error('QFieldCloud sync error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}