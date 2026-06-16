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

        // Resolve path to /app/uploads/contractors (MUCH MORE SECURE)
        // We move it OUT of the public folder so it's not directly accessible via web URL
        const rootDir = process.cwd();
        const uploadDir = path.join(rootDir, "uploads", "contractors");

        console.log("[UPLOAD-API] Secure target directory:", uploadDir);

        // Ensure directory exists with better error handling
        try {
            if (!existsSync(uploadDir)) {
                console.log("[UPLOAD-API] Directory does not exist, attempting creation...");
                await mkdir(uploadDir, { recursive: true });
                console.log("[UPLOAD-API] Directory structure created successfully");
            }
        } catch (dirError: any) {
            console.error("[UPLOAD-API] Failed to create directory:", dirError.message);
            // We don't throw here, we'll try to write anyway in case it was a race condition 
            // where folder exists but existsSync failed
        }

        // Convert file to buffer and save
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = path.join(uploadDir, filename);

        console.log("[UPLOAD-API] Attempting to write file to:", filePath);
        await writeFile(filePath, buffer);
        console.log("[UPLOAD-API] File written successfully");

        // Return the secure API URL path
        const publicUrl = `/api/files/contractors/${filename}`;
        console.log("[UPLOAD-API] Success, returning secure URL:", publicUrl);

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
