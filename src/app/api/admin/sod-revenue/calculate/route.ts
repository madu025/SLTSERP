import { apiHandler } from '@/lib/api-handler';
import { SodRevenueService } from '@/services/admin/sod-revenue.service';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const rtomId = searchParams.get('rtomId');
    const date = searchParams.get('date');

    if (!rtomId || !date) {
        throw AppError.badRequest('RTOM ID and date are required');
    }

    const completedDate = new Date(date);
    const revenue = await SodRevenueService.getRevenueForSOD(rtomId, completedDate);

    return Response.json({
        success: true,
        data: {
            revenue,
            rtomId,
            date: completedDate.toISOString()
        }
    });
}, {
    // Requires any valid role
});
