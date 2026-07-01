import { NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const view = searchParams.get('view') || 'manager';
        const period = searchParams.get('period') || '6M';
        const customFrom = searchParams.get('from');
        const customTo = searchParams.get('to');
        const groupBy = searchParams.get('groupBy') || 'RTOM';

        if (view !== 'manager' && view !== 'area') {
            return NextResponse.json({ error: 'Invalid view type' }, { status: 400 });
        }

        const reportData = await ReportService.getAnalyticsReport(view, period, {
            customFrom,
            customTo,
            groupBy
        });

        return NextResponse.json(reportData);
    } catch (error) {
        console.error('Analytics Error:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
