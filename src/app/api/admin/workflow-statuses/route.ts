import { apiHandler } from '@/lib/api-handler';
import { WorkflowStatusService } from '@/services/admin/workflow-status.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  return await WorkflowStatusService.getGroupedStatuses();
}, { roles: ROLE_GROUPS.ADMINS });
