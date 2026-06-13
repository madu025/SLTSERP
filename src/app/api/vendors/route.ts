import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vendors - List vendors with optional search
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { contactPerson: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
            ];
        }

        const vendors = await prisma.vendor.findMany({
            where,
            orderBy: { name: "asc" },
        });

        return NextResponse.json(vendors);
    } catch (error: any) {
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
        const {
            name,
            contactPerson,
            email,
            phone,
            address,
            registrationNo,
            brNumber,
            bankName,
            bankBranch,
            bankAccountNo,
            status,
            type,
            paymentTerms,
            rating,
            notes,
        } = body;

        // Validate required fields
        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: "Vendor name is required" },
                { status: 400 }
            );
        }

        // Check for unique name (case-insensitive)
        const existingVendor = await prisma.vendor.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
        });

        if (existingVendor) {
            return NextResponse.json(
                { error: "A vendor with this name already exists" },
                { status: 400 }
            );
        }

        // Auto-generate vendor code "VND-XXXXX" (incrementing)
        const lastVendor = await prisma.vendor.findFirst({
            orderBy: { code: "desc" },
            select: { code: true },
        });

        let nextCode: string;
        if (lastVendor && lastVendor.code) {
            const lastNumber = parseInt(lastVendor.code.replace("VND-", ""), 10);
            const nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
            nextCode = "VND-" + String(nextNumber).padStart(5, "0");
        } else {
            nextCode = "VND-00001";
        }

        const vendor = await prisma.vendor.create({
            data: {
                code: nextCode,
                name: name.trim(),
                contactPerson: contactPerson || null,
                email: email || null,
                phone: phone || null,
                address: address || null,
                registrationNo: registrationNo || null,
                brNumber: brNumber || null,
                bankName: bankName || null,
                bankBranch: bankBranch || null,
                bankAccountNo: bankAccountNo || null,
                status: status || "ACTIVE",
                type: type || "SUPPLIER",
                paymentTerms: paymentTerms || null,
                rating: rating != null ? parseInt(rating, 10) : null,
                notes: notes || null,
            },
        });

        return NextResponse.json(vendor, { status: 201 });
    } catch (error: any) {
        console.error("Error creating vendor:", error);
        if (error.code === "P2002") {
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
