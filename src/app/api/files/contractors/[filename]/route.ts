import { apiHandler } from '@/lib/api-handler';
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async (_req, params) => {
    const { filename } = await params;
    const safeFilename = path.basename(filename);
    
    // Resolve path to the secure uploads directory
    const rootDir = process.cwd();
    const filePath = path.join(rootDir, 'uploads', 'contractors', safeFilename);

    console.log('[FILES-API] Attempting to serve file:', filePath);

    // Check if file exists
    if (!existsSync(filePath)) {
        console.error('[FILES-API] File not found:', filePath);
        throw AppError.notFound('File not found');
    }

    // Read the file buffer
    const buffer = await readFile(filePath);

    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    // Return the file with correct headers
    return new NextResponse(buffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}, {
    rawResponse: true
});
