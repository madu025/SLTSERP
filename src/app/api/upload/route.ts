export const dynamic = 'force-dynamic';
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { verifyJWT } from "@/lib/auth";
import { ContractorService } from "@/services/contractor/contractor.service";
import { TeamMemberService } from "@/services/hr/team-member.service";
import { StorageService } from "@/services/storage/storage.service";
import path from "path";

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
    // into StorageService, so only an explicit allowlist of legitimate ERP document categories is admitted.
    const ALLOWED_UPLOAD_BUCKETS: readonly string[] = [
        'grn-documents',
        'invoices',
        'tickets',
        'contracts',
        'contractors',
        'team-members',
        'pat',
        'device-audit',
        'inventory',
        'procurement',
        'documents',
        'general'
    ];
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
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.svg', '.xlsx', '.xls', '.csv'];
    
    if (!allowedExtensions.includes(ext)) {
        console.error("[UPLOAD-API] Blocked forbidden file extension:", ext);
        throw AppError.badRequest("Forbidden file type. Only images, PDFs, spreadsheets, and document files are allowed.");
    }

    if (file.size > 25 * 1024 * 1024) {
        console.error("[UPLOAD-API] Blocked oversized file:", file.size);
        throw AppError.badRequest("File size exceeds maximum allowed limit of 25MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Delegate document upload to unified StorageService (S3 primary with Supabase / Local fallbacks)
    try {
        const uploadResult = await StorageService.uploadFile({
            fileBuffer: buffer,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            folder: requestedBucket,
        });

        console.log(`[UPLOAD-API] Document saved successfully via ${uploadResult.storage}:`, uploadResult.url);

        return Response.json({
            url: uploadResult.url,
            key: uploadResult.key,
            filename: file.name,
            size: uploadResult.size,
            type: uploadResult.mimeType,
            storage: uploadResult.storage
        });
    } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        console.error("[UPLOAD-API] Storage service failure:", msg);
        throw AppError.internal("Failed to save file to storage. " + msg);
    }
}, { rawResponse: true });
