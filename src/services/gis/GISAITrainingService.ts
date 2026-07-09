import { prisma } from '@/lib/prisma';
import { StockService } from '../inventory/stock.service';

export interface PIDeviationMetrics {
  projectId: string;
  projectName: string;
  projectCode: string;
  hasPlanned: boolean;
  hasFieldChange: boolean;
  hasBeforePat: boolean;
  hasAsBuilt: boolean;
  planned: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
    heightDistribution: { [key: string]: number };
  };
  fieldChange: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
    heightDistribution: { [key: string]: number };
  } | null;
  beforePat: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
    heightDistribution: { [key: string]: number };
  } | null;
  asBuilt: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
    heightDistribution: { [key: string]: number };
  } | null;
  deviations: {
    polesDiff: number;
    closuresDiff: number;
    cableLengthDiff: number;
    avgDisplacementMeters: number;
    heightUpgrades: number;
  } | null;
}

export class GISAITrainingService {
  /**
   * Helper: Haversine distance in meters
   */
  static getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Compiles the AI auto-planning deviation metrics across all projects.
   */
  static async getAITrainingMetrics(): Promise<PIDeviationMetrics[]> {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        projectCode: true,
        gisRoutes: {
          include: {
            poles: true,
            closures: true,
            cableSegments: true
          }
        }
      }
    });

    const metrics: PIDeviationMetrics[] = [];

    for (const proj of projects) {
      const routes = proj.gisRoutes;
      const plannedRoute = routes.find(r => r.versionType === 'PLANNED' && r.isActive);
      const fieldRoute = routes.find(r => r.versionType === 'FIELD_CHANGE' && r.isActive);
      const beforePatRoute = routes.find(r => r.versionType === 'BEFORE_PAT' && r.isActive);
      const asBuiltRoute = routes.find(r => r.versionType === 'AS_BUILT' && r.isActive);

      if (!plannedRoute) continue; // Must have an initial AI auto-plan to calculate deviations

      const plannedHeights: { [key: string]: number } = {};
      plannedRoute.poles.forEach(p => {
        const hKey = p.height ? `${p.height}m` : '5.6m';
        plannedHeights[hKey] = (plannedHeights[hKey] || 0) + 1;
      });

      const plannedCableLength = plannedRoute.cableSegments.reduce((sum, c) => sum + Number(c.length), 0);

      let fieldData: PIDeviationMetrics['fieldChange'] = null;
      if (fieldRoute) {
        const fieldHeights: { [key: string]: number } = {};
        fieldRoute.poles.forEach(p => {
          const hKey = p.height ? `${p.height}m` : '5.6m';
          fieldHeights[hKey] = (fieldHeights[hKey] || 0) + 1;
        });
        fieldData = {
          polesCount: fieldRoute.poles.length,
          closuresCount: fieldRoute.closures.length,
          cableLength: StockService.round(fieldRoute.cableSegments.reduce((sum, c) => sum + Number(c.length), 0)),
          heightDistribution: fieldHeights
        };
      }

      let beforePatData: PIDeviationMetrics['beforePat'] = null;
      if (beforePatRoute) {
        const beforePatHeights: { [key: string]: number } = {};
        beforePatRoute.poles.forEach(p => {
          const hKey = p.height ? `${p.height}m` : '5.6m';
          beforePatHeights[hKey] = (beforePatHeights[hKey] || 0) + 1;
        });
        beforePatData = {
          polesCount: beforePatRoute.poles.length,
          closuresCount: beforePatRoute.closures.length,
          cableLength: StockService.round(beforePatRoute.cableSegments.reduce((sum, c) => sum + Number(c.length), 0)),
          heightDistribution: beforePatHeights
        };
      }

      let asBuiltData: PIDeviationMetrics['asBuilt'] = null;
      if (asBuiltRoute) {
        const asBuiltHeights: { [key: string]: number } = {};
        asBuiltRoute.poles.forEach(p => {
          const hKey = p.height ? `${p.height}m` : '5.6m';
          asBuiltHeights[hKey] = (asBuiltHeights[hKey] || 0) + 1;
        });
        asBuiltData = {
          polesCount: asBuiltRoute.poles.length,
          closuresCount: asBuiltRoute.closures.length,
          cableLength: StockService.round(asBuiltRoute.cableSegments.reduce((sum, c) => sum + Number(c.length), 0)),
          heightDistribution: asBuiltHeights
        };
      }

      // Compute deviations between Planned and the latest survey phase available
      const targetCompare = asBuiltRoute || beforePatRoute || fieldRoute;
      let deviations: PIDeviationMetrics['deviations'] = null;

      if (targetCompare) {
        const polesDiff = targetCompare.poles.length - plannedRoute.poles.length;
        const closuresDiff = targetCompare.closures.length - plannedRoute.closures.length;
        const targetCableLength = targetCompare.cableSegments.reduce((sum, c) => sum + Number(c.length), 0);
        const cableLengthDiff = StockService.round(targetCableLength - plannedCableLength);

        // Compute average displacement vector
        let totalDisplacement = 0;
        let matchedPolesCount = 0;
        let heightUpgrades = 0;

        for (const fp of targetCompare.poles) {
          // Find closest pole in the planned route
          let minDistance = Infinity;
          let closestPole: typeof plannedRoute.poles[0] | null = null;

          for (const pp of plannedRoute.poles) {
            const dist = GISAITrainingService.getDistance(fp.latitude, fp.longitude, pp.latitude, pp.longitude);
            if (dist < minDistance) {
              minDistance = dist;
              closestPole = pp;
            }
          }

          if (closestPole && minDistance < 50) { // Snipped match boundary of 50 meters
            totalDisplacement += minDistance;
            matchedPolesCount++;

            const fHeight = fp.height || 5.6;
            const pHeight = closestPole.height || 5.6;
            if (fHeight > pHeight) {
              heightUpgrades++;
            }
          }
        }

        deviations = {
          polesDiff,
          closuresDiff,
          cableLengthDiff,
          avgDisplacementMeters: matchedPolesCount > 0 ? StockService.round(totalDisplacement / matchedPolesCount) : 0,
          heightUpgrades
        };
      }

      metrics.push({
        projectId: proj.id,
        projectName: proj.name,
        projectCode: proj.projectCode,
        hasPlanned: true,
        hasFieldChange: !!fieldRoute,
        hasBeforePat: !!beforePatRoute,
        hasAsBuilt: !!asBuiltRoute,
        planned: {
          polesCount: plannedRoute.poles.length,
          closuresCount: plannedRoute.closures.length,
          cableLength: StockService.round(plannedCableLength),
          heightDistribution: plannedHeights
        },
        fieldChange: fieldData,
        beforePat: beforePatData,
        asBuilt: asBuiltData,
        deviations
      });
    }

    return metrics;
  }
}
