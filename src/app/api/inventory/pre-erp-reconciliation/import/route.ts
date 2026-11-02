import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { MaterialExcelImportService } from '@/services/inventory/material-excel-import.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ImportSchema = z.object({
  filePath: z.string().min(1).default('D:/MyProject/SLTSERP/Material Report Summary -From  June.xlsx'),
  opmcId: z.string().optional(),
});

export const POST = apiHandler(async (_req, params, body) => {
  const userId = params._userId;
  if (!userId) throw AppError.unauthorized('Authentication required');

  const result = await MaterialExcelImportService.importMaterialReport(
    body.filePath,
    body.opmcId,
    userId
  );

  return result;
}, {
  schema: ImportSchema,
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'IMPORT', entity: 'PRE_ERP_MATERIAL_EXCEL' },
  rawResponse: true,
});
