export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';
import { ROLE_GROUPS } from '@/config/roles';

export const POST = apiHandler(
  async () => {
    await ProcessGateAdminService.seedIndustrialTemplates();
    return { message: 'Industrial standard workflow templates loaded successfully' };
  },
  {
    roles: ROLE_GROUPS.CORE_ADMINS,
    audit: {
      action: 'SEED_INDUSTRIAL_GATE_TEMPLATES',
      entity: 'PROCESS_GATE_POLICY',
    },
  }
);
