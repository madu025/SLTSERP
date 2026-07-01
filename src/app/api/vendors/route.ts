import { NextRequest, NextResponse } from "next/server";
import { VendorService } from "@/services/vendor.service";

// GET /api/vendors - List vendors with optional search
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");

        const vendors = await VendorService.getVendors(search);
        return NextResponse.json(vendors);
    } catch (error) {
        console.error("Error fetching vendors:", error);
        return NextResponse.json(
            { error: "Failed to fetch vendors" },
            { status: 500 }
        );
    }
}

// POST /api/vendors - Create a new vendor with auto-generated code
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const vendor = await VendorService.createVendor(body);
        return NextResponse.json(vendor, { status: 201 });
    } catch (error) {
        console.error("Error creating vendor:", error);
        const err = error as Error & { code?: string };
        const message = err.message;

        if (message === 'NAME_REQUIRED') {
            return NextResponse.json(
                { error: "Vendor name is required" },
                { status: 400 }
            );
        }

        if (message === 'VENDOR_EXISTS') {
            return NextResponse.json(
                { error: "A vendor with this name already exists" },
                { status: 400 }
            );
        }

        if (err.code === "P2002") {
            return NextResponse.json(
                { error: "A vendor with this code already exists" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: "Failed to create vendor" },
            { status: 500 }
        );
    }
}
