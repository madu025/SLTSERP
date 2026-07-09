import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-utils';
import { BOQEngine } from '@/lib/gis/boq-engine';
import { GISLayerType, ParsedCableData, ParsedPoleData, ParsedFiberJointData } from '@/types/gis';
import { GISAIService } from '@/services/gis/gis-ai.service';

type Params = Promise<{ id: string }>;



// POST /api/projects/[id]/gis/pre-survey - Create AI-generated Pre-Survey Draft
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireAuth();
    const { id: projectId } = await params;
    const body = await request.json();

    const {
      routeName = 'Pre-Survey AI Route',
      startLat,
      startLng,
      endLat,
      endLng,
      cableType = '24F SM',
      fiberCount = 24,
    } = body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return NextResponse.json({ error: 'Start and end coordinates are required.' }, { status: 400 });
    }

    // 1. Fetch project details along with its Job info to get the Region
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { job: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const projectCode = project.projectCode || 'PRJ';
    const region = project.job?.region || undefined;

    // 2. Run AI Cable Route Optimization (Real Dijkstra pathfinding on road network)
    const optResult = await GISAIService.optimizeRoute(
      [startLat, startLng],
      [endLat, endLng],
      projectId,
      {
        allowRestrictedZones: false,
        maxSpanMeters: 50,
        boundsBufferMeters: 500
      }
    );

    const distanceMeters = optResult.estimatedCableLengthMeters;
    
    // Map the optimized path coordinates [lat, lon] to GeoJSON [lon, lat] format
    const pathCoordinates: [number, number][] = optResult.optimizedPath.map(coord => [coord[1], coord[0]]);

    // 3. Map the real generated poles
    const polesData = optResult.autoPoles.map((p, i) => ({
      index: i + 1,
      longitude: p.lon,
      latitude: p.lat,
      poleType: p.type || 'CONCRETE',
      height: 9,
      properties: {
        PL_Number: `${projectCode}-PL-${String(i + 1).padStart(3, '0')}`,
      },
    }));

    // If no poles were auto-placed (very short route), place at least start/end poles
    if (polesData.length === 0) {
      polesData.push(
        {
          index: 1,
          longitude: startLng,
          latitude: startLat,
          poleType: 'CONCRETE',
          height: 9,
          properties: { PL_Number: `${projectCode}-PL-001` },
        },
        {
          index: 2,
          longitude: endLng,
          latitude: endLat,
          poleType: 'CONCRETE',
          height: 9,
          properties: { PL_Number: `${projectCode}-PL-002` },
        }
      );
    }

    // 4. Place 2 Joint Closures (Start and End) at the actual optimized endpoints
    const jointsData = [
      {
        index: 1,
        latitude: pathCoordinates[0][1],
        longitude: pathCoordinates[0][0],
        jointType: 'INLINE',
        capacity: 48,
        properties: { Joint_Number: `${projectCode}-JT-01` },
      },
      {
        index: 2,
        latitude: pathCoordinates[pathCoordinates.length - 1][1],
        longitude: pathCoordinates[pathCoordinates.length - 1][0],
        jointType: 'TERMINAL',
        capacity: 24,
        properties: { Joint_Number: `${projectCode}-JT-02` },
      },
    ];

    // 5. Construct GeoJSON FeatureCollection
    const features: unknown[] = [];

    // Cable LineString
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: pathCoordinates,
      },
      properties: {
        layer: 'CABLE',
        cable_type: cableType,
        fiber_count: fiberCount,
        length: distanceMeters,
        label: `${cableType} Cable (${Math.round(distanceMeters)}m)`,
      },
    });

    // Poles Point features
    polesData.forEach((p) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.longitude, p.latitude],
        },
        properties: {
          layer: 'POLE',
          pole_number: p.properties.PL_Number,
          pole_type: p.poleType,
          height: p.height,
        },
      });
    });

    // Joints Point features
    jointsData.forEach((j) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [j.longitude, j.latitude],
        },
        properties: {
          layer: 'FIBER_JOINT',
          joint_number: j.properties.Joint_Number,
          joint_type: j.jointType,
        },
      });
    });

    const geojsonData = {
      type: 'FeatureCollection',
      features,
    };

    // 6. Run BOQ Engine
    const layersMap = new Map<GISLayerType, unknown>();
    layersMap.set('CABLE', {
      layerName: 'CABLE',
      featureCount: 1,
      totalLength: distanceMeters,
      cableType,
      fiberCount,
      segments: [{
        index: 1,
        coordinates: pathCoordinates,
        length: distanceMeters,
        cableType,
        fiberCount,
      }],
    } as ParsedCableData);

    layersMap.set('POLE', {
      layerName: 'POLE',
      featureCount: polesData.length,
      poles: polesData.map(p => ({
        index: p.index,
        latitude: p.latitude,
        longitude: p.longitude,
        poleType: p.poleType,
        height: p.height,
        properties: p.properties,
      })),
    } as ParsedPoleData);

    layersMap.set('FIBER_JOINT', {
      layerName: 'FIBER_JOINT',
      featureCount: 2,
      joints: jointsData.map(j => ({
        index: j.index,
        latitude: j.latitude,
        longitude: j.longitude,
        jointType: j.jointType,
        capacity: j.capacity,
        properties: j.properties,
      })),
    } as ParsedFiberJointData);

    const boqEngine = new BOQEngine();
    const boq = boqEngine.generateBOQ(layersMap, region, 1.0);

    // 7. Save GISRoute and child entities to Database
    const newRoute = await prisma.gISRoute.create({
      data: {
        projectId,
        name: routeName,
        status: 'PLANNED', // Marked as PLANNED since it is a Pre-Survey draft
        routeLength: distanceMeters,
        geojsonData,
        isActive: true,
      },
    });

    // Create Poles
    await prisma.gISPole.createMany({
      data: polesData.map(p => ({
        routeId: newRoute.id,
        poleNumber: p.index, // Mapping index to poleNumber (Int)
        poleType: p.poleType,
        height: p.height,
        latitude: p.latitude,
        longitude: p.longitude,
        properties: p.properties,
      })),
    });

    // Create Closures
    await prisma.gISClosure.createMany({
      data: jointsData.map(j => ({
        routeId: newRoute.id,
        closureNumber: j.index, // Mapping index to closureNumber (Int)
        closureType: j.jointType,
        capacity: j.capacity, // Type Int
        latitude: j.latitude,
        longitude: j.longitude,
        properties: j.properties,
      })),
    });

    // Create Cable Segment
    await prisma.gISCableSegment.create({
      data: {
        routeId: newRoute.id,
        segmentNumber: 1,
        length: distanceMeters,
        cableType,
        fiberCount,
        properties: { coordinates: pathCoordinates },
      },
    });

    // Save BOQ in database
    if (boq.items.length > 0) {
      const generatedBOQ = await prisma.gISGeneratedBOQ.create({
        data: {
          routeId: newRoute.id,
          projectId,
          status: 'DRAFT',
          totalEstimated: boq.totalEstimatedCost,
          createdById: user.id || 'system',
        },
      });

      await prisma.gISGeneratedBOQItem.createMany({
        data: boq.items.map((item, idx) => ({
          boqId: generatedBOQ.id,
          itemCategory: item.category,
          itemCode: item.itemCode || `BOQ-${projectCode}-${item.category.substring(0, 3)}-${String(idx + 1).padStart(2, '0')}`,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitRate: item.unitRate,
          amount: item.amount,
          sourceType: 'AUTO_CALCULATED',
          sourceReference: 'AI Pre-Survey Design',
        })),
      });

      // Sync to ProjectBOQItem
      const categoryCounters: Record<string, number> = {};
      await prisma.projectBOQItem.createMany({
        data: boq.items.map((item) => {
          const catKey = item.category.substring(0, 3);
          categoryCounters[catKey] = (categoryCounters[catKey] || 0) + 1;
          const seq = String(categoryCounters[catKey]).padStart(2, '0');
          return {
            projectId,
            category: item.category,
            itemCode: item.itemCode || `BOQ-${projectCode}-${catKey}-${seq}`,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitRate: Math.round(item.unitRate * 100) / 100,
            amount: Math.round(item.amount * 100) / 100,
            source: 'NEW',
            remarks: 'Generated via AI Pre-Survey Design',
          };
        }),
      });

      // Update project budget
      await prisma.project.update({
        where: { id: projectId },
        data: {
          budget: boq.totalEstimatedCost,
        },
      });
    }

    // Create Audit Log entry
    await prisma.gISAuditLog.create({
      data: {
        projectId,
        performedById: user.id || 'system',
        action: 'PRE_SURVEY_AI_GENERATED',
        entityType: 'GISRoute',
        entityId: newRoute.id,
        source: 'WEB_PORTAL',
        fieldChanges: {
          distanceMeters: Math.round(distanceMeters),
          polesCount: polesData.length,
          estimatedCost: boq.totalEstimatedCost,
        }
      },
    });

    return NextResponse.json({
      success: true,
      routeId: newRoute.id,
      distanceMeters: Math.round(distanceMeters),
      polesCount: polesData.length,
      estimatedCost: boq.totalEstimatedCost,
    });
  } catch (error: unknown) {
    console.error('Error generating pre-survey route:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate pre-survey route.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
