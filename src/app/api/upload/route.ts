export const dynamic = 'force-dynamic';
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { supabase } from "@/lib/supabase/client";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

export const POST = apiHandler(async (req) => {
    console.log("[UPLOAD-API] Received upload request");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const requestedBucket = (formData.get("bucket") as string) || "grn-documents";

    if (!file) {
        console.error("[UPLOAD-API] No file in formData");
        throw AppError.badRequest("No file uploaded");
    }

    console.log("[UPLOAD-API] File received:", {
        name: file.name,
        size: file.size,
        type: file.type,
        bucket: requestedBucket
    });

    // File type whitelisting and size limiting
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
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Try uploading to Supabase Storage first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cxhjerzucacqsxoumhio.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseKey = serviceRoleKey || anonKey;

    if (supabaseKey) {
        // If service role key exists, create a privileged client to bypass RLS
        let clientToUse = supabase;
        if (serviceRoleKey) {
            const { createClient } = await import('@supabase/supabase-js');
            clientToUse = createClient(supabaseUrl, serviceRoleKey);
        }

        const bucketNamesToTry = Array.from(new Set([requestedBucket, requestedBucket.toUpperCase(), requestedBucket.toLowerCase()]));

        for (const bucketCandidate of bucketNamesToTry) {
            try {
                console.log(`[UPLOAD-API] Attempting upload to Supabase bucket '${bucketCandidate}'...`);
                const { error: uploadError } = await clientToUse.storage
                    .from(bucketCandidate)
                    .upload(filename, buffer, {
                        contentType: file.type || 'application/octet-stream',
                        upsert: true
                    });

                if (uploadError) {
                    console.warn(`[UPLOAD-API] Supabase bucket '${bucketCandidate}' failed:`, uploadError.message);
                    continue;
                }

                const { data: publicUrlData } = clientToUse.storage
                    .from(bucketCandidate)
                    .getPublicUrl(filename);

                console.log(`[UPLOAD-API] Supabase upload success on bucket '${bucketCandidate}'! URL:`, publicUrlData.publicUrl);

                return Response.json({
                    url: publicUrlData.publicUrl,
                    filename: file.name,
                    size: file.size,
                    type: file.type,
                    storage: 'supabase'
                });
            } catch (supErr: unknown) {
                const errMessage = supErr instanceof Error ? supErr.message : String(supErr);
                console.warn(`[UPLOAD-API] Supabase upload failed on candidate '${bucketCandidate}':`, errMessage);
            }
        }
    } else {
        console.warn("[UPLOAD-API] Supabase key missing in environment. Falling back to local storage.");
    }

    // 2. Fallback to local file storage if Supabase fails or key is missing
    const rootDir = process.cwd();
    const uploadDir = path.join(rootDir, "uploads", requestedBucket);

    try {
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);
        
        const publicUrl = `/api/files/${requestedBucket}/${filename}`;
        console.log("[UPLOAD-API] Local upload success, returning URL:", publicUrl);

        return Response.json({
            url: publicUrl,
            filename: file.name,
            size: file.size,
            type: file.type,
            storage: 'local'
        });
    } catch (localErr: unknown) {
        const errMessage = localErr instanceof Error ? localErr.message : String(localErr);
        console.error("[UPLOAD-API] Local storage failed:", localErr);
        throw AppError.internal("Failed to save file to storage. " + errMessage);
    }
}, { rawResponse: true });
