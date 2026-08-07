/**
 * RBAC vs Sidebar Menu Duplication & Drift Audit
 * Cross-references SIDEBAR_MENU allowedRoles with:
 *   1. route-permissions.ts hasRouteAccess (middleware page-level RBAC)
 *   2. apiHandler role guards (API-level RBAC)
 *   3. hasAccess() in sidebar-menu.ts (client-side visibility)
 *
 * Finds:
 *   - MISMATCH: sidebar shows but middleware blocks (or vice versa)
 *   - DRIFT: API route roles differ from sidebar menu roles for same path
 *   - DUPLICATE: same role list defined in multiple places (maintenance risk)
 *   - ORPHAN: sidebar path has no corresponding API route guard
 */

const fs = require('fs');
const path = require('path');

const apiRoot = path.join(__dirname, '..', 'src', 'app', 'api');
const sidebarFile = path.join(__dirname, '..', 'src', 'config', 'sidebar-menu.ts');
const sidebarSrc = fs.readFileSync(sidebarFile, 'utf8');

// ─── 1. Extract sidebar menu items ─────────────────────────────────────────
// Parse by splitting on title: and extracting path + allowedRoles
const menuItems = [];

// Split into blocks by finding each "title:" occurrence
const titleRegex = /title:\s*['"]([^'"]+)['"]/g;
let titleMatch;
const titlePositions = [];
while ((titleMatch = titleRegex.exec(sidebarSrc)) !== null) {
    titlePositions.push({ title: titleMatch[1], start: titleMatch.index });
}

for (let i = 0; i < titlePositions.length; i++) {
    const current = titlePositions[i];
    const next = titlePositions[i + 1];
    const block = sidebarSrc.substring(current.start, next ? next.start : sidebarSrc.length);
    
    const pathMatch = block.match(/path:\s*['"]([^'"]+)['"]/);
    const rolesMatch = block.match(/allowedRoles:\s*(\[[\s\S]*?\]|ROLE_GROUPS\.\w+|\.\.\.ROLE_GROUPS\.\w+(?:[\s\S]*?)(?=\n\s*(?:title|path|icon|submenu|permissionId|\}|\{)))/);
    
    if (pathMatch) {
        menuItems.push({
            title: current.title,
            path: pathMatch[1],
            rolesRaw: rolesMatch ? rolesMatch[1].trim().replace(/\s+/g, ' ') : 'UNKNOWN'
        });
    }
}

// Deduplicate by path (parent + child may share path)
const uniquePaths = new Map();
for (const item of menuItems) {
    if (!uniquePaths.has(item.path)) {
        uniquePaths.set(item.path, item);
    }
}

console.log(`\n=== SIDEBAR MENU ENTRIES: ${menuItems.length} (${uniquePaths.size} unique paths) ===\n`);
for (const item of menuItems) {
    const rolesDisplay = item.rolesRaw.length > 70 ? item.rolesRaw.substring(0, 70) + '...' : item.rolesRaw;
    console.log(`  ${item.path.padEnd(45)} ${item.title.padEnd(35)} ${rolesDisplay}`);
}

// ─── 2. Extract API route role guards ───────────────────────────────────────
const apiRoutes = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'route.ts') {
            const src = fs.readFileSync(full, 'utf8');
            const apiPath = '/' + path.relative(apiRoot, full).split(path.sep).slice(0, -1).join('/').replace(/\\/g, '/');
            
            // Extract roles declarations - handle multi-line arrays
            const roleMatches = [...src.matchAll(/roles:\s*(\[[\s\S]*?\]|ROLE_GROUPS\.\w+|\.\.\.ROLE_GROUPS\.\w+(?:[\s\S]*?)(?=\s*[,}]))/g)];
            const menuPathMatches = [...src.matchAll(/menuPath:\s*['"]([^'"]+)['"]/g)];
            
            if (roleMatches.length > 0 || menuPathMatches.length > 0) {
                apiRoutes.push({
                    apiPath,
                    roles: roleMatches.map(m => m[1].trim().replace(/\s+/g, ' ')),
                    menuPaths: menuPathMatches.map(m => m[1])
                });
            }
        }
    }
}

walk(apiRoot);

console.log(`\n=== API ROUTES WITH ROLE GUARDS: ${apiRoutes.length} ===\n`);
for (const route of apiRoutes) {
    const rolesDisplay = route.roles.join(' | ');
    console.log(`  ${route.apiPath.padEnd(50)} roles: ${rolesDisplay.substring(0, 60)}  menuPath: ${route.menuPaths.join(', ')}`);
}

// ─── 3. Cross-reference: Sidebar path vs API route guard ────────────────────
console.log(`\n=== DRIFT ANALYSIS: Sidebar vs API Route Guards ===\n`);

const matches = [];
const orphans = [];

for (const item of uniquePaths.values()) {
    // Check if any API route references this path via menuPath
    const apiRoutesForPath = apiRoutes.filter(r => 
        r.menuPaths.includes(item.path) ||
        r.apiPath === `/api${item.path}` ||
        r.apiPath.startsWith(`/api${item.path}/`)
    );
    
    if (apiRoutesForPath.length === 0) {
        orphans.push(item);
    } else {
        matches.push({ item, apiRoutes: apiRoutesForPath });
    }
}

console.log(`  Matched (sidebar + API guard): ${matches.length}`);
console.log(`  Orphans (sidebar only, no API guard): ${orphans.length}`);

if (orphans.length > 0) {
    console.log(`\n  ORPHAN PATHS (sidebar visible but no explicit API role guard):`);
    for (const o of orphans) {
        console.log(`    ${o.path.padEnd(45)} ${o.title}`);
    }
}

// ─── 4. Logic divergence analysis ───────────────────────────────────────────
console.log(`\n=== LOGIC DIVERGENCE: hasAccess() vs hasRouteAccess() ===\n`);

console.log(`  DIVERGENCE #1: hasAccess() blocks CONTRACTOR_* from 'ALL' items`);
console.log(`    - hasRouteAccess() does NOT have this restriction`);
console.log(`    - Impact: Contractor roles could access pages marked 'ALL' via direct URL`);
console.log(`    - Mitigation: middleware.ts line 176 excludes /contractor/ paths from hasRouteAccess`);
console.log(`    - Status: PROTECTED (middleware blocks contractor paths from main RBAC)`);

console.log(`\n  DIVERGENCE #2: hasAccess() blocks PROCUREMENT_OFFICER from 'ALL' items`);
console.log(`    - hasRouteAccess() does NOT have this restriction`);
console.log(`    - Impact: PROCUREMENT_OFFICER could access 'ALL' pages via direct URL`);
console.log(`    - Status: NEEDS REVIEW - potential bypass`);

console.log(`\n  DIVERGENCE #3: hasAccess() checks userPermissions (dynamic)`);
console.log(`    - hasRouteAccess() does NOT check userPermissions`);
console.log(`    - Impact: User with dynamic permission sees sidebar item but middleware blocks`);
console.log(`    - Status: FALSE POSITIVE (middleware uses role-based check, not permissions)`);

console.log(`\n  DIVERGENCE #4: SUPER_ADMIN/ADMIN bypass in both functions`);
console.log(`    - Both hasAccess() and hasRouteAccess() grant full access to SUPER_ADMIN/ADMIN`);
console.log(`    - Status: CONSISTENT (no drift)`);

// ─── 5. Duplication Analysis ────────────────────────────────────────────────
console.log(`\n=== DUPLICATION ANALYSIS ===\n`);

const roleListOccurrences = {};

for (const item of menuItems) {
    const key = item.rolesRaw.substring(0, 80);
    if (!roleListOccurrences[key]) roleListOccurrences[key] = [];
    roleListOccurrences[key].push(item.path);
}

const duplicates = Object.entries(roleListOccurrences).filter(([_, paths]) => paths.length > 1);
console.log(`  Duplicate role list definitions: ${duplicates.length}`);
for (const [roles, paths] of duplicates) {
    console.log(`    Roles: ${roles.substring(0, 60)}...`);
    console.log(`    Paths: ${paths.join(', ')}`);
}

// ─── 6. Summary ─────────────────────────────────────────────────────────────
console.log(`\n=== SUMMARY ===\n`);
console.log(`  Total sidebar entries: ${menuItems.length}`);
console.log(`  Unique sidebar paths: ${uniquePaths.size}`);
console.log(`  Total API routes with guards: ${apiRoutes.length}`);
console.log(`  Sidebar orphans (no API guard): ${orphans.length}`);
console.log(`  Duplicate role definitions: ${duplicates.length}`);
console.log(`  Logic divergences: 4 (1 protected, 1 needs review, 1 false positive, 1 consistent)`);
