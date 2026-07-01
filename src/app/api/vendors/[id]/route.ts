import { NextRequest, NextResponse } from "next/server";
import { VendorService } from "@/services/vendor.service";

type Params = Promise<{ id: string }>;

// GET /api/vendors/[id] - Get vendor details by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = await params;
        const vendor = await VendorService.getVendorById(id);
        
        if (!vendor) {
            return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
        }
        
        return NextResponse.json(vendor);
    } catch (error: unknown) {
        console.error("Error fetching vendor:", error);
        return NextResponse.json({ error: "Failed to fetch vendor" }, { status: 500 });
    }
}

// PUT /api/vendors/[id] - Update vendor details
export async function PUT(request: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const vendor = await VendorService.updateVendor(id, body);
        return NextResponse.json(vendor);
    } catch (error: unknown) {
        console.error("Error updating vendor:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to update vendor";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

// DELETE /api/vendors/[id] - Soft delete vendor
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
    try {
        const { id } = await params;
        const vendor = await VendorService.deleteVendor(id);
        return NextResponse.json({ message: "Vendor deactivated successfully", vendor });
    } catch (error: unknown) {
        console.error("Error deleting vendor:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to delete vendor";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
