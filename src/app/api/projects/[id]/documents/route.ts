import { apiHandler } from '@/lib/api-handler';
import { ProjectDocumentService } from '@/services/project/project-document.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';
import { requireSafeUrl } from '@/lib/input-guards';
import { assertProjectAccess } from '@/lib/project-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    await assertProjectAccess(projectId, params._userId);
    return await ProjectDocumentService.getDocuments(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

const documentSchema = z.object({
    title: z.string().trim().max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    category: z.string().max(100).optional(),
    fileUrl: z.string().min(1).max(2048).transform((v, ctx) => {
        try { return requireSafeUrl(v, 'fileUrl'); } catch { ctx.addIssue({ code: 'custom', message: 'fileUrl must be an http(s) or app-relative link' }); return z.NEVER; }
    }),
    uploadedById: z.string().optional(),
    documentId: z.string().optional().nullable(),
    changeSummary: z.string().max(1000).optional().nullable(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const data = documentSchema.parse(body);
    if (!params._userId) throw AppError.unauthorized('Authenticated uploader is required');
    await assertProjectAccess(projectId, params._userId);

    if (data.documentId) {
        const updatedDoc = await ProjectDocumentService.updateDocumentVersion({
            projectId,
            documentId: data.documentId,
            fileUrl: data.fileUrl,
            uploadedById: params._userId,
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
            uploadedById: params._userId,
        });
        return Response.json(newDoc);
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_DOCUMENT' },
    rawResponse: true
});
