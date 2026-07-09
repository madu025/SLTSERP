import { NextRequest, NextResponse } from 'next/server';
import { GISAutoPlanService } from '@/services/GISAutoPlanService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { polygon, customClosures, splitterRatio } = body; // Array of [lng, lat] pairs

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return NextResponse.json({ error: 'Valid polygon coordinates (array of [lng, lat]) are required' }, { status: 400 });
    }

    // Calculate bounding box with a small buffer (~100m or 0.0009 degrees) to fetch nearby road junctions
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    for (const [lon, lat] of polygon) {
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

    let data = null;
    let lastError: unknown = null;

    for (const server of servers) {
      try {
        console.log(`[OSM Overpass] Querying server: ${server}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds per server

        const response = await fetch(server, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SLTS-FTTH-Planner/1.0 (contact: prasad@slt.lk; project: SLTSERP)',
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
          break;
        } else {
          const errorText = await response.text();
          console.warn(`[OSM Overpass] Server ${server} returned status ${response.status}: ${errorText.substring(0, 100)}`);
          lastError = new Error(`Server ${new URL(server).hostname} returned status ${response.status}`);
        }
      } catch (err) {
        console.warn(`[OSM Overpass] Failed to fetch from ${server}:`, err);
        lastError = err;
      }
    }

    if (!data) {
      // All Overpass servers are unreachable — fall back to local GeoPackage data only.
      // Buildings won't be clustered (no building data), but road network routing will still work.
      console.warn('[OSM Overpass] All servers unreachable — falling back to GeoPackage local road data only.');
    }

    if (data && (!data.elements || data.elements.length === 0)) {
      console.warn('[OSM Overpass] Query returned no elements — falling back to GeoPackage local road data.');
      data = null;
    }
    
    const { feedPoint, startDeviceType } = body;

    // Generate the FTTH layout using our planning service.
    // When data is null, only GeoPackage (MapWithAI) roads are used for routing.
    const plan = await GISAutoPlanService.generatePlan(polygon, data, customClosures, splitterRatio, feedPoint, startDeviceType);

    return NextResponse.json({ ...plan, osmData: data });

  } catch (error: unknown) {
    console.error('Auto-Plan API Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: msg || 'Failed to fetch planning data from OSM' },
      { status: 500 }
    );
  }
}
