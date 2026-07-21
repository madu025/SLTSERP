import { apiHandler } from '@/lib/api-handler';
import fs from 'fs';
import path from 'path';
import { SLTPortalAuthService } from '@/services/slt-portal-auth.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { requestContext } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

const REGISTRY_FILE = path.join(process.cwd(), 'src/data/slt-boms.json');
const CONFIG_FILE = path.join(process.cwd(), 'src/data/slt-config.json');

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

export const GET = apiHandler(async () => {
    let cachedBoms: BOMItem[] = [];
    let cookieSaved = false;
    let sltCookie = '';

    if (fs.existsSync(REGISTRY_FILE)) {
        try {
            cachedBoms = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
        } catch (e) {
            console.error('Failed to read cached BOM registry:', e);
        }
    }

    sltCookie = await SLTPortalAuthService.getOrRefreshCookie();
    cookieSaved = !!sltCookie;

    if (sltCookie) {
        try {
            console.log('Fetching live BOM list from SLT service portal...');
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
                const dir = path.dirname(REGISTRY_FILE);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(REGISTRY_FILE, JSON.stringify(liveBoms, null, 2), 'utf-8');
                return Response.json({ success: true, boms: liveBoms, cookieSaved, source: 'live' });
            }
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Live BOM fetch failed, falling back to cache:', err.message);
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
    boms: z.array(z.any()).optional()
}).catchall(z.any());

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

    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (data.action === 'save-cookie') {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ cookie: data.cookie }, null, 2), 'utf-8');
        return Response.json({ success: true, message: 'SLT cookie configuration saved successfully' }, {
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }

    const listToSave = data.boms || body;
    if (!listToSave || !Array.isArray(listToSave)) {
        throw AppError.badRequest('Invalid payload: boms must be an array');
    }

    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(listToSave, null, 2), 'utf-8');
    return Response.json({ success: true, count: listToSave.length }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
}, { rawResponse: true });
