/* eslint-disable @typescript-eslint/no-explicit-any */
// For every page: the roles that can open it, against the capability of each API route the page calls (from the bootstrap grants).
// A role that opens the page but lacks every capability of an API it calls sees a broken screen. usage: pnpm exec tsx scripts/page-api-audit.ts
import fs from 'node:fs'; import path from 'node:path';
import { Role } from '@prisma/client';
import { resolvePageCapability } from '../src/config/page-capabilities';
import { resolveRouteCapability } from '../src/lib/route-capabilities';
import { RBAC_PERMISSIONS } from '../src/config/rbac-permissions';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../src/config/rbac-bootstrap';

const grants = CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>;
const roles = [...new Set([...Object.values(grants), ...Object.values(MODULE_DESIGNATION_GRANTS)].flat())].sort();
const BASE_ROLES = Object.values(Role).sort((a, b) => b.length - a.length);
const baseOf = (r: string) => BASE_ROLES.find((b) => r === b || r.endsWith('_' + b));
const grantsOf = (r: string): Set<string> => { const own = ownGrants(r); const b = baseOf(r); if (b && b !== r) for (const g of ownGrants(b)) own.add(g); return own; };
const ownGrants = (r: string) => new Set([...Object.entries(grants).filter(([, x]) => x.includes(r)).map(([p]) => p), ...Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, x]) => x.includes(r)).map(([p]) => p)]);
const CODE_BY_KEY = RBAC_PERMISSIONS as Record<string, string>;

const walk = (d: string, out: string[] = []) => { for (const e of fs.readdirSync(d)) { const p = path.join(d, e); const st = fs.statSync(p); if (st.isDirectory()) walk(p, out); else out.push(p); } return out; };
const pages = walk('src/app').filter((f) => f.endsWith(path.join('page.tsx')) && !f.includes(path.join('src', 'app', 'api')));
const routeFiles = walk('src/app/api').filter((f) => f.endsWith('route.ts'));
const routeUrl = (f: string) => '/' + path.relative('src/app', path.dirname(f)).split(path.sep).join('/');
const matchRoute = (url: string): string | undefined => {
    const clean = url.split('?')[0].replace(/\/+$/, '');
    let best: string | undefined;
    for (const f of routeFiles) {
        const pattern = routeUrl(f).replace(/\[[^\]]+\]/g, '[^/]+');
        if (new RegExp('^' + pattern + '$').test(clean)) { if (!best || routeUrl(f).length > routeUrl(best).length) best = f; }
    }
    return best;
};
const explicitPerms = (f: string, method: string): string[] | null => {
    const text = fs.readFileSync(f, 'utf8');
    const re = new RegExp(`export const ${method}\\b[\\s\\S]*?(?=export const (GET|POST|PUT|PATCH|DELETE)\\b|$)`);
    const block = (text.match(re) ?? [text])[0];
    const names = (src: string) => [...src.matchAll(/RBAC_PERMISSIONS\.([A-Z0-9_]+)/g)].map((x) => CODE_BY_KEY[x[1]]).filter(Boolean);
    const lit = block.match(/permissions:\s*\[([^\]]*)\]/);
    if (lit) return names(lit[1]);
    const ref = block.match(/permissions:\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (ref) { const decl = text.match(new RegExp('const ' + ref[1] + '[^=]*=\\s*\\[([^\\]]*)\\]')); if (decl) return names(decl[1]); }
    return null;
};

export function auditPageApi(): { pages: number; problems: Map<string, string[]> } {
    const problems = new Map<string, string[]>();
    for (const page of pages) {
        const url = '/' + path.relative('src/app', path.dirname(page)).split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join('/');
        if (url.includes('[')) continue;
        const pageCap = resolvePageCapability(url);
        const holders = roles.filter((r) => !pageCap || grantsOf(r).has(pageCap) || r === 'ADMIN' || r === 'SUPER_ADMIN');
        // the page and its own components in the same folder (one level)
        const dir = path.dirname(page);
        const files = fs.readdirSync(dir).filter((x) => /\.(tsx|ts)$/.test(x)).map((x) => path.join(dir, x)).concat(fs.existsSync(path.join(dir, 'components')) ? fs.readdirSync(path.join(dir, 'components')).filter((x) => x.endsWith('.tsx')).map((x) => path.join(dir, 'components', x)) : []);
        const urls = new Set<string>();
        for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"`](\/api\/[A-Za-z0-9_\-/\[\]${}.]*)/g)) urls.add(m[1].replace(/\$\{[^}]*\}/g, 'x'));
        for (const u of urls) {
            const rf = matchRoute(u); if (!rf) continue;
            for (const method of ['GET']) {
                if (!new RegExp(`export const ${method}\\b`).test(fs.readFileSync(rf, 'utf8'))) continue;
                const caps = explicitPerms(rf, method) ?? ((c) => (c ? [c] : []))(resolveRouteCapability(u.split('?')[0], method));
                if (caps.length === 0) continue;
                const blocked = holders.filter((r) => r !== 'ADMIN' && r !== 'SUPER_ADMIN' && !caps.some((c) => grantsOf(r).has(c)));
                if (blocked.length) { const k = `${url} (page needs ${pageCap ?? 'dashboard/none'}) calls GET ${u.split('?')[0]} (needs ${caps.join(' or ')})`; problems.set(k, blocked); }
            }
        }
    }
    
    return { pages: pages.length, problems };
}

if (process.argv[1]?.endsWith('page-api-audit.ts')) {
    const { pages, problems } = auditPageApi();
    console.log('pages', pages, 'mismatches', problems.size);
    for (const [k, v] of [...problems.entries()].sort()) console.log('-', k, '\n    roles that open the page but not the API:', v.join(', '));
}
