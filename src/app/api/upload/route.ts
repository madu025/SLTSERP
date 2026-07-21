import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export const POST = apiHandler(async (req) => {
    console.log("[UPLOAD-API] Received upload request");

    const formData = await req.formData();
    console.log("[UPLOAD-API] FormData parsed");

    const file = formData.get("file") as File;

    if (!file) {
        console.error("[UPLOAD-API] No file in formData");
        throw AppError.badRequest("No file uploaded");
    }

    console.log("[UPLOAD-API] File received:", {
        name: file.name,
        size: file.size,
        type: file.type
    });

    // Backend security checks: File type whitelisting and size limiting
    const ext = (path.extname(file.name) || '.jpg').toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.svg'];
    
    if (!allowedExtensions.includes(ext)) {
        console.error("[UPLOAD-API] Blocked forbidden file extension:", ext);
        throw AppError.badRequest("Forbidden file type. Only images, PDFs, and document files are allowed.");
    }

    if (file.size > 10 * 1024 * 1024) {
        console.error("[UPLOAD-API] Blocked oversized file:", file.size);
        throw AppError.badRequest("File size exceeds maximum allowed limit of 10MB.");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
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
    } catch (dirError: unknown) {
        const err = dirError as { message?: string };
        console.error("[UPLOAD-API] Failed to create directory:", err.message);
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

    return Response.json({
        url: publicUrl,
        filename: file.name,
        size: file.size,
        type: file.type
    });
}, { rawResponse: true });
