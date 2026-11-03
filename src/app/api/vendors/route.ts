import { VendorService } from "@/services/finance/vendor.service";
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const vendorCreateSchema = z.object({
    name: z.string().trim().min(1).max(200),
    contactPerson: optionalText(200),
    email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
    phone: optionalText(50),
    address: optionalText(500),
    registrationNo: optionalText(100),
    brNumber: optionalText(100),
    bankName: optionalText(200),
    bankBranch: optionalText(200),
    bankAccountNo: optionalText(100),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    type: optionalText(50),
    paymentTerms: optionalText(100),
    rating: z.union([z.number().int().min(0).max(5), z.string().trim().max(10)]).optional().nullable(),
    notes: optionalText(5000),
}).strict();
type VendorCreateRequest = z.infer<typeof vendorCreateSchema>;

// GET /api/vendors - List vendors with optional search
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const vendors = await VendorService.getVendors(search);
    return vendors;
}, { rawResponse: true });

// POST /api/vendors - Create a new vendor with auto-generated code
export const POST = apiHandler<unknown, VendorCreateRequest>(async (_request, _params, body) => {
    try {
        const vendor = await VendorService.createVendor(body);
        return vendor;
    } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        const message = err.message;

        if (message === 'NAME_REQUIRED') {
            throw AppError.badRequest("Vendor name is required");
        }

        if (message === 'VENDOR_EXISTS') {
            throw AppError.badRequest("A vendor with this name already exists");
        }

        if (err.code === "P2002") {
            throw AppError.badRequest("A vendor with this code already exists");
        }

        throw error;
    }
}, {
    schema: vendorCreateSchema,
    audit: { action: 'CREATE', entity: 'VENDOR' },
    rawResponse: true
});
