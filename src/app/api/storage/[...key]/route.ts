export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { StorageService } from '@/services/storage/storage.service';
import path from 'path';
import type { NextRequest } from 'next/server';

function contentTypeFor(key: string): string {
    switch (path.extname(key).toLowerCase()) {
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.pdf': return 'application/pdf';
        case '.json': return 'application/json';
        case '.csv': return 'text/csv';
        case '.txt': return 'text/plain';
        default: return 'application/octet-stream';
    }
}

/**
 * Authenticated object download proxy for Coolify S3/MinIO files.
 * Buckets remain private; callers never need a public MinIO bucket URL.
 */
const storageGetHandler = apiHandler(async (_request, params) => {
    if (!params._userId) {
        throw AppError.unauthorized('Authentication required to access stored files');
    }

    const keyParts = (params as { key?: string[] }).key;
    const key = Array.isArray(keyParts) ? keyParts.join('/') : '';
    if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
        throw AppError.badRequest('Invalid storage object key');
    }

    const object = await StorageService.downloadFile(key);
    return new Response(object.body as BodyInit, {
        headers: {
            'Content-Type': object.contentType || contentTypeFor(key),
            ...(object.contentLength ? { 'Content-Length': String(object.contentLength) } : {}),
            'Content-Disposition': 'inline',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}, { rawResponse: true });

// apiHandler's generic route metadata is string-keyed, while Next's catch-all
// route correctly exposes `key` as string[]. Keep the adapter typed at the
// Next route boundary without weakening the internal handler checks.
export const GET = storageGetHandler as unknown as (
    request: NextRequest,
    context: { params: Promise<{ key: string[] }> }
) => Promise<Response>;
