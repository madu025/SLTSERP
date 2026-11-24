import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { OspFloatService } from '@/services/finance/osp-float.service';
import { z } from 'zod';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';

export const dynamic = 'force-dynamic';

const saveSchema = z.object({
  siteOfficeId: databaseUuidSchema,
  type: z.enum(['PETTY_CASH', 'PROJECT_ADVANCE', 'FUEL', 'OTHER']),
  name: z.string().trim().min(1).max(120),
  limitAmount: z.number().finite().nonnegative(),
  maxDaysOutstanding: z.number().int().min(0).max(365).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();

// GET: the floats of the site offices with what is out and what is available
export const GET = apiHandler(async (_req, params) => {
  if (!params._userId) throw AppError.unauthorized('Authentication required');
  return { data: await OspFloatService.listFloats(params._userId) };
}, {});

// POST: create a float or change its limit (the finance approver)
export const POST = apiHandler(async (_req, params, body) => {
  if (!params._userId) throw AppError.unauthorized('Authentication required');
  return { message: 'Float saved', data: await OspFloatService.saveFloat(params._userId, body) };
}, { schema: saveSchema, permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE], audit: { action: 'SAVE', entity: 'OSP_FLOAT' } });
