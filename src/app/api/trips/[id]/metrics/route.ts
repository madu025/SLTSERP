export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import TripService from '@/services/fleet/TripService';

/**
 * GET: Retrieve trip metrics by ID
 */
export const GET = apiHandler<unknown, void>(
    async (_request, params) => {
        const metrics = await TripService.getTripMetrics(params.id);

        if (!metrics) {
            throw AppError.notFound('Trip metrics not found');
        }

        return metrics;
    }
);
