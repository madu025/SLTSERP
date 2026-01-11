import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique name
        const ext = file.name.split('.').pop() || 'jpg'; // Fallback ext
        const filename = `${crypto.randomUUID()}.${ext}`;

        // Ensure directory exists
        const uploadDir = join(process.cwd(), "public/uploads/contractors");
        await mkdir(uploadDir, { recursive: true });

        const path = join(uploadDir, filename);
        await writeFile(path, buffer);

        const url = `/uploads/contractors/${filename}`;
        return NextResponse.json({ url });
    } catch (error: any) {
        console.error("Critical Upload Error:", error);
        return NextResponse.json({
            error: "Upload failed",
            details: error.message
        }, { status: 500 });
    }
}
