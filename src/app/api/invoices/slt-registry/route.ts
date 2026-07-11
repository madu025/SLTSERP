import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SLTPortalAuthService } from '@/services/slt-portal-auth.service';

const REGISTRY_FILE = path.join(process.cwd(), 'src/data/slt-boms.json');
const CONFIG_FILE = path.join(process.cwd(), 'src/data/slt-config.json');

function parseBOMHtml(html: string) {
    const boms: Array<{ bomRef: string; rtom: string; contractor: string; path: string }> = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    
    while ((match = trRegex.exec(html)) !== null) {
        const trContent = match[1];
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const tds: string[] = [];
        let tdMatch;
        
        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
            const text = tdMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            tds.push(text);
        }
        
        if (tds.length >= 3) {
            const bomRef = tds[0];
            const rtom = tds[1];
            const contractor = tds[2];
            
            const onclickMatch = trContent.match(/bomDwnload\('([^']+)'\)/);
            const path = onclickMatch ? onclickMatch[1] : bomRef;
            
            if (bomRef && (bomRef.toUpperCase().includes('BOM') || bomRef.toUpperCase().startsWith('BOM'))) {
                boms.push({ bomRef, rtom, contractor, path });
            }
        }
    }
    
    return boms;
}

export async function GET() {
    let cachedBoms: any[] = [];
    let cookieSaved = false;
    let sltCookie = '';

    // Load cached list if it exists
    if (fs.existsSync(REGISTRY_FILE)) {
        try {
            cachedBoms = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
        } catch (e) {
            console.error('Failed to read cached BOM registry:', e);
        }
    }

    // Get or refresh SLT session cookie automatically
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
                next: { revalidate: 0 } // disable next.js fetch caching
            });

            if (!res.ok) {
                throw new Error(`HTTP Error ${res.status}`);
            }

            const html = await res.text();
            
            // Check if redirecting to login page
            if (html.includes('login') || html.includes('Username') || html.includes('Password')) {
                throw new Error('SESSION_EXPIRED');
            }

            const liveBoms = parseBOMHtml(html);

            if (liveBoms.length > 0) {
                // Ensure data directory exists
                const dir = path.dirname(REGISTRY_FILE);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                // Update cache
                fs.writeFileSync(REGISTRY_FILE, JSON.stringify(liveBoms, null, 2), 'utf-8');
                return NextResponse.json({ success: true, boms: liveBoms, cookieSaved, source: 'live' });
            }
        } catch (error: any) {
            console.error('Live BOM fetch failed, falling back to cache:', error.message);
            return NextResponse.json({ 
                success: true, 
                boms: cachedBoms, 
                cookieSaved, 
                source: 'cache',
                warning: error.message === 'SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'SLT_PORTAL_OFFLINE'
            });
        }
    }

    return NextResponse.json({ success: true, boms: cachedBoms, cookieSaved, source: 'cache' });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role, x-extension-key',
        },
    });
}

export async function POST(request: Request) {
    try {
        const extensionKey = request.headers.get('x-extension-key');
        const extensionSecret = process.env.EXTENSION_SECRET || 'slt-bridge-secret-2026';
        const isExtension = extensionKey === extensionSecret;

        const body = await request.json();
        const { action, cookie, boms } = body;

        // Ensure data directory exists
        const dir = path.dirname(REGISTRY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (action === 'save-cookie') {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify({ cookie }, null, 2), 'utf-8');
            return NextResponse.json({ success: true, message: 'SLT cookie configuration saved successfully' }, {
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        // Default: save scraped BOMs array
        const listToSave = boms || body;
        if (!listToSave || !Array.isArray(listToSave)) {
            return NextResponse.json(
                { success: false, message: 'Invalid payload: boms must be an array' },
                { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(listToSave, null, 2), 'utf-8');
        return NextResponse.json({ success: true, count: listToSave.length }, {
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    } catch (error: unknown) {
        console.error('Failed to save request payload:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to process request' },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}
