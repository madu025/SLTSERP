import { apiHandler } from '@/lib/api-handler';
import { ProjectEVMService } from '@/services/project/project-evm.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '90', 10);
    return await ProjectEVMService.getSnapshots(projectId, limit);
}, { rawResponse: true });

const snapshotSchema = z.object({
    pvCumulative: z.number().optional(),
    evCumulative: z.number().optional(),
    acCumulative: z.number().optional(),
    snapshotDate: z.string().optional(),
    periodLabel: z.string().optional(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const data = snapshotSchema.parse(body);
    const snapshot = await ProjectEVMService.recordSnapshot(projectId, data);
    return Response.json(snapshot, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'EVM_SNAPSHOT' },
    rawResponse: true
});