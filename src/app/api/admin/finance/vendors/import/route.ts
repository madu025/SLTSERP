import { apiHandler } from '@/lib/api-handler';
import { VendorService } from '@/services/vendor.service';
import { z } from 'zod';

const importVendorSchema = z.array(z.object({
    code: z.string().min(1, 'Vendor code is required'),
    name: z.string().min(1, 'Vendor name is required'),
    contactPerson: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    registrationNo: z.string().optional().nullable(),
    brNumber: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    bankBranch: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    status: z.string().optional(),
    type: z.string().optional()
})).min(1, 'Invalid data format or empty array');

export const POST = apiHandler(async (_req, _params, body) => {
    const vendorsData = importVendorSchema.parse(body);

    const result = await VendorService.importBulk(vendorsData);

    return Response.json({
        message: 'Import complete',
        ...result
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
    audit: { action: 'IMPORT_VENDORS_BULK', entity: 'Finance' }
});
