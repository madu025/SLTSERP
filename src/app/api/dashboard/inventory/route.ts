import { NextResponse } from 'next/server';

import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { DashboardService } from '@/services/core/dashboard.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    userId: z.string().optional(),
    region: z.string().optional().default('ALL'),
    rtom: z.string().optional().default('ALL'),
});

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.parse(Object.fromEntries(searchParams));

    return await DashboardService.getInventoryMetrics(parsed.rtom);
}, { rawResponse: true });

