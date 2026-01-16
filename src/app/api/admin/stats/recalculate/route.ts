import { NextResponse } from 'next/server';
import { StatsService } from '@/lib/stats.service';
import { handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
    try {
        const userRole = request.headers.get('x-user-role');
        if (userRole !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Start global recalculation in background (or wait for it if not too many OPMCs)
        await StatsService.globalRecalculate();

        return NextResponse.json({
            success: true,
            message: 'Global stats recalculation completed'
        });
    } catch (error) {
        return handleApiError(error);
    }
}
