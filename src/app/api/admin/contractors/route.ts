/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { contractorSchema } from '@/lib/validations/contractor.schema';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_READ_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'OFFICE_ADMIN',
    'OFFICE_ADMIN_ASSISTANT',
    'OSP_MANAGER',
    'AREA_MANAGER',
    'FINANCE_MANAGER',
    'FINANCE_ASSISTANT',
    'SITE_OFFICE_STAFF',
    'ENGINEER',
    'ASSISTANT_ENGINEER',
    'AREA_COORDINATOR',
    'MANAGER',
    'QC_OFFICER'
];

/**
 * GET: List all contractors for Admin ERP
 */
export const GET = apiHandler(
    async (req) => {
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
    },
    {
        roles: ALLOWED_READ_ROLES
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
        roles: ['ADMIN', 'SUPER_ADMIN', 'OFFICE_ADMIN'],
        audit: {
            action: 'DELETE',
            entity: 'Contractor'
        }
    }
);
