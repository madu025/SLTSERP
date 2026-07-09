import { apiHandler } from '@/lib/api-handler';
import { GISAITrainingService } from '@/services/gis/GISAITrainingService';

export const dynamic = 'force-dynamic';

// GET: Retrieve compiled OSP deviation metrics across all projects for AI Model Training
export const GET = apiHandler(async () => {
  const metrics = await GISAITrainingService.getAITrainingMetrics();
  return metrics;
}, {
  roles: ['ENGINEER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  audit: { action: 'READ', entity: 'GIS_ROUTE' }
});
