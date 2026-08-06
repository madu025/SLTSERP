/**
 * audit-cross-module-imports.js — Inter-module privilege flow auditor (grill-me M3)
 *
 * Service-to-service calls bypass API route guards: the called service trusts
 * the entry route's authorization. If module A's entry route has a LOOSER guard
 * than the admin-level logic it triggers in module B, privilege escalation is
 * possible. This scanner:
 *
 *   1. Maps every cross-module import inside src/services
 *   2. Finds every API route that uses the imported class
 *   3. Prints each route's declared guard (roles / menuPath) so reviewers can
 *      verify entry-route guards are >= the strictest called-service requirement
 *
 * Usage: node scripts/audit-cross-module-imports.js
 */
const fs = require('fs');
const path = require('path');

const SERVICES = path.join('src', 'services');
const API_ROOT = path.join('src', 'app', 'api');

function walk(dir, out = []) {
    for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isDirectory()) walk(fp, out);
        else if (fp.endsWith('.ts')) out.push(fp);
    }
    return out;
}

// 1. Cross-module service imports -> { symbol, fromModule, byFile }
const cross = [];
for (const fp of walk(SERVICES)) {
    const src = fs.readFileSync(fp, 'utf8');
    const ownModule = path.dirname(fp).split(path.sep)[2];
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/services\/([a-z-]+)\/[^']+'/g)) {
        const targetModule = m[2];
        if (targetModule === ownModule) continue;
        for (const sym of m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
            cross.push({ symbol: sym, fromModule: targetModule, byFile: path.relative('.', fp).replace(/\\/g, '/') });
        }
    }
}

// 2. API route guard declarations
const routeFiles = walk(API_ROOT).filter(f => f.endsWith('route.ts'));
const routeGuards = routeFiles.map(fp => {
    const src = fs.readFileSync(fp, 'utf8');
    const roles = src.match(/roles:\s*([^\n]+)/);
    const menuPath = src.match(/menuPath:\s*['"]([^'"]+)['"]/);
    return {
        route: path.relative(API_ROOT, fp).replace(/\\/g, '/'),
        guard: menuPath ? `menuPath '${menuPath[1]}'` : roles ? `roles ${roles[1].trim()}` : 'NONE (prefix guard fallback)',
    };
});

// 3. Privilege chains: route -> its own service -> cross-module dependency (depth 2)
console.log('=== Cross-Module Service Import Audit ===');
console.log(`Cross-module imports: ${cross.length} | API routes scanned: ${routeFiles.length}\n`);

// index cross-module deps by consuming file
const depsByFile = new Map();
for (const c of cross) {
    if (!depsByFile.has(c.byFile)) depsByFile.set(c.byFile, []);
    depsByFile.get(c.byFile).push(`${c.fromModule} (via ${c.symbol})`);
}

let risky = 0;
for (const g of routeGuards) {
    const fp = path.join(API_ROOT, g.route);
    const src = fs.readFileSync(fp, 'utf8');
    const ownImports = [...src.matchAll(/from '@\/services\/([a-z-]+)\/[^']+'/g)].map(m => m[1]);
    if (ownImports.length === 0) continue;
    // which service files does this route actually reference? match by class names
    const chains = [];
    for (const [file, deps] of depsByFile.entries()) {
        const cls = path.basename(file, '.ts');
        // route imports from same module as the consuming file AND references it
        const fileModule = file.split('/')[2];
        if (ownImports.includes(fileModule) && src.includes(new RegExp(`\\b${cls}\\b`).source)) {
            chains.push(...deps.map(d => `${file} -> ${d}`));
        }
    }
    if (chains.length === 0) continue;
    const routePath = '/api/' + g.route.replace(/\/route\.ts$/, '').replace(/\/\[[^\]]+\]/g, '/:param');
    const looseGuard = g.guard.startsWith('NONE') || /roles \[\]/.test(g.guard);
    if (looseGuard) risky++;
    console.log(`${looseGuard ? '[CHECK] ' : ''}${routePath}  guard: ${g.guard}`);
    [...new Set(chains)].forEach(c => console.log('   chain: ' + c));
}

console.log('');
console.log(risky === 0
    ? 'All routes reaching cross-module services declare explicit guards.'
    : `${risky} route(s) rely on prefix-guard fallback while reaching cross-module services - verify manually.`);
