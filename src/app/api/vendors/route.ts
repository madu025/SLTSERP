import { VendorService } from "@/services/finance/vendor.service";
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { ROLE_GROUPS } from "@/config/roles";

export const dynamic = 'force-dynamic';

// GET /api/vendors - List vendors with optional search
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const vendors = await VendorService.getVendors(search);
    return vendors;
}, { rawResponse: true });

// POST /api/vendors - Create a new vendor with auto-generated code
export const POST = apiHandler(async (_request, _params, body) => {
    try {
        const vendor = await VendorService.createVendor(body as any);
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
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'CREATE', entity: 'VENDOR' },
    rawResponse: true
});
