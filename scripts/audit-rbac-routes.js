// RBAC audit: find API route files exposing mutating methods without role enforcement
const fs = require('fs');
const path = require('path');

const apiRoot = path.join(__dirname, '..', 'src', 'app', 'api');
const results = [];

// Mirrors PREFIX_WRITE_GUARDS in src/config/route-guard-defaults.ts — routes
// under these namespaces are fail-closed by apiHandler even without a
// per-route declaration.
const PREFIX_GUARDS = ['/api/admin/', '/api/projects/', '/api/gis/', '/api/inventory/'];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'route.ts') {
            const src = fs.readFileSync(full, 'utf8');
            const mutators = ['POST', 'PUT', 'PATCH', 'DELETE'].filter(m =>
                new RegExp(`export const ${m}\\b`).test(src)
            );
            if (mutators.length === 0) continue;
            const hasRoles = /roles:\s*(\[|ROLE_GROUPS|[A-Za-z_$][\w$]*)/.test(src) || /menuPath:\s*['"]/.test(src);
            const hasRequireAuth = /requireAuth/.test(src);
            const hasManualRoleCheck = /x-user-role/.test(src) && /(includes|===|!==)/.test(src);
            const hasCronAuth = /assertCronAuth/.test(src) || (/CRON_SECRET/.test(src) && /throw/.test(src));
            const apiPath = '/' + path.relative(apiRoot, full).split(path.sep).slice(0, -1).join('/').replace(/\\/g, '/');
            const hasPrefixGuard = PREFIX_GUARDS.some(p => ('/api' + apiPath.slice(0)).startsWith(p));
            if (!hasRoles && !hasRequireAuth && !hasManualRoleCheck && !hasCronAuth && !hasPrefixGuard) {
                results.push({ file: path.relative(apiRoot, full), mutators: mutators.join(',') });
            }
        }
    }
}

walk(apiRoot);
console.log(`UNGUARDED MUTATING ROUTES: ${results.length}`);
for (const r of results) console.log(`  ${r.mutators.padEnd(18)} ${r.file}`);
