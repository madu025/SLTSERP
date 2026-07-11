import { apiHandler } from '@/lib/api-handler';
import TripService from '@/services/TripService';

/**
 * GET: Retrieve trip metrics by ID
 */
export const GET = apiHandler<unknown, void>(
    async (request: Request, params: { id: string }) => {
        const { id } = params;
        const metrics = await TripService.getTripMetrics(id);

        if (!metrics) {
            throw new Error('Trip metrics not found');
        }

        return metrics;
    }
);
