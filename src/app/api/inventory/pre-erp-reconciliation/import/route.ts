import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { MaterialExcelImportService } from '@/services/inventory/material-excel-import.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ImportSchema = z.object({
  opmcId: z.string().optional(),
});

export const POST = apiHandler(async (_req, params, body) => {
  const userId = params._userId;
  if (!userId) throw AppError.unauthorized('Authentication required');

  // The legacy workbook is a server-side file chosen by the deployment, never by the caller (a client-supplied
  // path would let any inventory writer make the server open arbitrary files).
  const filePath = process.env.PRE_ERP_IMPORT_FILE;
  if (!filePath) throw AppError.badRequest('PRE_ERP_IMPORT_FILE_NOT_CONFIGURED: the legacy Excel import file is not set up on this server');

  const result = await MaterialExcelImportService.importMaterialReport(
    filePath,
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
