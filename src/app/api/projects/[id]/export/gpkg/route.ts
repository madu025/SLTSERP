import { apiHandler } from '@/lib/api-handler';
import { ProjectExportService } from '@/services/project/project-export.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    
    const { gpkgBuffer, filename } = await ProjectExportService.getGPKGFile(projectId);

    return new Response(gpkgBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': gpkgBuffer.byteLength.toString(),
            'Cache-Control': 'no-cache',
        },
    });
}, { rawResponse: true });