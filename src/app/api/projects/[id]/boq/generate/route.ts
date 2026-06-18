import { NextResponse } from 'next/server';
import { AutoBOQService } from '@/services/auto-boq.service';

type Params = Promise<{ id: string }>;

// POST /api/projects/[id]/boq/generate
export async function POST(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;

    const { boq, summary } = await AutoBOQService.generateBOQ(projectId);

    if (!boq.length) {
      return NextResponse.json({
        message: 'No approved survey points found. Please ensure survey points are fully approved before generating BOQ.',
        boq: [],
        summary: {},
      });
    }

    return NextResponse.json({ boq, summary, count: boq.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BOQ generation failed';
    console.error('Auto-BOQ generation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
