// RBAC audit: find API route files exposing mutating methods without role enforcement
const fs = require('fs');
const path = require('path');

const apiRoot = path.join(__dirname, '..', 'src', 'app', 'api');
const results = [];

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
            const hasRoles = /roles:\s*\[|roles:\s*ROLE_GROUPS/.test(src);
            const hasRequireAuth = /requireAuth/.test(src);
            const hasManualRoleCheck = /x-user-role/.test(src) && /(includes|===|!==)/.test(src);
            if (!hasRoles && !hasRequireAuth && !hasManualRoleCheck) {
                results.push({ file: path.relative(apiRoot, full), mutators: mutators.join(',') });
            }
        }
    }
}

walk(apiRoot);
console.log(`UNGUARDED MUTATING ROUTES: ${results.length}`);
for (const r of results) console.log(`  ${r.mutators.padEnd(18)} ${r.file}`);
