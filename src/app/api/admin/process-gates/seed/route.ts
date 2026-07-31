import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';

export const POST = apiHandler(
  async () => {
    await ProcessGateAdminService.seedIndustrialTemplates();
    return { message: 'Industrial standard workflow templates loaded successfully' };
  },
  {
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    auditAction: 'SEED_INDUSTRIAL_GATE_TEMPLATES',
  }
);
