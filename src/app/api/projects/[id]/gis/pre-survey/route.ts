import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-utils';
import { BOQEngine } from '@/lib/gis/boq-engine';
import { GISLayerType, ParsedCableData, ParsedPoleData, ParsedFiberJointData } from '@/types/gis';

type Params = Promise<{ id: string }>;

// Haversine formula to compute distance in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

    // 2. Compute route metrics and interpolate path
    const distanceMeters = calculateDistance(startLat, startLng, endLat, endLng);
    if (distanceMeters <= 0) {
      return NextResponse.json({ error: 'Start and end points must be distinct.' }, { status: 400 });
    }

    // Generate 15 points along the path with a slight curve for realism
    const numSubdivisions = 15;
    const pathCoordinates: [number, number][] = [];
    for (let i = 0; i <= numSubdivisions; i++) {
      const f = i / numSubdivisions;
      const lat = startLat + (endLat - startLat) * f;
      const lng = startLng + (endLng - startLng) * f;

      // Add a small sine wave curve perpendicular to the line for visual realism (road-like bend)
      const bendFactor = 0.00018 * Math.sin(f * Math.PI);
      
      // Calculate normal vector direction
      const dx = endLng - startLng;
      const dy = endLat - startLat;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : 0;

      pathCoordinates.push([
        lng + nx * bendFactor,
        lat + ny * bendFactor
      ]);
    }

    // 3. Interpolate pole positions (every 50 meters)
    const poleSpacing = 50; // meters
    const numPoles = Math.max(2, Math.floor(distanceMeters / poleSpacing) + 1);
    const polesData: any[] = [];
    for (let i = 0; i < numPoles; i++) {
      const f = i / (numPoles - 1);
      // Interpolate along path coordinates
      const floatIndex = f * numSubdivisions;
      const baseIdx = Math.floor(floatIndex);
      const frac = floatIndex - baseIdx;
      
      const p1 = pathCoordinates[baseIdx];
      const p2 = pathCoordinates[Math.min(baseIdx + 1, numSubdivisions)];

      const lng = p1[0] + (p2[0] - p1[0]) * frac;
      const lat = p1[1] + (p2[1] - p1[1]) * frac;

      polesData.push({
        index: i + 1,
        longitude: lng,
        latitude: lat,
        poleType: 'CONCRETE',
        height: 9,
        properties: {
          PL_Number: `${projectCode}-PL-${String(i + 1).padStart(3, '0')}`,
        },
      });
    }

    // 4. Place 2 Joint Closures (Start and End)
    const jointsData = [
      {
        index: 1,
        latitude: startLat,
        longitude: startLng,
        jointType: 'INLINE',
        capacity: 48,
        properties: { Joint_Number: `${projectCode}-JT-01` },
      },
      {
        index: 2,
        latitude: endLat,
        longitude: endLng,
        jointType: 'TERMINAL',
        capacity: 24,
        properties: { Joint_Number: `${projectCode}-JT-02` },
      },
    ];

    // 5. Construct GeoJSON FeatureCollection
    const features: any[] = [];

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
    const layersMap = new Map<GISLayerType, any>();
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
      featureCount: numPoles,
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
          polesCount: numPoles,
          estimatedCost: boq.totalEstimatedCost,
        }
      },
    });

    return NextResponse.json({
      success: true,
      routeId: newRoute.id,
      distanceMeters: Math.round(distanceMeters),
      polesCount: numPoles,
      estimatedCost: boq.totalEstimatedCost,
    });
  } catch (error: any) {
    console.error('Error generating pre-survey route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate pre-survey route.' },
      { status: 500 }
    );
  }
}
