import { apiHandler } from '@/lib/api-handler';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SLTPortalAuthService } from '@/services/slt/slt-portal-auth.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const REGISTRY_FILE = path.join(process.cwd(), 'src/data/slt-boms.json');
const TMP_REGISTRY_FILE = path.join(os.tmpdir(), 'slt-boms.json');

interface BOMItem {
    bomRef: string;
    rtom: string;
    contractor: string;
    path: string;
}

function parseBOMHtml(html: string): BOMItem[] {
    const boms: BOMItem[] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | null;

    while ((match = trRegex.exec(html)) !== null) {
        const trContent = match[1];
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const tds: string[] = [];
        let tdMatch: RegExpExecArray | null;

        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
            const text = tdMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            tds.push(text);
        }

        if (tds.length >= 3) {
            const bomRef = tds[0];
            const rtom = tds[1];
            const contractor = tds[2];

            const onclickMatch = trContent.match(/bomDwnload\('([^']+)'\)/);
            const pathVal = onclickMatch ? onclickMatch[1] : bomRef;

            if (bomRef && (bomRef.toUpperCase().includes('BOM') || bomRef.toUpperCase().startsWith('BOM'))) {
                boms.push({ bomRef, rtom, contractor, path: pathVal });
            }
        }
    }

    return boms;
}

async function getCachedBoms(): Promise<BOMItem[]> {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'SLT_BOMS_REGISTRY' }
        });
        if (setting && Array.isArray(setting.value)) {
            return setting.value as unknown as BOMItem[];
        }
    } catch (dbErr) {
        console.warn('[SLT-REGISTRY] Failed to read BOMs from DB:', dbErr);
    }

    const targetFile = fs.existsSync(REGISTRY_FILE) ? REGISTRY_FILE : TMP_REGISTRY_FILE;
    if (fs.existsSync(targetFile)) {
        try {
            return JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
        } catch (e) {
            console.error('[SLT-REGISTRY] Failed to read cached BOM registry file:', e);
        }
    }
    return [];
}

async function saveBomsToStore(boms: BOMItem[]) {
    try {
        await prisma.systemSetting.upsert({
            where: { key: 'SLT_BOMS_REGISTRY' },
            update: { value: boms as unknown as object },
            create: { key: 'SLT_BOMS_REGISTRY', value: boms as unknown as object }
        });
    } catch (dbErr) {
        console.warn('[SLT-REGISTRY] Could not save BOMs to DB:', dbErr);
    }

    try {
        fs.writeFileSync(TMP_REGISTRY_FILE, JSON.stringify(boms, null, 2), 'utf-8');
    } catch {
        // Ignore read-only file system on Vercel
    }
}

export const GET = apiHandler(async () => {
    const cachedBoms: BOMItem[] = await getCachedBoms();
    let cookieSaved = false;
    let sltCookie = '';

    sltCookie = await SLTPortalAuthService.getOrRefreshCookie();
    cookieSaved = !!sltCookie;

    if (sltCookie) {
        try {
            console.log('[SLT-REGISTRY] Fetching live BOM list from SLT service portal...');
            const res = await fetch('https://serviceportal.slt.lk/iShamp/contr/dynamic_load?x=ftthbomload&z=SLTS', {
                headers: {
                    'Cookie': sltCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                next: { revalidate: 0 }
            });

            if (!res.ok) {
                throw new Error(`HTTP Error ${res.status}`);
            }

            const html = await res.text();

            if (html.includes('login') || html.includes('Username') || html.includes('Password')) {
                throw new Error('SESSION_EXPIRED');
            }

            const liveBoms = parseBOMHtml(html);

            if (liveBoms.length > 0) {
                await saveBomsToStore(liveBoms);
                return Response.json({ success: true, boms: liveBoms, cookieSaved, source: 'live' });
            }
        } catch (error: unknown) {
            const err = error as Error;
            console.error('[SLT-REGISTRY] Live BOM fetch failed, falling back to cache:', err.message);
            return Response.json({
                success: true,
                boms: cachedBoms,
                cookieSaved,
                source: 'cache',
                warning: err.message === 'SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'SLT_PORTAL_OFFLINE'
            });
        }
    }

    return Response.json({ success: true, boms: cachedBoms, cookieSaved, source: 'cache' });
}, { rawResponse: true });

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-extension-key',
        },
    });
}

const postSchema = z.object({
    action: z.string().optional(),
    cookie: z.string().optional(),
    boms: z.array(z.unknown()).optional()
});

export const POST = apiHandler(async (req, _params, body) => {
    const extensionKey = req.headers.get('x-extension-key');
    const extensionSecret = process.env.EXTENSION_SECRET || 'slt-bridge-secret-2026';
    const isExtension = extensionKey === extensionSecret;

    const userRole = req.headers.get('x-user-role');
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER'];
    const hasAllowedRole = userRole && allowedRoles.includes(userRole);

    if (!isExtension && !hasAllowedRole) {
        throw AppError.forbidden('Permission Denied: Unauthorized.');
    }

    const data = postSchema.parse(body);

    if (data.action === 'save-cookie') {
        if (data.cookie) {
            try {
                await prisma.systemSetting.upsert({
                    where: { key: 'SLT_PORTAL_COOKIE' },
                    update: { value: { cookie: data.cookie } },
                    create: { key: 'SLT_PORTAL_COOKIE', value: { cookie: data.cookie } }
                });
            } catch (dbErr) {
                console.warn('[SLT-REGISTRY] Could not save cookie to DB:', dbErr);
            }
        }
        return Response.json({ success: true, message: 'SLT cookie configuration saved successfully' }, {
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }

    const listToSave = (data.boms || body) as BOMItem[];
    if (!listToSave || !Array.isArray(listToSave)) {
        throw AppError.badRequest('Invalid payload: boms must be an array');
    }

    await saveBomsToStore(listToSave);
    return Response.json({ success: true, count: listToSave.length }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
}, { rawResponse: true });
