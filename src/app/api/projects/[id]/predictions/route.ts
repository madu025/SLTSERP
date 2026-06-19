import { NextResponse } from 'next/server';
import { AiPredictionService } from '@/services/ai-prediction.service';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/predictions - Get saved predictions
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const predictions = await AiPredictionService.getSavedPredictions(projectId);
    return NextResponse.json(predictions);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}

// POST /api/projects/[id]/predictions - Run fresh AI predictions
export async function POST(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const predictions = await AiPredictionService.getAllPredictions(projectId);
    return NextResponse.json(predictions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prediction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
