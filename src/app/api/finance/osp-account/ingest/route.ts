import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { OSPAccountIngestionService } from '@/services/finance/osp-account-ingestion.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async () => {
  const result = await OSPAccountIngestionService.ingestAll();
  return {
    success: true,
    message: 'OSP Account bulk data ingestion completed successfully.',
    data: result
  };
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS
});
