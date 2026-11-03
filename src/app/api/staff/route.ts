import { apiHandler } from '@/lib/api-handler';
import { StaffService, CreateStaffInput, UpdateStaffInput } from '@/services/hr/staff.service';
import { AppError } from '@/lib/error';
import { Role } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const staffFields = {
    name: z.string().trim().min(2).max(200),
    employeeId: z.string().trim().min(1).max(100),
    designation: z.nativeEnum(Role),
    reportsToId: z.string().min(1).max(100).optional().nullable(),
    opmcId: z.string().min(1).max(100).optional().nullable(),
    userId: z.string().min(1).max(100).optional().nullable(),
};
const createStaffSchema = z.object(staffFields).strict();
const updateStaffSchema = z.object(staffFields).partial().extend({ id: z.string().min(1).max(100) }).strict();
type CreateStaffRequest = z.infer<typeof createStaffSchema>;
type UpdateStaffRequest = z.infer<typeof updateStaffSchema>;

// GET all staff with hierarchy info and linked users
export const GET = apiHandler(async () => {
    return await StaffService.getStaff();
}, { rawResponse: true });

// POST create new staff member
export const POST = apiHandler<unknown, CreateStaffRequest>(async (_request, _params, body) => {
    try {
        const staff = await StaffService.createStaff(body as CreateStaffInput);
        return staff;
    } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === 'P2002') {
            throw AppError.badRequest('Employee ID already exists');
        }
        throw error;
    }
}, {
    schema: createStaffSchema,
    audit: { action: 'STAFF_CREATE', entity: 'Staff' },
    rawResponse: true
});

// PUT to update staff details, hierarchy, or user assignment
export const PUT = apiHandler<unknown, UpdateStaffRequest>(async (_request, _params, body) => {
    const id = body.id;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...updateFields } = body;
    if (!id) throw AppError.badRequest('Staff ID required');

    try {
        const updatedStaff = await StaffService.updateStaff(id, updateFields as UpdateStaffInput);
        return updatedStaff;
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'CANNOT_REPORT_TO_SELF') {
            throw AppError.badRequest('Cannot report to self');
        }
        throw error;
    }
}, {
    schema: updateStaffSchema,
    audit: { action: 'STAFF_UPDATE', entity: 'Staff' },
    rawResponse: true
});

// DELETE staff member
export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('Staff ID required');
    }

    try {
        await StaffService.deleteStaff(id);
        return { message: 'Staff deleted successfully' };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        if (msg && msg.startsWith('HAS_SUBORDINATES_')) {
            const count = msg.replace('HAS_SUBORDINATES_', '');
            throw AppError.badRequest(`Cannot delete staff member with ${count} subordinates. Reassign them first.`);
        }
        if (msg === 'HAS_LINKED_USER') {
            throw AppError.badRequest('Cannot delete staff with linked user. Unlink the user first.');
        }
        throw error;
    }
}, {
    audit: { action: 'STAFF_DELETE', entity: 'Staff' },
    rawResponse: true
});
