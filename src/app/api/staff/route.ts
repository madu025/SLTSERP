import { apiHandler } from '@/lib/api-handler';
import { StaffService } from '@/services/staff.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET all staff with hierarchy info and linked users
export const GET = apiHandler(async () => {
    return await StaffService.getStaff();
}, { rawResponse: true });

// POST create new staff member
export const POST = apiHandler(async (_request, _params, body) => {
    try {
        const staff = await StaffService.createStaff(body);
        return staff;
    } catch (error: any) {
        if (error?.code === 'P2002') {
            throw AppError.badRequest('Employee ID already exists');
        }
        throw error;
    }
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'STAFF_CREATE', entity: 'Staff' },
    rawResponse: true
});

// PUT to update staff details, hierarchy, or user assignment
export const PUT = apiHandler(async (_request, _params, body) => {
    const { id, ...updateFields } = body;
    if (!id) throw AppError.badRequest('Staff ID required');

    try {
        const updatedStaff = await StaffService.updateStaff(id, updateFields);
        return updatedStaff;
    } catch (error: any) {
        if (error?.message === 'CANNOT_REPORT_TO_SELF') {
            throw AppError.badRequest('Cannot report to self');
        }
        throw error;
    }
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
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
    } catch (error: any) {
        const msg = error?.message;
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
    roles: ['SUPER_ADMIN'],
    audit: { action: 'STAFF_DELETE', entity: 'Staff' },
    rawResponse: true
});
