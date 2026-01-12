import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
    console.log("[UPLOAD-API] Received upload request");

    try {
        const formData = await request.formData();
        console.log("[UPLOAD-API] FormData parsed");

        const file = formData.get("file") as File;

        if (!file) {
            console.error("[UPLOAD-API] No file in formData");
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        console.log("[UPLOAD-API] File received:", {
            name: file.name,
            size: file.size,
            type: file.type
        });

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const ext = path.extname(file.name) || '.jpg';
        const filename = `${timestamp}-${randomString}${ext}`;

        // Resolve absolute path to public/uploads/contractors
        const publicDir = path.join(process.cwd(), "public");
        const uploadDir = path.join(publicDir, "uploads", "contractors");

        console.log("[UPLOAD-API] Target directory:", uploadDir);

        // Ensure directory exists
        if (!existsSync(uploadDir)) {
            console.log("[UPLOAD-API] Directory does not exist, creating...");
            await mkdir(uploadDir, { recursive: true });
            console.log("[UPLOAD-API] Directory created successfully");
        } else {
            console.log("[UPLOAD-API] Directory already exists");
        }

        // Convert file to buffer and save
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = path.join(uploadDir, filename);

        console.log("[UPLOAD-API] Attempting to write file to:", filePath);
        await writeFile(filePath, buffer);
        console.log("[UPLOAD-API] File written successfully");

        // Return the public URL path
        const publicUrl = `/uploads/contractors/${filename}`;
        console.log("[UPLOAD-API] Success, returning URL:", publicUrl);

        return NextResponse.json({
            url: publicUrl,
            filename: file.name,
            size: file.size,
            type: file.type
        });
    } catch (error: any) {
        console.error("[UPLOAD-API] Fatal error during upload:", error);
        return NextResponse.json({
            error: "Upload failed",
            details: error.message,
            code: error.code
        }, { status: 500 });
    }
}
