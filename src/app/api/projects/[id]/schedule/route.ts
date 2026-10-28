import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectScheduleService } from '@/services/project/project-schedule.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
  try {
    return await ProjectScheduleService.getSchedule(params.id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
      throw AppError.notFound('Project not found');
    }
    throw error;
  }
}, {
  permissions: [RBAC_PERMISSIONS.PROJECT_READ],
  rawResponse: true,
});
