import { NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        const result = await ReportService.getDailyOperationalReport({ date: dateParam });
        return NextResponse.json(result);
    } catch (error) {
        console.error('Daily Operational Report Error:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}

