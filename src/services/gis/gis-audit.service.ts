import { prisma } from '@/lib/prisma';

export class GISAuditService {
  /**
   * Log a GIS entity change
   */
  static async logChange(params: {
    projectId: string;
    entityType: string;
    entityId: string;
    action: string;
    performedById: string;
    fieldChanges?: Record<string, { oldValue: unknown; newValue: unknown }>[];
    locationBefore?: { lat: number; lng: number };
    locationAfter?: { lat: number; lng: number };
    routeVersion?: number;
    source?: string;
  }) {
    return prisma.gISAuditLog.create({
      data: {
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        performedById: params.performedById,
        fieldChanges: params.fieldChanges ? (params.fieldChanges as object) : undefined,
        locationBefore: params.locationBefore ? (params.locationBefore as object) : undefined,
        locationAfter: params.locationAfter ? (params.locationAfter as object) : undefined,
        routeVersion: params.routeVersion,
        source: params.source ?? 'WEB_PORTAL',
      },
    });
  }

  /**
   * Get full audit trail for a specific GIS entity
   */
  static async getAuditTrail(
    entityType: string,
    entityId: string,
    options?: { page?: number; limit?: number }
  ) {
    const { page = 1, limit = 50 } = options ?? {};

    const [logs, total] = await Promise.all([
      prisma.gISAuditLog.findMany({
        where: { entityType, entityId },
        orderBy: { performedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.gISAuditLog.count({ where: { entityType, entityId } }),
    ]);

    return { logs, total, page, limit };
  }

  /**
   * Get project-level audit summary
   */
  static async getProjectAuditSummary(projectId: string) {
    const [totalChanges, byEntityType, byAction, recentChanges] = await Promise.all([
      prisma.gISAuditLog.count({ where: { projectId } }),
      prisma.gISAuditLog.groupBy({
        by: ['entityType'],
        where: { projectId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.gISAuditLog.groupBy({
        by: ['action'],
        where: { projectId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.gISAuditLog.findMany({
        where: { projectId },
        orderBy: { performedAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalChanges,
      byEntityType: byEntityType.map((r) => ({ type: r.entityType, count: r._count.id })),
      byAction: byAction.map((r) => ({ action: r.action, count: r._count.id })),
      recentChanges,
    };
  }

  /**
   * Get paginated project audit logs with filters
   */
  static async getProjectLogs(
    projectId: string,
    filters?: {
      entityType?: string;
      action?: string;
      source?: string;
      from?: Date;
      to?: Date;
      page?: number;
      limit?: number;
    }
  ) {
    const { entityType, action, source, from, to, page = 1, limit = 50 } = filters ?? {};

    const where: Record<string, unknown> = { projectId };
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (source) where.source = source;
    if (from || to) {
      where.performedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.gISAuditLog.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.gISAuditLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
