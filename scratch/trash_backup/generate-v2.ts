import { PrismaClient } from '@prisma/client';
import { GISAutoPlanService } from '../src/services/GISAutoPlanService';

const prisma = new PrismaClient();

async function run() {
  const projectId = 'cmr3b0q2a00f5si6khytg417j';
  
  const v1Route = await prisma.gISRoute.findFirst({
    where: { projectId: projectId, versionType: 'PLANNED', name: { contains: 'AI Planned Route' } },
    orderBy: { createdAt: 'asc' },
    include: {
      poles: true,
      closures: true,
      cableSegments: true
    }
  });

  if (!v1Route) {
    console.error('No V1 route found');
    return;
  }
  
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  
  for (const pole of v1Route.poles) {
    if (pole.latitude < minLat) minLat = pole.latitude;
    if (pole.latitude > maxLat) maxLat = pole.latitude;
    if (pole.longitude < minLon) minLon = pole.longitude;
    if (pole.longitude > maxLon) maxLon = pole.longitude;
  }
  
  const buffer = 0.0015;
  const polygon = [
    [minLon - buffer, minLat - buffer],
    [maxLon + buffer, minLat - buffer],
    [maxLon + buffer, maxLat + buffer],
    [minLon - buffer, maxLat + buffer],
    [minLon - buffer, minLat - buffer]
  ];
  
  const bboxString = `${minLat - buffer},${minLon - buffer},${maxLat + buffer},${maxLon + buffer}`;
  const query = `
[out:json][timeout:90][bbox:${bboxString}];
(
  way["building"];
  way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified)$"];
);
out body;
>;
out skel qt;
`;

  let data = null;
  const endpoints = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];
  
  for (const ep of endpoints) {
    try {
      console.log('Trying', ep);
      const res = await fetch(ep, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch(e) {}
  }

  if (!data) {
    console.error('Failed to get overpass data');
    return;
  }
  
  const customClosures = [];
  for (const c of v1Route.closures) {
    customClosures.push({
      index: c.closureNumber,
      closureType: c.closureType || 'TERMINAL',
      latitude: c.latitude,
      longitude: c.longitude,
      capacity: c.capacity || 8,
      notes: c.notes || ''
    });
  }
  
  const plan = await GISAutoPlanService.generatePlan(polygon, data, customClosures, 8);
  
  const v2geojsonData = {
    type: 'FeatureCollection',
    features: [
      ...(plan.cables || []).map((cb) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: cb.coordinates },
        properties: { layer: 'CABLE', cableType: cb.cableType, fiberCount: cb.fiberCount, length: cb.length, index: cb.index, _autoPlanned: true },
      })),
      ...(plan.poles || []).map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { layer: 'POLE', poleNumber: p.index, poleType: p.poleType, height: p.height, _autoPlanned: true },
      })),
      ...(plan.closures || []).map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
        properties: { layer: c.closureType === 'DOME' ? 'FDP' : 'FIBER_JOINT', closureNumber: c.index, closureType: c.closureType, capacity: c.capacity, notes: c.notes, _autoPlanned: true },
      })),
    ],
  };
  
  const v2Route = await prisma.gISRoute.create({
    data: {
      projectId,
      name: v1Route.name.replace('V1', '').replace('- V1 (Old)', '').trim() + ' - V2 (Optimized Same-Road)',
      status: 'DRAFT',
      versionType: 'PLANNED',
      version: 2,
      isActive: true,
      routeLength: plan.cables?.reduce((sum, cb) => sum + cb.length, 0) || 0,
      geojsonData: v2geojsonData,
    }
  });
  
  await prisma.gISRoute.update({
    where: { id: v1Route.id },
    data: { version: 1, name: v1Route.name.includes('V1') ? v1Route.name : v1Route.name + ' - V1 (Old)' }
  });
  
  console.log('Successfully saved V2 Route ID:', v2Route.id);
}

run().catch(console.error).finally(() => prisma.$disconnect());
