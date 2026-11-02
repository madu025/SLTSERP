import { getAuthenticatedUserId } from '@/lib/request-context';
 
import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor/contractor.service';
import { contractorSchema } from '@/lib/validations/contractor.schema';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Read scope derives from the shared CONTRACTOR_READERS group (single source
// of truth in src/config/roles.ts) — no duplicated role literals here

/**
 * GET: List all contractors
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
    }
);

/**
 * POST: Create a new contractor
 */
export const POST = apiHandler(
    async (req) => {
        const body = await req.json();
        return await ContractorService.createContractor(body);
    },
    {
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
    async (req) => {
        const body = await req.json();
        const { id, ...data } = body;
        return await ContractorService.updateContractor(id, data);
    },
    {
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
        audit: {
            action: 'DELETE',
            entity: 'Contractor'
        }
    }
);
