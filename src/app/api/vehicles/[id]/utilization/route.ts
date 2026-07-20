import VehicleService from '@/services/VehicleService';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const { searchParams } = new URL(request.url);
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');

    if (!from_date || !to_date) {
        throw AppError.badRequest('Missing from_date or to_date');
    }

    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);

    return await VehicleService.getVehicleUtilization(id, fromDate, toDate);
});

