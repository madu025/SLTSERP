import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get('months') || '1', 10);
    const target = parseInt(searchParams.get('target') || '0', 10);

    const forecast = await InventoryService.getMaterialForecast({
        months,
        monthlyConnectionTarget: target
    });

    return Response.json(forecast);
});
