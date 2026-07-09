import { prisma } from '@/lib/prisma';

export class GISReconciliationService {
  /**
   * Proximity helper: Haversine distance in meters
   */
  private static getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Sync planned route assets with approved survey points using existing database tables.
   */
  static async reconcile(projectId: string, userId: string) {
    // 1. Get the active GISRoute for the project
    const activeRoute = await prisma.gISRoute.findFirst({
      where: { projectId, isActive: true },
      include: {
        poles: true,
        closures: true,
        cableSegments: true,
      },
    });

    if (!activeRoute) {
      throw new Error('No active GIS route found for this project.');
    }

    // 2. Fetch all APPROVED survey points for this project
    const approvedPoints = await prisma.surveyPoint.findMany({
      where: { projectId, verificationStatus: 'APPROVED' },
    });

    if (approvedPoints.length === 0) {
      return {
        message: 'No approved survey points found. Nothing to sync.',
        routeId: activeRoute.id,
        updatedPoles: 0,
        updatedClosures: 0,
        updatedCables: 0,
      };
    }

    let updatedPolesCount = 0;
    let updatedClosuresCount = 0;
    let updatedCablesCount = 0;

    const matchedSurveyPointIds = new Set<string>();
    const nodeCoordsMap = new Map<string, [number, number]>();

    // 3. Reconcile Poles
    const polesToUpdate: { id: string; latitude: number; longitude: number }[] = [];
    for (const pole of activeRoute.poles) {
      let bestMatch = null;
      let minDist = 20; // 20 meters snap radius

      for (const sp of approvedPoints) {
        if (sp.layerId === 'survey_existing_pole' || sp.layerId === 'survey_new_pole') {
          const dist = this.getDistanceMeters(pole.latitude, pole.longitude, sp.latitude, sp.longitude);
          if (dist < minDist) {
            minDist = dist;
            bestMatch = sp;
          }
        }
      }

      if (bestMatch) {
        polesToUpdate.push({
          id: pole.id,
          latitude: bestMatch.latitude,
          longitude: bestMatch.longitude,
        });
        nodeCoordsMap.set(pole.id, [bestMatch.longitude, bestMatch.latitude]);
        matchedSurveyPointIds.add(bestMatch.id);
        updatedPolesCount++;
      } else {
        nodeCoordsMap.set(pole.id, [pole.longitude, pole.latitude]);
      }
    }

    // 4. Reconcile Closures
    const closuresToUpdate: { id: string; latitude: number; longitude: number }[] = [];
    for (const closure of activeRoute.closures) {
      let bestMatch = null;
      let minDist = 20; // 20 meters snap radius

      for (const sp of approvedPoints) {
        if (sp.layerId === 'survey_joint_closure' || sp.layerId === 'survey_fdp' || sp.layerId === 'survey_enclosure') {
          const dist = this.getDistanceMeters(closure.latitude, closure.longitude, sp.latitude, sp.longitude);
          if (dist < minDist) {
            minDist = dist;
            bestMatch = sp;
          }
        }
      }

      if (bestMatch) {
        closuresToUpdate.push({
          id: closure.id,
          latitude: bestMatch.latitude,
          longitude: bestMatch.longitude,
        });
        nodeCoordsMap.set(`closure_${closure.id}`, [bestMatch.longitude, bestMatch.latitude]);
        matchedSurveyPointIds.add(bestMatch.id);
        updatedClosuresCount++;
      } else {
        nodeCoordsMap.set(`closure_${closure.id}`, [closure.longitude, closure.latitude]);
      }
    }

    // 5. Save snaps to database (in transaction)
    await prisma.$transaction(async (tx) => {
      // Update matched poles
      for (const p of polesToUpdate) {
        await tx.gISPole.update({
          where: { id: p.id },
          data: { latitude: p.latitude, longitude: p.longitude },
        });
      }

      // Update matched closures
      for (const c of closuresToUpdate) {
        await tx.gISClosure.update({
          where: { id: c.id },
          data: { latitude: c.latitude, longitude: c.longitude },
        });
      }

      // 6. Add unmatched APPROVED survey points as new assets in the route
      let newPoleIndex = activeRoute.poles.length + 1;
      let newClosureIndex = activeRoute.closures.length + 1;

      for (const sp of approvedPoints) {
        if (matchedSurveyPointIds.has(sp.id)) continue;

        if (sp.layerId === 'survey_existing_pole' || sp.layerId === 'survey_new_pole') {
          const createdPole = await tx.gISPole.create({
            data: {
              routeId: activeRoute.id,
              poleNumber: newPoleIndex++,
              latitude: sp.latitude,
              longitude: sp.longitude,
              status: 'PLANNED',
              poleType: 'CONCRETE',
              height: 9,
            },
          });
          nodeCoordsMap.set(createdPole.id, [sp.longitude, sp.latitude]);
          updatedPolesCount++;
        } else if (sp.layerId === 'survey_joint_closure' || sp.layerId === 'survey_fdp' || sp.layerId === 'survey_enclosure') {
          const createdClosure = await tx.gISClosure.create({
            data: {
              routeId: activeRoute.id,
              closureNumber: newClosureIndex++,
              closureType: sp.layerId === 'survey_fdp' ? 'TERMINAL' : 'DOME',
              latitude: sp.latitude,
              longitude: sp.longitude,
              capacity: 8,
              status: 'PLANNED',
              notes: `Created from approved survey point: ${sp.layerName}`,
            },
          });
          nodeCoordsMap.set(`closure_${createdClosure.id}`, [sp.longitude, sp.latitude]);
          updatedClosuresCount++;
        }
      }

      // 7. Update Cable Segment coordinates and lengths
      for (const segment of activeRoute.cableSegments) {
        const properties = (segment.properties || {}) as Record<string, any>;
        let coords = (properties.coordinates || []) as [number, number][];

        if (coords.length >= 2) {
          let coordsChanged = false;

          // Snap start coordinate
          if (segment.fromPoleId && nodeCoordsMap.has(segment.fromPoleId)) {
            coords[0] = nodeCoordsMap.get(segment.fromPoleId)!;
            coordsChanged = true;
          }

          // Snap end coordinate
          if (segment.toPoleId && nodeCoordsMap.has(segment.toPoleId)) {
            coords[coords.length - 1] = nodeCoordsMap.get(segment.toPoleId)!;
            coordsChanged = true;
          }

          if (coordsChanged) {
            let length = 0;
            for (let i = 0; i < coords.length - 1; i++) {
              length += GISReconciliationService.getDistanceMeters(
                coords[i][1], coords[i][0],
                coords[i + 1][1], coords[i + 1][0]
              );
            }

            properties.coordinates = coords;

            await tx.gISCableSegment.update({
              where: { id: segment.id },
              data: {
                properties: properties as any,
                length: length,
              },
            });
            updatedCablesCount++;
          }
        }
      }

      // 8. Mark the active route as DRAFT to force BOQ recalculation and delete old BOQs
      await tx.gISRoute.update({
        where: { id: activeRoute.id },
        data: { status: 'DRAFT' },
      });

      await tx.gISGeneratedBOQ.deleteMany({
        where: { routeId: activeRoute.id },
      });
    });

    // 9. Write audit log
    await prisma.gISAuditLog.create({
      data: {
        projectId,
        entityType: 'GIS_ROUTE',
        entityId: activeRoute.id,
        action: 'ROUTE_RECONCILED',
        performedById: userId,
        routeVersion: activeRoute.version,
        source: 'RECONCILIATION_SERVICE',
        fieldChanges: {
          updatedPoles: updatedPolesCount,
          updatedClosures: updatedClosuresCount,
          updatedCables: updatedCablesCount,
        },
      },
    }).catch(e => console.error('Failed to log reconciliation audit:', e));

    return {
      message: `Successfully synchronized ${updatedPolesCount} poles, ${updatedClosuresCount} closures, and snapped ${updatedCablesCount} cables.`,
      routeId: activeRoute.id,
      updatedPoles: updatedPolesCount,
      updatedClosures: updatedClosuresCount,
      updatedCables: updatedCablesCount,
    };
  }
}
