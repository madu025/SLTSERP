import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

export class PATService {
  /**
   * Start a new PAT session (Pre-PAT or SLT PAT)
   */
  static async startSession(projectId: string, patType: 'PRE_PAT' | 'SLT_PAT', conductedById: string) {
    // Check for existing in-progress session
    const existing = await prisma.pATSession.findFirst({
      where: { projectId, patType, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (existing) {
      throw AppError.badRequest(`A ${patType} session is already in progress for this project`);
    }

    return prisma.pATSession.create({
      data: {
        projectId,
        patType,
        status: 'IN_PROGRESS',
        conductedById,
        conductedAt: new Date(),
      },
    });
  }

  /**
   * Record result for a single PAT test point
   */
  static async recordPointResult(
    sessionId: string,
    data: {
      pointReference: string;
      measuredPower?: number;
      acceptedPower?: number;
      verifiedLat?: number;
      verifiedLng?: number;
      fineTuneNeeded?: boolean;
      fineTuneType?: string;
      fineTuneNotes?: string;
      photoUrls?: string[];
    }
  ) {
    const session = await prisma.pATSession.findUnique({ where: { id: sessionId } });
    if (!session) throw AppError.badRequest('PAT session not found');
    if (session.status !== 'IN_PROGRESS') throw AppError.badRequest('PAT session is not in progress');

    const powerStatus = data.measuredPower != null && data.acceptedPower != null
      ? data.measuredPower >= data.acceptedPower ? 'PASS' : 'FAIL'
      : 'PENDING';

    const result = await prisma.pATPointResult.create({
      data: {
        patSessionId: sessionId,
        pointReference: data.pointReference,
        measuredPower: data.measuredPower,
        acceptedPower: data.acceptedPower,
        powerStatus,
        verifiedLat: data.verifiedLat,
        verifiedLng: data.verifiedLng,
        fineTuneNeeded: data.fineTuneNeeded ?? false,
        fineTuneType: data.fineTuneType,
        fineTuneNotes: data.fineTuneNotes,
        photoUrls: data.photoUrls ?? [],
      },
    });

    // Update session stats
    const stats = await prisma.pATPointResult.aggregate({
      where: { patSessionId: sessionId },
      _count: { id: true },
    });
    const passed = await prisma.pATPointResult.count({
      where: { patSessionId: sessionId, powerStatus: 'PASS' },
    });
    const failed = await prisma.pATPointResult.count({
      where: { patSessionId: sessionId, powerStatus: 'FAIL' },
    });
    const fineTuneCount = await prisma.pATPointResult.count({
      where: { patSessionId: sessionId, fineTuneNeeded: true },
    });

    const total = stats._count.id;
    await prisma.pATSession.update({
      where: { id: sessionId },
      data: {
        totalPoints: total,
        passedPoints: passed,
        failedPoints: failed,
        passRate: total > 0 ? (passed / total) * 100 : 0,
        fineTuneNeeded: fineTuneCount > 0,
      },
    });

    return result;
  }

  /**
   * Complete a PAT session and update project status
   */
  static async completeSession(sessionId: string, sltOfficers?: object) {
    const session = await prisma.pATSession.findUnique({
      where: { id: sessionId },
      include: { pointResults: true },
    });
    if (!session) throw AppError.badRequest('PAT session not found');

    const passRate = session.totalPoints > 0
      ? (session.passedPoints / session.totalPoints) * 100
      : 0;

    const passed = passRate >= 80; // 80% pass threshold

    const updated = await prisma.pATSession.update({
      where: { id: sessionId },
      data: {
        status: passed ? 'COMPLETED' : 'FAILED',
        completedAt: new Date(),
        passRate,
        sltOfficers: sltOfficers ? (sltOfficers as object) : undefined,
      },
    });

    // Update project status based on PAT type
    if (passed) {
      if (session.patType === 'SLT_PAT') {
        await prisma.project.update({
          where: { id: session.projectId },
          data: { status: 'SLT_PAT_PASSED' },
        });
      } else if (session.patType === 'PRE_PAT') {
        await prisma.project.update({
          where: { id: session.projectId },
          data: { status: 'PRE_PAT_PASSED' },
        });
      }
    }

    return { session: updated, passed, passRate };
  }

  /**
   * Get all PAT sessions for a project
   */
  static async getProjectSessions(projectId: string) {
    return prisma.pATSession.findMany({
      where: { projectId },
      include: {
        pointResults: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
