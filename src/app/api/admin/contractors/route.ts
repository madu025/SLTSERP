import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor/contractor.service';
import { contractorSchema } from '@/lib/validations/contractor.schema';
import { AppError } from '@/lib/error';
import type { ContractorUpdateData } from '@/types/contractor/contractor.types';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

/**
 * GET: List all contractors for Admin ERP
 */
export const GET = apiHandler(
    async (req) => {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const rtomId = searchParams.get('rtomId') || searchParams.get('opmcId');
        
        const userId = getAuthenticatedUserId() || undefined;
        const opmcIds = rtomId ? [rtomId] : undefined;

        return await ContractorService.getAllContractors({
            opmcIds,
            page,
            limit,
            userId
        });
    },
    {
        permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
    }
);

/**
 * POST: Create a new contractor
 */
export const POST = apiHandler(
    async (_req, _params, body) => {
        return await ContractorService.createContractor(body as ContractorUpdateData);
    },
    {
        permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
        schema: contractorSchema,
        audit: {
            action: 'CREATE',
            entity: 'Contractor'
        }
    }
);

/**
 * PUT: Update an existing contractor
 */
export const PUT = apiHandler(
    async (_req, _params, body) => {
        const { id, ...data } = body as ContractorUpdateData & { id?: string };
        if (!id) throw AppError.badRequest('Contractor ID is required');
        return await ContractorService.updateContractor(id, data);
    },
    {
        permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
        schema: contractorSchema,
        audit: {
            action: 'UPDATE',
            entity: 'Contractor'
        }
    }
);

/**
 * DELETE: Delete a contractor (Soft-deactivates if related records exist)
 */
export const DELETE = apiHandler(
    async (req) => {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) throw AppError.badRequest('ID_REQUIRED');

        const result = await ContractorService.deleteContractor(id);
        return {
            success: true,
            ...result
        };
    },
    {
        permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
        audit: {
            action: 'DELETE',
            entity: 'Contractor'
        }
    }
);
