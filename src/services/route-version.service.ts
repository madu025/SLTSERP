import { prisma } from '@/lib/prisma';

export interface CreateVersionInput {
  projectId: string;
  routeId: string;
  versionType: 'PLANNED' | 'FIELD_CHANGE' | 'AS_BUILT';
  changeRequestId?: string;
  geojsonData?: Record<string, unknown>;
  notes?: string;
}

export class RouteVersionService {
  /**
   * Create a new version of a GIS route
   * Deactivates old version, links parent↔child
   */
  static async createNewVersion(input: CreateVersionInput) {
    // Get current active route
    const currentRoute = await prisma.gISRoute.findUnique({
      where: { id: input.routeId },
      select: {
        id: true,
        version: true,
        projectId: true,
        name: true,
        routeLength: true,
        geojsonData: true,
        isActive: true,
      },
    });

    if (!currentRoute) throw new Error('GIS route not found');
    if (!currentRoute.isActive) throw new Error('Cannot version an inactive route');

    // Deactivate current version
    await prisma.gISRoute.update({
      where: { id: input.routeId },
      data: { isActive: false },
    });

    // Create new version (v+1)
    const newVersion = await prisma.gISRoute.create({
      data: {
        projectId: input.projectId,
        name: `${currentRoute.name} v${currentRoute.version + 1}`,
        description: `Version ${currentRoute.version + 1} - ${input.versionType}`,
        status: 'DRAFT',
        version: currentRoute.version + 1,
        parentVersionId: currentRoute.id,
        childVersionId: null,
        versionType: input.versionType,
        changeRequestId: input.changeRequestId,
        isActive: true,
        geojsonData: (input.geojsonData ?? currentRoute.geojsonData ?? {}) as any,
        routeLength: currentRoute.routeLength,
        createdById: undefined, // Will be set by calling code
      },
    });

    // Link current → new version
    await prisma.gISRoute.update({
      where: { id: input.routeId },
      data: { childVersionId: newVersion.id },
    });

    // Log GIS audit
    await prisma.gISAuditLog.create({
      data: {
        projectId: input.projectId,
        entityType: 'GIS_ROUTE',
        entityId: newVersion.id,
        action: 'VERSION_CREATED',
        performedById: 'SYSTEM',
        fieldChanges: {
          fromVersion: currentRoute.version,
          toVersion: newVersion.version,
          versionType: input.versionType,
          changeRequestId: input.changeRequestId,
        },
        routeVersion: newVersion.version,
        source: 'ROUTE_VERSION_SERVICE',
      },
    });

    return {
      previous: {
        id: currentRoute.id,
        version: currentRoute.version,
        isActive: false,
      },
      current: {
        id: newVersion.id,
        version: newVersion.version,
        isActive: true,
      },
      versionType: input.versionType,
    };
  }

  /**
   * Rollback to a previous version
   * Deactivates current, reactivates parent
   */
  static async rollback(routeId: string) {
    const currentRoute = await prisma.gISRoute.findUnique({
      where: { id: routeId },
      select: {
        id: true,
        version: true,
        parentVersionId: true,
        versionType: true,
        projectId: true,
      },
    });

    if (!currentRoute) throw new Error('Route not found');
    if (!currentRoute.parentVersionId) throw new Error('No parent version to rollback to');

    const parentRoute = await prisma.gISRoute.findUnique({
      where: { id: currentRoute.parentVersionId },
    });

    if (!parentRoute) throw new Error('Parent route version not found');

    // Deactivate current
    await prisma.gISRoute.update({
      where: { id: routeId },
      data: { isActive: false },
    });

    // Reactivate parent
    await prisma.gISRoute.update({
      where: { id: parentRoute.id },
      data: {
        isActive: true,
        childVersionId: currentRoute.id, // Keep link for history
      },
    });

    // Log audit
    await prisma.gISAuditLog.create({
      data: {
        projectId: currentRoute.projectId,
        entityType: 'GIS_ROUTE',
        entityId: parentRoute.id,
        action: 'ROLLBACK',
        performedById: 'SYSTEM',
        fieldChanges: {
          fromVersion: currentRoute.version,
          toVersion: parentRoute.version,
          rollbackReason: `Rollback from v${currentRoute.version} (${currentRoute.versionType}) to v${parentRoute.version} (${parentRoute.versionType})`,
        },
        routeVersion: parentRoute.version,
        source: 'ROUTE_VERSION_SERVICE',
      },
    });

    return {
      message: `Rolled back from v${currentRoute.version} to v${parentRoute.version}`,
      active: { id: parentRoute.id, version: parentRoute.version },
      rolledBack: { id: currentRoute.id, version: currentRoute.version },
    };
  }

  /**
   * Get version history for a route chain
   */
  static async getVersionHistory(routeId: string) {
    const route = await prisma.gISRoute.findUnique({
      where: { id: routeId },
      select: {
        id: true,
        version: true,
        parentVersionId: true,
        childVersionId: true,
        versionType: true,
        isActive: true,
        changeRequestId: true,
        createdAt: true,
      },
    });

    if (!route) throw new Error('Route not found');

    // Walk back to origin
    const history: typeof route[] = [route];
    let current = route;
    while (current.parentVersionId) {
      const parent = await prisma.gISRoute.findUnique({
        where: { id: current.parentVersionId },
        select: {
          id: true,
          version: true,
          parentVersionId: true,
          childVersionId: true,
          versionType: true,
          isActive: true,
          changeRequestId: true,
          createdAt: true,
        },
      });
      if (!parent) break;
      history.unshift(parent);
      current = parent;
    }

    return {
      routeChain: history.map((v) => ({
        id: v.id,
        version: v.version,
        versionType: v.versionType,
        isActive: v.isActive,
        changeRequestId: v.changeRequestId,
        createdAt: v.createdAt,
      })),
      totalVersions: history.length,
      activeVersion: history.find((v) => v.isActive)?.version,
    };
  }

  /**
   * Get version diff between two versions
   */
  static async getVersionDiff(versionAId: string, versionBId: string) {
    const [versionA, versionB] = await Promise.all([
      prisma.gISRoute.findUnique({
        where: { id: versionAId },
        select: { version: true, versionType: true, routeLength: true, geojsonData: true },
      }),
      prisma.gISRoute.findUnique({
        where: { id: versionBId },
        select: { version: true, versionType: true, routeLength: true, geojsonData: true },
      }),
    ]);

    if (!versionA || !versionB) throw new Error('One or both versions not found');

    const lengthDiff = (versionB.routeLength ?? 0) - (versionA.routeLength ?? 0);

    return {
      versionA: { version: versionA.version, type: versionA.versionType, length: versionA.routeLength },
      versionB: { version: versionB.version, type: versionB.versionType, length: versionB.routeLength },
      delta: {
        routeLengthMeters: Math.round(lengthDiff * 100) / 100,
        routeLengthPct: versionA.routeLength
          ? Math.round((lengthDiff / versionA.routeLength) * 10000) / 100
          : 0,
      },
      geoJsonChanged: JSON.stringify(versionA.geojsonData) !== JSON.stringify(versionB.geojsonData),
    };
  }
}