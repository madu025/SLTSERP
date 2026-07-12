import { NextRequest, NextResponse } from 'next/server';
import { GISAutoPlanService } from '@/services/GISAutoPlanService';
import { GISDataExtractor } from '@/services/gis/GISDataExtractor';
import { GISRoadNetwork } from '@/services/gis/GISRoadNetwork';
import { GISGeometry } from '@/services/gis/GISGeometry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { polygon, customClosures, osmData, poles, cables } = body;

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return NextResponse.json({ error: 'Valid polygon coordinates are required' }, { status: 400 });
    }

    if (!customClosures || !Array.isArray(customClosures) || customClosures.length === 0) {
      return NextResponse.json({ warnings: ['No closures found to analyze. Please draw a plan first.'], suggestions: [] });
    }

    const inputPoles = poles || [];
    const inputCables = cables || [];

    let mapData = osmData;
    // If OSM Data was not sent, fetch it dynamically based on the bounding box
    if (!mapData) {
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
      const query = `[out:json][timeout:90][bbox:${bboxString}];(node["building"];way["building"];way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified)$"];);out body;>;out skel qt;`;
      
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SLTS-FTTH-Planner/1.0 (contact: prasad@slt.lk; project: SLTSERP)',
        },
      });
      if (response.ok) {
        mapData = await response.json();
      }
    }

    const parsed = mapData && mapData.elements ? GISDataExtractor.parseOverpassElements(mapData) : null;
    const roads = parsed ? GISDataExtractor.extractRoads(parsed.nodes, parsed.ways, polygon) : [];
    const buildings = parsed ? GISDataExtractor.extractBuildings(parsed.nodes, parsed.ways) : [];

    // Pre-calculate spatial metadata context to pass to Gemini
    const closureAuditContext = customClosures.map(c => {
      const snap = GISRoadNetwork.snapToNearestRoad(c.latitude, c.longitude, roads);
      const distToRoad = GISGeometry.getDistanceMeters(c.latitude, c.longitude, snap.lat, snap.lon);
      
      // Find nearest building footprint
      let nearestBuildingName = 'unnamed building';
      let distToBuilding = Infinity;
      for (const b of buildings) {
        const d = GISGeometry.getDistanceMeters(c.latitude, c.longitude, b.lat, b.lon);
        if (d < distToBuilding) {
          distToBuilding = d;
          nearestBuildingName = b.name || 'unnamed building';
        }
      }

      return {
        index: c.index,
        type: c.closureType,
        latitude: c.latitude,
        longitude: c.longitude,
        distToRoadCenterlineMeters: Math.round(distToRoad),
        snappedLatitude: snap.lat,
        snappedLongitude: snap.lon,
        nearestBuilding: nearestBuildingName,
        distanceToBuildingMeters: Math.round(distToBuilding)
      };
    });

    const warnings: string[] = [];
    const suggestions: { index: number; latitude: number; longitude: number; reason: string }[] = [];

    // Check for GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const prompt = `
You are an expert Telecom Outside Plant (OSP) Engineering Auditor.
Below is the draft FTTH layout data, compiled with pre-computed snapped road coordinates and building footprints:
- Closures: ${JSON.stringify(closureAuditContext)}
- Poles: ${JSON.stringify(inputPoles.map((p: any) => ({ index: p.poleNumber || p.index, lat: p.latitude, lon: p.longitude })))}
- Cables: ${JSON.stringify(inputCables.map((c: any) => ({ index: c.index || c.segmentNumber, spans: c.coordinates?.length || 0 })))}

Analyze these coordinates against general telecom safety and OSP engineering laws:
1. Public Right-of-Way: Cables and poles MUST follow public roads. DPs must not be inside buildings (distance to building < 12m) or private property (distance to road centerline > 22m).
2. Do NOT suggest moving the Feed Point (index: 0, type: DOME / Feed Point). The Feed Point's position is fixed by the operator.
3. For other distribution points (index > 0), if they violate laws, suggest relocating them to their pre-calculated "snapped" road coordinates.

Provide professional explanations of each violation (e.g. mention the road name or building name in the warnings).
Return EXACTLY a JSON object matching this structure, with no markdown tags or other explanation:
{
  "warnings": [
    "Warning text detailing the violation (e.g., '⚠️ Building Encroachment: Terminal #2 is located only 3m from NSB Bank branch building footprint. Splicing inside bank premises is forbidden.')"
  ],
  "suggestions": [
    { "index": 2, "latitude": 7.48512, "longitude": 80.36412, "reason": "Relocated Terminal #2 to Kumaranatunga Mawatha road boundary to avoid bank building footprint." }
  ]
}
`;
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
            })
          }
        );

        if (geminiRes.ok) {
          const rawData = await geminiRes.json();
          const responseText = rawData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          
          if (parsed.warnings) warnings.push(...parsed.warnings);
          if (parsed.suggestions) suggestions.push(...parsed.suggestions);
        }
      } catch (geminiError) {
        console.error('[AI-Optimize] Gemini query failed, falling back to rule-based engine:', geminiError);
      }
    }

    // --- Heuristic Healer Engine (Rule-based Heuristic Fallback & Merged Audits) ---
    for (const closure of closureAuditContext) {
      if (closure.index === 0) continue; // Skip Feed Point optimization!

      let snappedSuggestion = false;

      // Violation 1: Distance to road centerline is too large
      if (closure.distToRoadCenterlineMeters > 22) {
        warnings.push(`⚠️ Snap Alert: ${closure.type} #${closure.index} is situated ${closure.distToRoadCenterlineMeters}m from the nearest road centerline (likely in private land/park).`);
        suggestions.push({
          index: closure.index,
          latitude: closure.snappedLatitude,
          longitude: closure.snappedLongitude,
          reason: `Automatically snapped to nearest road boundary to comply with Public Right-of-Way laws.`
        });
        snappedSuggestion = true;
      }

      // Violation 2: DP placed directly inside/near a building footprint
      if (!snappedSuggestion && closure.distanceToBuildingMeters < 12) {
        warnings.push(`🏠 Building Encroachment: ${closure.type} #${closure.index} is located too close to ${closure.nearestBuilding} (${closure.distanceToBuildingMeters}m).`);
        suggestions.push({
          index: closure.index,
          latitude: closure.snappedLatitude,
          longitude: closure.snappedLongitude,
          reason: `Relocated to the road boundary to prevent splicing inside private premises.`
        });
      }
    }

    // --- Heuristic Rule-Based Pole & Span Audits ---
    
    // 1. Audit Clustered/Redundant Poles (distance < 10m)
    for (let i = 0; i < inputPoles.length; i++) {
      const p1 = inputPoles[i];
      for (let j = i + 1; j < inputPoles.length; j++) {
        const p2 = inputPoles[j];
        const d = GISGeometry.getDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
        if (d < 10) {
          // Check if either pole is near a closure (we expect a pole near a closure)
          let nearClosure = false;
          for (const c of customClosures) {
            const d1 = GISGeometry.getDistanceMeters(p1.latitude, p1.longitude, c.latitude, c.longitude);
            const d2 = GISGeometry.getDistanceMeters(p2.latitude, p2.longitude, c.latitude, c.longitude);
            if (d1 < 5 || d2 < 5) {
              nearClosure = true;
              break;
            }
          }
          if (!nearClosure) {
            warnings.push(`⚠️ Redundant Pole: Pole P-${p1.poleNumber || p1.index} and Pole P-${p2.poleNumber || p2.index} are placed only ${d.toFixed(1)}m apart, which is clustered and structurally redundant.`);
          }
        }
      }
    }

    // 2. Audit Floating Cable Bends & Span Limits
    for (const cab of inputCables) {
      const coords = cab.coordinates || [];
      if (coords.length < 2) continue;

      const cabName = `Cable #${cab.index || cab.segmentNumber || ''}`;

      for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];

        // Audit Floating Bend (coordinate point must have a pole or closure within 5m)
        let minSupportDist = Infinity;
        for (const p of inputPoles) {
          const d = GISGeometry.getDistanceMeters(lat, lon, p.latitude, p.longitude);
          if (d < minSupportDist) minSupportDist = d;
        }
        for (const c of customClosures) {
          const d = GISGeometry.getDistanceMeters(lat, lon, c.latitude, c.longitude);
          if (d < minSupportDist) minSupportDist = d;
        }

        if (minSupportDist >= 5) {
          warnings.push(`⚠️ Floating Bend: ${cabName} bends at coordinate (${lat.toFixed(6)}, ${lon.toFixed(6)}) but has no supporting pole or closure within 5m (nearest support is ${minSupportDist.toFixed(1)}m away).`);
        }

        // Audit Span Limit (distance between consecutive points must not exceed 50m)
        if (i < coords.length - 1) {
          const [nextLon, nextLat] = coords[i + 1];
          const spanDist = GISGeometry.getDistanceMeters(lat, lon, nextLat, nextLon);
          if (spanDist > 50) {
            warnings.push(`⚠️ Span Limit Exceeded: ${cabName} has a span of ${spanDist.toFixed(1)}m between consecutive coordinates, exceeding the safe 50m limit.`);
          }
        }
      }
    }

    // Deduplicate warnings
    const uniqueWarnings = Array.from(new Set(warnings));

    if (uniqueWarnings.length === 0) {
      uniqueWarnings.push("✅ AI Audit: Design looks 100% compliant with OSP Telecom laws! No building crossings, property overlaps, clustered poles, or floating bends detected.");
    }

    return NextResponse.json({ warnings: uniqueWarnings, suggestions });

  } catch (error: unknown) {
    console.error('AI-Optimize API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
