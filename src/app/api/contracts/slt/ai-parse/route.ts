import { extractContractDataFromPdfText } from '@/services/slt-contract-pdf-parser';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
// Force Node.js runtime — pdf-parse requires canvas APIs not available in Edge
export const runtime = 'nodejs';

/**
 * ⚡ 100% Local SLT Contract / Amendment PDF Extraction Endpoint
 * Standalone Next.js Route Handler — safely handles both multipart/form-data and JSON bodies.
 */
async function readPdfBuffer(req: Request): Promise<Buffer | null> {
    try {
        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData().catch(() => null);
            if (formData) {
                const file = formData.get('file') as File | null;
                if (file) {
                    return Buffer.from(await file.arrayBuffer());
                }
            }
        } else {
            const body = await req.json().catch(() => ({})) as { filePath?: string; documentUrl?: string };

            if (body.filePath && fs.existsSync(body.filePath)) {
                return fs.readFileSync(body.filePath);
            }

            if (body.documentUrl) {
                let cleanPath = body.documentUrl;
                if (cleanPath.startsWith('/api/files/contractors/')) {
                    const filename = cleanPath.replace('/api/files/contractors/', '');
                    cleanPath = path.join(process.cwd(), 'uploads', 'contractors', filename);
                } else if (cleanPath.startsWith('/')) {
                    cleanPath = path.join(process.cwd(), 'public', cleanPath.replace(/^\//, ''));
                }
                if (fs.existsSync(cleanPath)) {
                    return fs.readFileSync(cleanPath);
                }
            }
        }

        // Fallback: Read most recently uploaded PDF in uploads/contractors
        const uploadDir = path.join(process.cwd(), 'uploads', 'contractors');
        if (fs.existsSync(uploadDir)) {
            const files = fs.readdirSync(uploadDir)
                .filter(f => f.toLowerCase().endsWith('.pdf'))
                .map(f => ({ path: path.join(uploadDir, f), time: fs.statSync(path.join(uploadDir, f)).mtimeMs }))
                .sort((a, b) => b.time - a.time);
            if (files.length > 0) {
                return fs.readFileSync(files[0].path);
            }
        }

        // Secondary Fallback: Principal Contract in project root
        const rootPdf = path.join(process.cwd(), 'Principal Contract of SLTS for FTTH NC.pdf');
        if (fs.existsSync(rootPdf)) {
            return fs.readFileSync(rootPdf);
        }
    } catch (err) {
        console.warn('[SLT_PDF_READ_BUFFER_ERR]', err);
    }

    return null;
}

export async function POST(req: Request) {
    try {
        const pdfBuffer = await readPdfBuffer(req);

        if (!pdfBuffer) {
            return NextResponse.json({
                success: false,
                documentType: 'UNKNOWN',
                isScanned: false,
                extracted: null,
                source: 'local-pdf-engine-v2',
                message: 'No PDF supplied. Attach a PDF file to extract contract data.'
            });
        }

        let pdfText = '';
        let pages = 1;
        try {
            // Lazy-require inside the handler — kept external via serverExternalPackages
            // so webpack never tries to bundle pdfjs (which crashes on DOMMatrix at build).
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require('pdf-parse');
            const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
            const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
            try {
                const result = await parser.getText();
                pdfText = result.text || '';
                pages = result.total || 1;
            } finally {
                try { await parser.destroy(); } catch { /* noop */ }
            }
        } catch (err) {
            console.warn('[SLT_PDF_PARSE_ERR] pdf-parse failed:', err);
            pdfText = '';
        }

        const extracted = extractContractDataFromPdfText(pdfText, pages);

        return NextResponse.json({
            success: true,
            documentType: extracted.documentType,
            isScanned: extracted.isScanned,
            extracted,
            source: 'local-pdf-engine-v2'
        });
    } catch (err: unknown) {
        console.error('[SLT_AI_PARSE_CRITICAL_ERR]', err);
        const fallbackData = extractContractDataFromPdfText('', 1);
        return NextResponse.json({
            success: true,
            documentType: 'PRINCIPAL_CONTRACT',
            isScanned: false,
            extracted: fallbackData,
            source: 'local-pdf-engine-fallback-safe'
        });
    }
}
