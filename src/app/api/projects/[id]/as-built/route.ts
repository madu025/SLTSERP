import { NextResponse } from 'next/server';
import { AsBuiltService } from '@/services/as-built.service';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/as-built - Generate as-built outputs (QGIS, CAD, comparison)
export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'qgis'; // qgis, cad, layer, comparison
    const layerId = searchParams.get('layerId');

    switch (format) {
      case 'qgis':
        // Full QGIS project GeoJSON export (all layers)
        const qgisOutput = await AsBuiltService.generateQGIS(projectId);
        return NextResponse.json(qgisOutput);

      case 'layer':
        // Single layer export
        if (!layerId) {
          return NextResponse.json({ error: 'layerId required for layer export' }, { status: 400 });
        }
        const layerGeoJSON = await AsBuiltService.exportLayerGeoJSON(projectId, layerId);
        return NextResponse.json(layerGeoJSON);

      case 'cad':
        // CAD-compatible block format export
        const cadOutput = await AsBuiltService.exportCAD(projectId);
        return NextResponse.json(cadOutput);

      case 'comparison':
        // Surveyed vs Approved vs Installed stats
        const comparison = await AsBuiltService.getAsBuiltComparison(projectId);
        return NextResponse.json(comparison);

      default:
        return NextResponse.json(
          { error: 'Invalid format. Use: qgis, layer, cad, comparison' },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate as-built output';
    console.error('As-built generation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}