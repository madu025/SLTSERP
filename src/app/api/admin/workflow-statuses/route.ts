import { apiHandler } from '@/lib/api-handler';
import { WorkflowStatusService } from '@/services/admin/workflow-status.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  return await WorkflowStatusService.getGroupedStatuses();
});
