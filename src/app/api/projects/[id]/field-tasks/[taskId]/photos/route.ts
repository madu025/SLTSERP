import { apiHandler } from '@/lib/api-handler';
import { ProjectTaskService } from '@/services/project/project-task.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId, taskId } = params;
    const { fileName, fileUrl, photoType, latitude, longitude } = body || {};

    if (!fileName || !fileUrl || !photoType) {
        throw AppError.badRequest('fileName, fileUrl, and photoType are required');
    }

    const validPhotoTypes = ['PROOF', 'PROGRESS', 'COMPLETION', 'DEFECT', 'OTHER'];
    if (!validPhotoTypes.includes(photoType)) {
        throw AppError.badRequest('Invalid photoType. Must be one of: ' + validPhotoTypes.join(', '));
    }

    try {
        const photo = await ProjectTaskService.addFieldPhoto(projectId, taskId, {
            fileName: fileName as string,
            fileUrl: fileUrl as string,
            photoType: photoType as string,
            latitude: latitude as number | undefined,
            longitude: longitude as number | undefined
        });
        return Response.json(photo, { status: 201 });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'PROJECT_NOT_FOUND') throw AppError.notFound('Project not found');
            if (error.message === 'TASK_NOT_FOUND') throw AppError.notFound('Field task not found');
            if (error.message === 'TASK_PROJECT_MISMATCH') throw AppError.badRequest('Field task does not belong to the specified project');
        }
        throw error;
    }
}, {
    audit: { action: 'UPLOAD_PHOTO', entity: 'FIELD_TASK' },
    rawResponse: true
});
