import { VendorService } from "@/services/vendor.service";
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";

export const dynamic = 'force-dynamic';

// GET /api/vendors - List vendors with optional search
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const vendors = await VendorService.getVendors(search);
    return vendors;
}, { rawResponse: true });

// POST /api/vendors - Create a new vendor with auto-generated code
export const POST = apiHandler(async (request, _params, body) => {
    try {
        const vendor = await VendorService.createVendor(body);
        return vendor;
    } catch (error: any) {
        const message = error.message;

        if (message === 'NAME_REQUIRED') {
            throw AppError.badRequest("Vendor name is required");
        }

        if (message === 'VENDOR_EXISTS') {
            throw AppError.badRequest("A vendor with this name already exists");
        }

        if (error.code === "P2002") {
            throw AppError.badRequest("A vendor with this code already exists");
        }

        throw error;
    }
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
    audit: { action: 'CREATE', entity: 'VENDOR' },
    rawResponse: true
});
