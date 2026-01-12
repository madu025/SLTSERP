import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Generate unique filename to prevent overwrites
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const ext = path.extname(file.name);
        const filename = `${timestamp}-${randomString}${ext}`;

        // Create uploads directory structure
        const uploadDir = path.join(process.cwd(), "public", "uploads", "contractors");

        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (err) {
            // Directory might already exist, that's fine
        }

        // Convert file to buffer and save
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = path.join(uploadDir, filename);

        await writeFile(filePath, buffer);
        console.log(`[UPLOAD] File saved successfully: ${filename}`);

        // Return the public URL path (not the full file system path)
        const publicUrl = `/uploads/contractors/${filename}`;

        return NextResponse.json({
            url: publicUrl,
            filename: file.name,
            size: file.size,
            type: file.type
        });
    } catch (error: any) {
        console.error("Critical Upload Error:", error);
        return NextResponse.json({
            error: "Upload failed",
            details: error.message
        }, { status: 500 });
    }
}
