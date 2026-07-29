import { NextRequest, NextResponse } from 'next/server';
import { GISAutoPlanService, PlannedClosure } from '@/services/GISAutoPlanService';
import { safe } from '@/utils/safe-await.util';

export async function POST(req: NextRequest) {
  const [jsonErr, body] = await safe<Record<string, unknown>>(req.json());
  
  if (jsonErr || !body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { polygon, customClosures, splitterRatio, feedPoint, startDeviceType } = body; // Array of [lng, lat] pairs
  const polygonArr = polygon as [number, number][];

  if (!polygonArr || !Array.isArray(polygonArr) || polygonArr.length < 3) {
    return NextResponse.json({ error: 'Valid polygon coordinates (array of [lng, lat]) are required' }, { status: 400 });
  }

  // Calculate bounding box with a small buffer (~100m or 0.0009 degrees) to fetch nearby road junctions
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  for (const [lon, lat] of polygonArr) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const buffer = 0.0009; // ~100m
  const bboxString = `${minLat - buffer},${minLon - buffer},${maxLat + buffer},${maxLon + buffer}`;

  const query = `
[out:json][timeout:45][bbox:${bboxString}];
(
  node["building"];
  way["building"];
  node["shop"];
  way["shop"];
  node["office"];
  way["office"];
  node["amenity"];
  way["amenity"];
  node["tourism"];
  way["tourism"];
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified)(_link)?$"];
);
out body;
>;
out skel qt;
`;

  // --- Next-Level Multi-Server Fallback Engine ---
  const servers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
  ];

  let data: Record<string, unknown> | null = null;
  let lastError: unknown = null;

  for (const server of servers) {
    console.log(`[OSM Overpass] Querying server: ${server}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds per server

    const [fetchErr, response] = await safe(fetch(server, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SLTS-FTTH-Planner/1.0 (contact: prasad@slt.lk; project: SLTSERP)',
      },
      signal: controller.signal
    }));

    clearTimeout(timeoutId);

    if (fetchErr) {
      console.warn(`[OSM Overpass] Failed to fetch from ${server}:`, fetchErr);
      lastError = fetchErr;
      continue;
    }

    if (response && response.ok) {
      const [jsonParseErr, jsonData] = await safe<Record<string, unknown>>(response.json());
      if (!jsonParseErr && jsonData) {
        data = jsonData;
        break;
      } else {
        lastError = jsonParseErr;
      }
    } else if (response) {
      const [textErr, errorText] = await safe(response.text());
      const safeText = textErr || !errorText ? '' : errorText.substring(0, 100);
      console.warn(`[OSM Overpass] Server ${server} returned status ${response.status}: ${safeText}`);
      lastError = new Error(`Server ${new URL(server).hostname} returned status ${response.status}`);
    }
  }

  if (!data) {
    // All Overpass servers are unreachable — fall back to local GeoPackage data only.
    // Buildings won't be clustered (no building data), but road network routing will still work.
    console.warn('[OSM Overpass] All servers unreachable — falling back to GeoPackage local road data only.');
  }

  if (data && (!data.elements || (Array.isArray(data.elements) && data.elements.length === 0))) {
    console.warn('[OSM Overpass] Query returned no elements — falling back to GeoPackage local road data.');
    data = null;
  }
  
  // Generate the FTTH layout using our planning service.
  // When data is null, only GeoPackage (MapWithAI) roads are used for routing.
  const [planErr, plan] = await safe(GISAutoPlanService.generatePlan(
    polygonArr, 
    data, 
    customClosures as PlannedClosure[], 
    splitterRatio ? String(splitterRatio) : undefined, 
    feedPoint as { lat: number; lon: number } | undefined, 
    startDeviceType ? String(startDeviceType) : undefined
  ));

  if (planErr || !plan) {
    console.error('Auto-Plan API Error:', planErr);
    return NextResponse.json(
      { error: planErr?.message || 'Failed to fetch planning data from OSM' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ...plan, osmData: data });
}
