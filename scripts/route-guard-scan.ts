// Lists API route handlers that no capability guards: no `permissions` in apiHandler and no automatic capability from route-capabilities.ts.
// Such a handler is open to every signed-in user (or to the public, when the route is on the public list in the middleware).
// usage: pnpm exec tsx scripts/route-guard-scan.ts
import fs from 'node:fs';
import path from 'node:path';
import { resolveRouteCapability } from '../src/lib/route-capabilities';

const walk = (d: string, o: string[] = []): string[] => {
    for (const e of fs.readdirSync(d)) {
        const p = path.join(d, e);
        if (fs.statSync(p).isDirectory()) walk(p, o);
        else if (p.endsWith('route.ts')) o.push(p);
    }
    return o;
};

export interface UnguardedRoute { method: string; url: string; file: string }

export function scanRoutes(): UnguardedRoute[] {
    const out: UnguardedRoute[] = [];
    for (const f of walk('src/app/api')) {
        const text = fs.readFileSync(f, 'utf8');
        const url = '/' + path.relative('src/app', path.dirname(f)).split(path.sep).join('/');
        const concrete = url.replace(/\[[^\]]+\]/g, 'x');
        const handlers = [...text.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)];
        handlers.forEach((m, idx) => {
            const start = m.index ?? 0;
            const end = idx + 1 < handlers.length ? (handlers[idx + 1].index ?? text.length) : text.length;
            const block = text.slice(start, end);
            const explicit = /permissions\s*:/.test(block) || /\bpublic\s*:\s*true\b/.test(block) || /allowAnonymous|skipAuth|requireAuth\s*:\s*false/.test(block);
            const auto = resolveRouteCapability(concrete, m[1]);
            if (!explicit && !auto) out.push({ method: m[1], url, file: f.split(path.sep).join('/') });
        });
    }
    return out;
}

if (process.argv[1]?.endsWith('route-guard-scan.ts')) {
    const r = scanRoutes();
    console.log('unguarded handlers', r.length);
    for (const x of r) console.log(x.method.padEnd(6), x.url);
}
