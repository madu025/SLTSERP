export const dynamic = 'force-dynamic';
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { supabase } from "@/lib/supabase/client";
import { verifyJWT } from "@/lib/auth";
import { ContractorService } from "@/services/contractor/contractor.service";
import { TeamMemberService } from "@/services/hr/team-member.service";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

/**
 * Upload authentication (fail-closed). This endpoint stays in the middleware
 * publicPaths ONLY because two anonymous token-driven flows depend on it
 * (/contractor-upload/[token], /team-upload/[token] and the public contractor
 * registration form). The middleware therefore cannot gate it with a session
 * JWT — instead the route itself enforces authentication:
 *
 *   1. A valid staff session JWT (cookie `token` or Authorization Bearer), OR
 *   2. A valid scoped public upload token submitted in formData:
 *        publicToken + tokenType in { contractor | team | contractor-registration }
 *      validated against the same services the public pages already use.
 *
 * Anything else is rejected with 401. Anonymous unrestricted uploads are gone.
 */
const PUBLIC_TOKEN_TYPES = ['contractor', 'team', 'contractor-registration'] as const;
type PublicTokenType = typeof PUBLIC_TOKEN_TYPES[number];

async function verifySessionJwt(req: Request): Promise<boolean> {
    // 1. Authorization header (scripts / external integrations)
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
        const bearer = authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader.startsWith('Token ')
                ? authHeader.substring(6)
                : '';
        if (bearer && await verifyJWT(bearer)) return true;
    }

    // 2. Session cookie (web app)
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
        const match = cookieHeader.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('token='));
        const token = match ? decodeURIComponent(match.substring('token='.length)) : '';
        if (token && await verifyJWT(token)) return true;
    }

    return false;
}

async function verifyPublicUploadToken(formData: FormData): Promise<boolean> {
    const publicToken = formData.get('publicToken');
    const tokenType = formData.get('tokenType');
    if (typeof publicToken !== 'string' || publicToken.length === 0) return false;
    if (typeof tokenType !== 'string' || !PUBLIC_TOKEN_TYPES.includes(tokenType as PublicTokenType)) return false;

    try {
        switch (tokenType as PublicTokenType) {
            case 'contractor':
                await ContractorService.verifyUploadToken(publicToken);
                return true;
            case 'team':
                await TeamMemberService.verifyUploadToken(publicToken);
                return true;
            case 'contractor-registration':
                await ContractorService.getContractorByToken(publicToken);
                return true;
        }
    } catch {
        return false;
    }
    return false;
}

export const POST = apiHandler(async (req) => {
    console.log("[UPLOAD-API] Received upload request");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const requestedBucket = (formData.get("bucket") as string) || "grn-documents";

    // Strict bucket validation (fail-closed): the client-supplied bucket flows
    // into Supabase storage.from() and a local filesystem path, so only an
    // explicit allowlist of buckets actually used by callers is admitted.
    // Grepped call sites (/api/upload): src/app/inventory/grn sends
    // 'grn-documents'; every other caller relies on the 'grn-documents'
    // default above. Path traversal sequences are rejected outright.
    const ALLOWED_UPLOAD_BUCKETS: readonly string[] = ['grn-documents'];
    if (
        requestedBucket.includes('..') ||
        requestedBucket.includes('/') ||
        requestedBucket.includes('\\') ||
        !ALLOWED_UPLOAD_BUCKETS.includes(requestedBucket)
    ) {
        console.warn("[UPLOAD-API] Blocked invalid bucket name:", requestedBucket);
        throw AppError.badRequest("Invalid bucket name");
    }

    if (!file) {
        console.error("[UPLOAD-API] No file in formData");
        throw AppError.badRequest("No file uploaded");
    }

    // Fail-closed authentication gate: staff session JWT or scoped public upload token
    const hasSession = await verifySessionJwt(req);
    if (!hasSession) {
        const hasValidPublicToken = await verifyPublicUploadToken(formData);
        if (!hasValidPublicToken) {
            console.warn("[UPLOAD-API] Blocked unauthenticated upload attempt");
            throw AppError.unauthorized("Authentication required to upload files");
        }
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
