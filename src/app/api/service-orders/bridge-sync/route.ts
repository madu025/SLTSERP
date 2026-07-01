/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { bridgeSyncSchema } from '@/lib/validations/service-order.schema';

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role',
        },
    });
}

export const GET = apiHandler(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const soNum = searchParams.get('soNum');

    if (!soNum) {
        throw new Error('soNum is required');
    }

    const rawData = await ServiceOrderService.getExtensionRawData(soNum);

    if (!rawData) {
        return { success: false, message: 'No bridge data found' };
    }

    const scraped = (rawData.scrapedData as any);
    return {
        success: true,
        materialDetails: scraped?.materialDetails || [],
        forensicAudit: scraped?.forensicAudit || [],
        lastSynced: rawData.updatedAt
    };
});

export const POST = apiHandler(async (_req, _params, payload: any) => {
    return await ServiceOrderService.bridgeSync(payload);
}, { 
    schema: bridgeSyncSchema,
    audit: { action: 'BRIDGE_SYNC', entity: 'ServiceOrder' }
});
