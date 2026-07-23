import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { MaterialExcelImportService } from '@/services/inventory/material-excel-import.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ImportSchema = z.object({
  filePath: z.string().min(1).default('D:/MyProject/SLTSERP/Material Report Summary -From  June.xlsx'),
  opmcId: z.string().optional(),
});

export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id');
  if (!userId) throw AppError.unauthorized('Authentication required');

  const result = await MaterialExcelImportService.importMaterialReport(
    body.filePath,
    body.opmcId,
    userId
  );

  return result;
}, {
  schema: ImportSchema,
  roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'],
  audit: { action: 'IMPORT', entity: 'PRE_ERP_MATERIAL_EXCEL' },
  rawResponse: true,
});
