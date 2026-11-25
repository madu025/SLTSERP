// Lists API route handlers that no capability guards: no `permissions` in apiHandler and no automatic capability from route-capabilities.ts.
// Such a handler is open to every signed-in user (or to the public, when the route is on the public list in the middleware).
// usage: pnpm exec tsx scripts/route-guard-scan.ts
import fs from 'node:fs';
import path from 'node:path';
import { resolveRouteCapability } from '../src/lib/route-capabilities';

const METHODS = 'GET|POST|PUT|PATCH|DELETE';

const walk = (d: string, o: string[] = []): string[] => {
    for (const e of fs.readdirSync(d)) {
        const p = path.join(d, e);
        if (fs.statSync(p).isDirectory()) walk(p, o);
        else if (p.endsWith('route.ts')) o.push(p);
    }
    return o;
};

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export interface UnguardedRoute { method: string; url: string; file: string }

/** A handler is explicitly guarded by `permissions: [ ... ]`, or `permissions: NAME` where NAME is declared in the file as a list; comments and schema fields called `permissions` do not count. */
function isExplicitlyGuarded(block: string, fileText: string): boolean {
    const code = stripComments(block);
    if (/\bpermissions\s*:\s*\[/.test(code)) return true;
    const ref = code.match(/\bpermissions\s*:\s*([A-Za-z_]\w*)\s*[,}\n]/);
    if (ref && new RegExp('const\\s+' + ref[1] + '\\b[^=]*=\\s*\\[').test(stripComments(fileText))) return true;
    // a deliberately public handler, or one that authenticates itself
    return /\bpublicRoute\s*:\s*true\b/.test(code) || /allowAnonymous|skipAuth|requireAuth\s*:\s*false/.test(code);
}

/** The unguarded handlers of one route file: its text and its url (with [params]). */
export function findUnguarded(text: string, url: string, file = ''): UnguardedRoute[] {
    const out: UnguardedRoute[] = [];
    const concrete = url.replace(/\[[^\]]+\]/g, 'x');
    // `export const GET = ...`, `export async function GET(...)`, `export function GET(...)`
    const handlers = [...text.matchAll(new RegExp(`export\\s+(?:const|(?:async\\s+)?function)\\s+(${METHODS})\\b`, 'g'))];
    handlers.forEach((m, idx) => {
        const start = m.index ?? 0;
        const end = idx + 1 < handlers.length ? (handlers[idx + 1].index ?? text.length) : text.length;
        const block = text.slice(start, end);
        if (!isExplicitlyGuarded(block, text) && !resolveRouteCapability(concrete, m[1])) out.push({ method: m[1], url, file });
    });
    // `export { handler as GET }`: the handler body is elsewhere in the file, so the whole file is judged
    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const alias of m[1].matchAll(new RegExp(`\\bas\\s+(${METHODS})\\b`, 'g'))) {
            if (!isExplicitlyGuarded(text, text) && !resolveRouteCapability(concrete, alias[1])) out.push({ method: alias[1], url, file });
        }
    }
    return out;
}

export function scanRoutes(): UnguardedRoute[] {
    const out: UnguardedRoute[] = [];
    for (const f of walk('src/app/api')) {
        const url = '/' + path.relative('src/app', path.dirname(f)).split(path.sep).join('/');
        out.push(...findUnguarded(fs.readFileSync(f, 'utf8'), url, f.split(path.sep).join('/')));
    }
    return out;
}

if (process.argv[1]?.endsWith('route-guard-scan.ts')) {
    const r = scanRoutes();
    console.log('unguarded handlers', r.length);
    for (const x of r) console.log(x.method.padEnd(6), x.url);
}
