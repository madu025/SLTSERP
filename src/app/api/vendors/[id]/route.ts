import { VendorService } from "@/services/vendor.service";
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";

export const dynamic = 'force-dynamic';

// GET /api/vendors/[id] - Get vendor details by ID
export const GET = apiHandler(async (request, params) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const vendor = await VendorService.getVendorById(id);
    
    if (!vendor) {
        throw AppError.notFound("Vendor not found");
    }
    
    return vendor;
}, { rawResponse: true });

// PUT /api/vendors/[id] - Update vendor details
export const PUT = apiHandler(async (request, params, body) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const vendor = await VendorService.updateVendor(id, body);
    return vendor;
}, { rawResponse: true });

// DELETE /api/vendors/[id] - Soft delete vendor
export const DELETE = apiHandler(async (request, params) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const vendor = await VendorService.deleteVendor(id);
    return { message: "Vendor deactivated successfully", vendor };
}, { rawResponse: true });
