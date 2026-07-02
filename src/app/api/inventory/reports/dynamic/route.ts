import { NextResponse } from 'next/server';
import { DynamicReportService } from '@/services/inventory/dynamic-report.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const report = await DynamicReportService.generateReport(body);
        return NextResponse.json({ success: true, data: report });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Dynamic Report Generation Error:', error);
        return NextResponse.json({ success: false, error: err.message || 'Failed to generate report' }, { status: 400 });
    }
}
