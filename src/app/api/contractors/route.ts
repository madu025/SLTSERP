/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { contractorSchema } from '@/lib/validations/contractor.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET: List all contractors
 */
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const rtomId = searchParams.get('rtomId') || searchParams.get('opmcId');
    
    const userId = req.headers.get('x-user-id') || undefined;
    const role = req.headers.get('x-user-role') || undefined;

    const opmcIds = rtomId ? [rtomId] : undefined;

    return await ContractorService.getAllContractors({
        opmcIds,
        page,
        limit,
        userId,
        userRole: role
    });
});

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
        roles: ['ADMIN', 'SUPER_ADMIN', 'OFFICE_ADMIN'],
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
        roles: ['ADMIN', 'SUPER_ADMIN', 'OFFICE_ADMIN', 'AREA_MANAGER'],
        audit: {
            action: 'UPDATE',
            entity: 'Contractor'
        }
    }
);

/**
 * DELETE: Delete a contractor
 */
export const DELETE = apiHandler(
    async (req) => {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) throw new Error('ID_REQUIRED');
        
        await ContractorService.deleteContractor(id);
        return { message: 'Deleted successfully' };
    },
    {
        roles: ['ADMIN', 'SUPER_ADMIN'],
        audit: {
            action: 'DELETE',
            entity: 'Contractor'
        }
    }
);
