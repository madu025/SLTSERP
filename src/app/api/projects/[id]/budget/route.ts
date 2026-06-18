import { NextResponse } from 'next/server';
import { BudgetTrackingService } from '@/services/budget-tracking.service';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/budget - Full budget dashboard
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const dashboard = await BudgetTrackingService.getBudgetDashboard(projectId);
    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch budget data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/[id]/budget - Sync/recalculate actual cost
export async function POST(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const result = await BudgetTrackingService.syncActualCost(projectId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync budget';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
