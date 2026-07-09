import { prisma } from '@/lib/prisma';
import { SURVEY_LAYERS } from '@/config/survey-layers';
import { updateProgressOnBOQGenerate } from '@/lib/project-progress';

interface CreateSurveyPointInput {
  projectId: string;
  sessionId: string;
  layerId: string;
  layerName?: string;
  latitude: number;
  longitude: number;
  attributes?: Record<string, unknown>;
  photoUrls?: string[];
  supervisorId: string;
}

interface CreateSurveyRequestInput {
  title: string;
  description?: string;
  surveyType: string;
  priority?: string;
  assignedTeamId?: string;
  assignedToId?: string;
  scheduledDate?: string | Date;
  estimatedBOQ?: string | number;
  createdById: string;
}

export class ProjectSurveyService {
  /**
   * Create a new survey point
   */
  static async createSurveyPoint(data: CreateSurveyPointInput) {
    const { projectId, sessionId, layerId, layerName, latitude, longitude, attributes, photoUrls, supervisorId } = data;

    return prisma.surveyPoint.create({
      data: {
        sessionId,
        projectId,
        layerId,
        layerName: layerName || layerId,
        latitude,
        longitude,
        attributes: attributes || {},
        photoUrls: photoUrls || [],
        supervisorId,
      },
    });
  }

  /**
   * Get all mobile survey sessions for a project
   */
  static async getSessions(projectId: string, filters: { status?: string | null; supervisorId?: string | null }) {
    const { status, supervisorId } = filters;

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;
    if (supervisorId) where.supervisorId = supervisorId;

    return prisma.mobileSurveySession.findMany({
      where,
      include: {
        _count: { select: { surveyPoints: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Start new or continue an existing session
   */
  static async startOrContinueSession(
    projectId: string,
    userId: string,
    action: 'start' | 'continue',
    sessionId?: string,
    notes?: string
  ) {
    // ── Action: START new session ──────────────────────────────────────
    if (action === 'start') {
      // Check supervisor is assigned to this project
      const assignment = await prisma.projectSupervisorAssignment.findFirst({
        where: { projectId, supervisorId: userId, status: 'ASSIGNED' },
      });
      if (!assignment) {
        throw new Error('SUPERVISOR_NOT_ASSIGNED');
      }

      // Check for existing in-progress session
      const existingSession = await prisma.mobileSurveySession.findFirst({
        where: { projectId, supervisorId: userId, status: 'IN_PROGRESS' },
      });

      if (existingSession) {
        return {
          message: 'Active session found. Use action=continue to resume.',
          session: existingSession,
          action: 'continue_existing',
        };
      }

      const session = await prisma.mobileSurveySession.create({
        data: {
          projectId,
          supervisorId: userId,
          status: 'IN_PROGRESS',
          notes,
        },
      });

      // Update project status to SURVEY_IN_PROGRESS if needed
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { status: true },
      });

      if (project?.status === 'PLANNING' || project?.status === 'SURVEY_IN_PROGRESS') {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: 'SURVEY_IN_PROGRESS' },
        });
      }

      return { session, surveyLayers: SURVEY_LAYERS, action: 'started' };
    }

    // ── Action: CONTINUE existing session ──────────────────────────────
    if (action === 'continue') {
      if (!sessionId) {
        throw new Error('SESSION_ID_REQUIRED');
      }

      const session = await prisma.mobileSurveySession.findFirst({
        where: { id: sessionId, projectId, supervisorId: userId },
        include: { _count: { select: { surveyPoints: true } } },
      });

      if (!session) {
        throw new Error('SESSION_NOT_FOUND_OR_UNAUTHORIZED');
      }

      if (session.status === 'COMPLETED') {
        throw new Error('SESSION_ALREADY_COMPLETED');
      }

      if (session.status === 'ABANDONED') {
        throw new Error('SESSION_ABANDONED');
      }

      // Re-activate if paused
      await prisma.mobileSurveySession.update({
        where: { id: sessionId },
        data: {
          status: 'IN_PROGRESS',
          updatedAt: new Date(),
        },
      });

      // Get previously marked points for reference
      const previousPoints = await prisma.surveyPoint.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          layerId: true,
          latitude: true,
          longitude: true,
          attributes: true,
          createdAt: true,
        },
      });

      return {
        session: { ...session, status: 'IN_PROGRESS' },
        previousPoints,
        surveyLayers: SURVEY_LAYERS,
        action: 'continued',
      };
    }

    throw new Error('INVALID_ACTION');
  }

  /**
   * Update mobile survey session status (Complete / Abandon)
   */
  static async updateSessionStatus(
    projectId: string,
    userId: string,
    sessionId: string,
    action: 'complete' | 'abandon',
    notes?: string
  ) {
    const session = await prisma.mobileSurveySession.findFirst({
      where: { id: sessionId, projectId, supervisorId: userId },
      include: { _count: { select: { surveyPoints: true } } },
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND_OR_UNAUTHORIZED');
    }

    if (action === 'complete') {
      const updated = await prisma.mobileSurveySession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          pointsCount: session._count.surveyPoints,
          notes: notes || session.notes,
        },
      });

      // Check if all assigned sessions are complete
      const incompleteSessions = await prisma.mobileSurveySession.count({
        where: { projectId, status: 'IN_PROGRESS' },
      });

      if (incompleteSessions === 0) {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: 'SURVEY_COMPLETE' },
        });
      }

      return { session: updated, action: 'completed' };
    }

    if (action === 'abandon') {
      const updated = await prisma.mobileSurveySession.update({
        where: { id: sessionId },
        data: {
          status: 'ABANDONED',
          notes: notes || 'Abandoned by supervisor',
          updatedAt: new Date(),
        },
      });

      return { session: updated, action: 'abandoned' };
    }

    throw new Error('INVALID_ACTION');
  }

  /**
   * Complete survey and auto-generate draft BOQ from GIS data
   */
  static async completeSurveyAndGenerateBOQ(projectId: string, input: { createdById?: string }) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        gisRoutes: { include: { poles: true, chambers: true, closures: true, cableSegments: true } },
        job: true
      }
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const routes = project.gisRoutes.filter(r => r.status !== 'BOQ_GENERATED');
    if (routes.length === 0) {
      return { message: 'No routes need BOQ', projectId };
    }

    const results = [];
    let totalBOQItems = 0;

    for (const gisRoute of routes) {
      const poleCount = gisRoute.poles.length;
      const chamberCount = gisRoute.chambers.length;
      const closureCount = gisRoute.closures.length;
      const totalCableLength = gisRoute.cableSegments.reduce((sum, seg) => sum + (seg.length || 0), 0);

      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          OR: [
            { name: { contains: 'Pole', mode: 'insensitive' } },
            { name: { contains: 'Fiber', mode: 'insensitive' } },
            { name: { contains: 'Cable', mode: 'insensitive' } },
            { name: { contains: 'Chamber', mode: 'insensitive' } },
            { name: { contains: 'Closure', mode: 'insensitive' } },
            { name: { contains: 'Splice', mode: 'insensitive' } }
          ]
        },
        take: 50
      });

      const findRate = (keywords: string[]): number => {
        const m = inventoryItems.find(i => keywords.some(k => i.name?.toLowerCase().includes(k.toLowerCase())));
        return m?.unitPrice ? Number(m.unitPrice) : 0;
      };

      const items = [];

      if (poleCount > 0) {
        const r = findRate(['pole', 'wooden', 'concrete']);
        items.push({
          itemCategory: 'POLE',
          itemCode: 'POLE-001',
          description: 'Fiber Optic Pole',
          unit: 'Nos',
          quantity: poleCount,
          unitRate: r,
          amount: poleCount * r,
          sourceType: 'AUTO_CALCULATED',
          sourceReference: `GIS survey: ${poleCount} poles`
        });
      }

      if (chamberCount > 0) {
        const r = findRate(['chamber', 'manhole']);
        items.push({
          itemCategory: 'CHAMBER',
          itemCode: 'CHMB-001',
          description: 'Fiber Optic Chamber',
          unit: 'Nos',
          quantity: chamberCount,
          unitRate: r,
          amount: chamberCount * r,
          sourceType: 'AUTO_CALCULATED',
          sourceReference: `GIS survey: ${chamberCount} chambers`
        });
      }

      if (closureCount > 0) {
        const r = findRate(['closure', 'splice']);
        items.push({
          itemCategory: 'CLOSURE',
          itemCode: 'CLSR-001',
          description: 'Fiber Splice Closure',
          unit: 'Nos',
          quantity: closureCount,
          unitRate: r,
          amount: closureCount * r,
          sourceType: 'AUTO_CALCULATED',
          sourceReference: `GIS survey: ${closureCount} closures`
        });
      }

      if (gisRoute.cableSegments.length > 0) {
        const r = findRate(['fiber', 'cable']);
        items.push({
          itemCategory: 'CABLE',
          itemCode: 'CBL-001',
          description: 'Fiber Optic Cable',
          unit: 'Meters',
          quantity: totalCableLength,
          unitRate: r,
          amount: totalCableLength * r,
          sourceType: 'AUTO_CALCULATED',
          sourceReference: `GIS survey: ${gisRoute.cableSegments.length} segments, ${totalCableLength.toFixed(1)}m`
        });
      }

      if (items.length === 0) {
        results.push({ routeId: gisRoute.id, message: 'No data' });
        continue;
      }

      const totalEstimated = items.reduce((s, i) => s + i.amount, 0);

      await prisma.gISGeneratedBOQ.create({
        data: {
          routeId: gisRoute.id,
          projectId,
          status: 'DRAFT',
          totalEstimated,
          notes: 'Auto-generated from survey',
          createdById: input.createdById || null,
          items: { create: items }
        },
        include: { items: true }
      });

      const pboqItems = items.map((item, idx) => ({
        projectId,
        itemCode: `${item.itemCode}-${String(idx + 1).padStart(2, '0')}`,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitRate: item.unitRate,
        amount: item.amount,
        category: item.itemCategory,
        remarks: item.sourceReference
      }));

      const existing = await prisma.projectBOQItem.findMany({
        where: { projectId, remarks: { contains: 'GIS survey' } }
      });

      if (existing.length > 0) {
        await prisma.projectBOQItem.deleteMany({
          where: { id: { in: existing.map(i => i.id) } }
        });
      }

      await prisma.projectBOQItem.createMany({ data: pboqItems });

      await prisma.gISRoute.update({
        where: { id: gisRoute.id },
        data: { status: 'BOQ_GENERATED' }
      });

      totalBOQItems += items.length;
      results.push({
        routeId: gisRoute.id,
        routeName: gisRoute.name,
        itemsGenerated: items.length,
        totalEstimated,
        projectBOQItems: pboqItems.length
      });
    }

    const totalBOQ = results.reduce((s, r) => s + (r.totalEstimated || 0), 0);
    if (totalBOQ > 0) {
      await prisma.project.update({
        where: { id: projectId },
        data: { budget: totalBOQ }
      });
    }

    if (project.job) {
      await prisma.job.update({
        where: { id: project.job.id },
        data: { status: 'SURVEY_COMPLETED' }
      });
    }

    await updateProgressOnBOQGenerate(projectId);

    return {
      message: `Survey complete. BOQ: ${totalBOQItems} items.`,
      projectId,
      totalBOQItems,
      totalEstimated: totalBOQ,
      results,
      nextStep: 'BOQ in DRAFT. Review to continue.'
    };
  }

  /**
   * List survey requests
   */
  static async getSurveyRequests(projectId: string, filters: { status?: string | null; surveyType?: string | null }) {
    const { status, surveyType } = filters;

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;
    if (surveyType) where.surveyType = surveyType;

    return prisma.surveyRequest.findMany({
      where,
      include: {
        _count: {
          select: {
            checkins: true,
            photos: true,
            findings: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Create a new survey request with auto-generated SRV sequence
   */
  static async createSurveyRequest(projectId: string, data: CreateSurveyRequestInput) {
    const { title, description, surveyType, priority, assignedTeamId, assignedToId, scheduledDate, estimatedBOQ, createdById } = data;

    // Auto-generate requestNumber: SRV-{year}-{sequential}
    const year = new Date().getFullYear().toString();
    const lastSurvey = await prisma.surveyRequest.findFirst({
      where: {
        requestNumber: { startsWith: `SRV-${year}-` }
      },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true }
    });

    let nextSeq = 1;
    if (lastSurvey) {
      const parts = lastSurvey.requestNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const requestNumber = `SRV-${year}-${String(nextSeq).padStart(4, '0')}`;

    return prisma.surveyRequest.create({
      data: {
        projectId,
        requestNumber,
        title,
        description: description || null,
        surveyType,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        assignedTeamId: assignedTeamId || null,
        assignedToId: assignedToId || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        estimatedBOQ: estimatedBOQ ? parseFloat(String(estimatedBOQ)) : null,
        createdById
      },
      include: {
        _count: {
          select: {
            checkins: true,
            photos: true,
            findings: true
          }
        }
      }
    });
  }
}
