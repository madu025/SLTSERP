import { NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const from_date = searchParams.get('from_date');
        const to_date = searchParams.get('to_date');
        const payment_type = searchParams.get('payment_type');
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const { payments, total, summary, by_type } = await ReportService.getPaymentsReport({
            from_date,
            to_date,
            payment_type,
            status,
            page,
            limit
        });

        return NextResponse.json({
            success: true,
            data: {
                summary,
                by_type,
                payments,
            },
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}
