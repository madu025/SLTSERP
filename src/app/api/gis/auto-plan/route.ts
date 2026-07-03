import { NextRequest, NextResponse } from 'next/server';
import { GISAutoPlanService } from '@/services/GISAutoPlanService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { polygon, customClosures } = body; // Array of [lng, lat] pairs

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return NextResponse.json({ error: 'Valid polygon coordinates (array of [lng, lat]) are required' }, { status: 400 });
    }

    // Convert polygon to Overpass poly string format: "lat lon lat lon ..."
    // Note: GeoJSON uses [lon, lat], but Overpass requires "lat lon"
    const polyString = polygon.map((coord: [number, number]) => `${coord[1]} ${coord[0]}`).join(' ');

    const query = `
[out:json][timeout:30];
(
  way["building"](poly:"${polyString}");
  way["highway"](poly:"${polyString}");
);
out body;
>;
out skel qt;
`;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Overpass API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Generate the FTTH layout using our planning service
    const plan = await GISAutoPlanService.generatePlan(polygon, data, customClosures);

    return NextResponse.json(plan);

  } catch (error: unknown) {
    console.error('Auto-Plan API Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: msg || 'Failed to fetch planning data from OSM' },
      { status: 500 }
    );
  }
}
