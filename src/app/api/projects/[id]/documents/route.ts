import { apiHandler } from '@/lib/api-handler';
import { ProjectDocumentService } from '@/services/project/project-document.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectDocumentService.getDocuments(projectId);
}, { rawResponse: true });

const documentSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional().nullable(),
    category: z.string().optional(),
    fileUrl: z.string().min(1),
    uploadedById: z.string().min(1),
    documentId: z.string().optional().nullable(),
    changeSummary: z.string().optional().nullable(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const data = documentSchema.parse(body);

    if (data.documentId) {
        const updatedDoc = await ProjectDocumentService.updateDocumentVersion({
            documentId: data.documentId,
            fileUrl: data.fileUrl,
            uploadedById: data.uploadedById,
            changeSummary: data.changeSummary,
        });
        return Response.json(updatedDoc);
    } else {
        if (!data.title || !data.category) {
            return Response.json({ error: 'Title and category are required' }, { status: 400 });
        }
        
        const newDoc = await ProjectDocumentService.createDocument(projectId, {
            title: data.title,
            description: data.description,
            category: data.category,
            fileUrl: data.fileUrl,
            uploadedById: data.uploadedById,
        });
        return Response.json(newDoc);
    }
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_DOCUMENT' },
    rawResponse: true
});
