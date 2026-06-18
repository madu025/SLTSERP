import { prisma } from '@/lib/prisma';

export interface SurveyPointApprovalInput {
  pointId: string;
  userId: string;
  reason?: string;
}

export class MapApprovalService {
  /**
   * Supervisor verifies a survey point (Step 1)
   */
  static async verifyPoint({ pointId, userId }: SurveyPointApprovalInput) {
    const point = await prisma.surveyPoint.findUnique({ where: { id: pointId } });
    if (!point) throw new Error('Survey point not found');
    if (point.verificationStatus !== 'PENDING_VERIFICATION') {
      throw new Error(`Cannot verify: point is in status "${point.verificationStatus}"`);
    }

    const updated = await prisma.surveyPoint.update({
      where: { id: pointId },
      data: {
        verificationStatus: 'VERIFIED',
        verificationStep: 'GIS_ENGINEER',
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });

    // Log GIS audit
    await prisma.gISAuditLog.create({
      data: {
        projectId: point.projectId,
        entityType: 'SURVEY_POINT',
        entityId: pointId,
        action: 'VERIFIED',
        performedById: userId,
        source: 'WEB_PORTAL',
      },
    });

    return updated;
  }

  /**
   * GIS Engineer approves a verified survey point (Step 2 - ready for BOQ)
   */
  static async approvePoint({ pointId, userId }: SurveyPointApprovalInput) {
    const point = await prisma.surveyPoint.findUnique({ where: { id: pointId } });
    if (!point) throw new Error('Survey point not found');
    if (point.verificationStatus !== 'VERIFIED') {
      throw new Error(`Cannot approve: point must be VERIFIED first, currently "${point.verificationStatus}"`);
    }

    const updated = await prisma.surveyPoint.update({
      where: { id: pointId },
      data: {
        verificationStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    await prisma.gISAuditLog.create({
      data: {
        projectId: point.projectId,
        entityType: 'SURVEY_POINT',
        entityId: pointId,
        action: 'APPROVED',
        performedById: userId,
        source: 'WEB_PORTAL',
      },
    });

    return updated;
  }

  /**
   * Reject a survey point at any step (with reason)
   */
  static async rejectPoint({ pointId, userId, reason }: SurveyPointApprovalInput) {
    if (!reason) throw new Error('Rejection reason is required');
    const point = await prisma.surveyPoint.findUnique({ where: { id: pointId } });
    if (!point) throw new Error('Survey point not found');

    const updated = await prisma.surveyPoint.update({
      where: { id: pointId },
      data: {
        verificationStatus: 'REJECTED',
        rejectionReason: reason,
      },
    });

    await prisma.gISAuditLog.create({
      data: {
        projectId: point.projectId,
        entityType: 'SURVEY_POINT',
        entityId: pointId,
        action: 'REJECTED',
        fieldChanges: { reason },
        performedById: userId,
        source: 'WEB_PORTAL',
      },
    });

    return updated;
  }

  /**
   * GIS Engineer flags a point for further review
   */
  static async flagPoint({ pointId, userId, reason }: SurveyPointApprovalInput) {
    const point = await prisma.surveyPoint.findUnique({ where: { id: pointId } });
    if (!point) throw new Error('Survey point not found');

    const updated = await prisma.surveyPoint.update({
      where: { id: pointId },
      data: {
        verificationStatus: 'FLAGGED',
        rejectionReason: reason,
      },
    });

    await prisma.gISAuditLog.create({
      data: {
        projectId: point.projectId,
        entityType: 'SURVEY_POINT',
        entityId: pointId,
        action: 'FLAGGED',
        fieldChanges: { reason },
        performedById: userId,
        source: 'WEB_PORTAL',
      },
    });

    return updated;
  }

  /**
   * Batch approve multiple verified points
   */
  static async batchApprove(pointIds: string[], userId: string) {
    const results = await Promise.allSettled(
      pointIds.map((id) => MapApprovalService.approvePoint({ pointId: id, userId }))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { succeeded, failed, total: pointIds.length };
  }

  /**
   * Batch verify multiple pending points (supervisor action)
   */
  static async batchVerify(pointIds: string[], userId: string) {
    const results = await Promise.allSettled(
      pointIds.map((id) => MapApprovalService.verifyPoint({ pointId: id, userId }))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { succeeded, failed, total: pointIds.length };
  }

  /**
   * Get layer approval summary stats for a project
   */
  static async getApprovalSummary(projectId: string) {
    const points = await prisma.surveyPoint.groupBy({
      by: ['layerId', 'layerName', 'verificationStatus'],
      where: { projectId },
      _count: { id: true },
    });

    const layers: Record<string, Record<string, number>> = {};
    for (const row of points) {
      if (!layers[row.layerId]) {
        layers[row.layerId] = { layerName: row.layerName as unknown as number, total: 0 };
      }
      layers[row.layerId][row.verificationStatus] = row._count.id;
      layers[row.layerId].total = (layers[row.layerId].total || 0) + row._count.id;
    }

    return layers;
  }

  /**
   * Get survey points for a project filtered by layer and status
   */
  static async getSurveyPoints(
    projectId: string,
    options: { layerId?: string; status?: string; page?: number; limit?: number }
  ) {
    const { layerId, status, page = 1, limit = 50 } = options;

    const where: Record<string, unknown> = { projectId };
    if (layerId) where.layerId = layerId;
    if (status) where.verificationStatus = status;

    const [points, total] = await Promise.all([
      prisma.surveyPoint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          layerId: true,
          layerName: true,
          latitude: true,
          longitude: true,
          verificationStatus: true,
          verificationStep: true,
          attributes: true,
          photoUrls: true,
          verifiedById: true,
          verifiedAt: true,
          approvedById: true,
          approvedAt: true,
          rejectionReason: true,
          createdAt: true,
        },
      }),
      prisma.surveyPoint.count({ where }),
    ]);

    return { points, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
