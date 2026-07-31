export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';

export const POST = apiHandler(
  async () => {
    await ProcessGateAdminService.seedIndustrialTemplates();
    return { message: 'Industrial standard workflow templates loaded successfully' };
  },
  {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: {
      action: 'SEED_INDUSTRIAL_GATE_TEMPLATES',
      entity: 'PROCESS_GATE_POLICY',
    },
  }
);
