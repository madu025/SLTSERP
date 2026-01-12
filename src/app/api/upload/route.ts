import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

        // Generate unique filename to prevent overwrites
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const ext = path.extname(file.name);
        const filename = `${timestamp}-${randomString}${ext}`;

        console.log("[UPLOAD-API] Generated filename:", filename);

        // Create uploads directory structure
        const uploadDir = path.join(process.cwd(), "public", "uploads", "contractors");
        console.log("[UPLOAD-API] Upload directory:", uploadDir);

        try {
            await mkdir(uploadDir, { recursive: true });
            console.log("[UPLOAD-API] Directory created/verified");
        } catch (err) {
            console.log("[UPLOAD-API] Directory already exists or error:", err);
        }

        // Convert file to buffer and save
        console.log("[UPLOAD-API] Converting file to buffer...");
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = path.join(uploadDir, filename);

        console.log("[UPLOAD-API] Saving file to:", filePath);
        await writeFile(filePath, buffer);
        console.log("[UPLOAD-API] File saved successfully");

        // Return the public URL path (not the full file system path)
        const publicUrl = `/uploads/contractors/${filename}`;
        console.log("[UPLOAD-API] Returning public URL:", publicUrl);

        return NextResponse.json({
            url: publicUrl,
            filename: file.name,
            size: file.size,
            type: file.type
        });
    } catch (error: any) {
        console.error("[UPLOAD-API] Critical error:", error);
        console.error("[UPLOAD-API] Error stack:", error.stack);
        return NextResponse.json({
            error: "Upload failed",
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
