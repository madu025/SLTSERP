import { apiHandler } from '@/lib/api-handler';
import { ProjectEVMService } from '@/services/project/project-evm.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectEVMService.getEVM(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    
    const evm = await ProjectEVMService.updateEVM(projectId, body || {});
    return Response.json(evm, { status: 201 });
}, {
    audit: { action: 'UPDATE', entity: 'PROJECT_EVM' },
    rawResponse: true
});