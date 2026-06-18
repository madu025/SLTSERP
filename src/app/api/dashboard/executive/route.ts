import { NextResponse } from 'next/server';
import { ExecutiveDashboardService } from '@/services/executive-dashboard.service';

// GET /api/dashboard/executive
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const opmcIdsParam = searchParams.get('opmcIds');
    const opmcIds = opmcIdsParam ? opmcIdsParam.split(',') : undefined;

    const data = await ExecutiveDashboardService.getDashboardData(opmcIds);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Executive dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
