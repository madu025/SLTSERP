/**
 * audit-menu-drift.js — Menu/Page RBAC drift detector (grill-me M1)
 *
 * The sidebar menu (src/config/sidebar-menu.ts) is the single source of truth
 * for three RBAC layers: nav visibility, middleware page access, and the
 * apiHandler `menuPath` guards. A typo or a forgotten entry silently degrades
 * all three (pages outside the menu map are fail-open for any authenticated
 * user). This scanner cross-checks the actual src/app page tree against the
 * declared menu paths and reports:
 *
 *   1. UNPROTECTED pages  — pages with no menu rule (fail-open to any user)
 *   2. ORPHAN menu paths  — declared in the menu but no matching page exists
 *
 * Intentionally public paths live in PUBLIC_EXEMPT — extend it deliberately.
 * Usage: node scripts/audit-menu-drift.js   (exit 1 when issues are found)
 */
const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join('src', 'app');
const MENU_FILE = path.join('src', 'config', 'sidebar-menu.ts');

// Paths that are intentionally outside the sidebar RBAC map
const PUBLIC_EXEMPT = [
    '/',
    '/login',
    '/forgot-password',
    '/contractor',              // contractor portal has its own auth layer
    '/contractor-registration', // token-gated public registration link
    '/contractor-upload',       // token-gated public upload link
    '/public',                  // intentionally public (shared invoice view etc.)
    '/team-upload',             // token-gated upload landing
    '/presentation',            // public presentation mode
    '/profile',                 // personal page, any authenticated user; API guards own-data
    '/notifications',           // personal page, any authenticated user; API guards own-data
    '/service-orders',          // redirect-only page -> /service-orders/work-order (guarded)
];

// Route segments that never appear in the menu map
const SKIP_SEGMENTS = ['api', '(auth)', '(dashboard)'];

function collectPages(dir, base = '') {
    const pages = [];
    for (const entry of fs.readdirSync(dir)) {
        if (SKIP_SEGMENTS.includes(entry) && dir === APP_ROOT) continue;
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
            const seg = entry.startsWith('(') ? '' : entry; // route groups add no segment
            pages.push(...collectPages(full, seg ? `${base}/${seg}` : base));
        } else if (entry === 'page.tsx') {
            pages.push(base || '/');
        }
    }
    return pages;
}

function collectMenuPaths() {
    const src = fs.readFileSync(MENU_FILE, 'utf8');
    const paths = new Set();
    for (const m of src.matchAll(/path:\s*['"]([^'"]+)['"]/g)) {
        if (m[1] !== '/') paths.add(m[1].replace(/\/+$/, ''));
    }
    return [...paths];
}

function normalize(p) {
    // replace every dynamic segment with a single [param] so /a/1 and /a/x match
    return p.split('/').map(s => (s.startsWith('[') ? '[param]' : s)).join('/');
}

function menuRuleFor(pagePath, menuPaths) {
    return menuPaths.some(
        mp => pagePath === mp || pagePath.startsWith(mp + '/') ||
            normalize(pagePath) === normalize(mp) || normalize(pagePath).startsWith(normalize(mp) + '/')
    );
}

function isExempt(pagePath) {
    return PUBLIC_EXEMPT.some(e => pagePath === e || pagePath.startsWith(e + '/'));
}

const pages = [...new Set(collectPages(APP_ROOT))];
const menuPaths = collectMenuPaths();

const unprotected = pages.filter(p => !isExempt(p) && !menuRuleFor(p, menuPaths));
const orphans = menuPaths.filter(mp =>
    !pages.some(p => p === mp || p.startsWith(mp + '/') ||
        normalize(p) === normalize(mp) || normalize(p).startsWith(normalize(mp) + '/'))
);

console.log('=== Menu/Page RBAC Drift Audit ===');
console.log(`Pages scanned: ${pages.length} | Menu paths declared: ${menuPaths.length}`);
console.log('');
console.log(`UNPROTECTED pages (no menu rule -> fail-open for any authenticated user): ${unprotected.length}`);
unprotected.forEach(p => console.log('  - ' + p));
console.log('');
console.log(`ORPHAN menu paths (declared but no page exists -> typo/dead entry): ${orphans.length}`);
orphans.forEach(p => console.log('  - ' + p));

if (unprotected.length > 0) {
    console.log('');
    console.log('DRIFT DETECTED. Add the page to sidebar-menu.ts (or PUBLIC_EXEMPT deliberately).');
    process.exit(1);
}
if (orphans.length > 0) {
    console.log('');
    console.log('Orphan entries are advisory (roadmap placeholders / dead entries) — no exit failure.');
}
console.log('');
console.log('No unprotected pages: every page is covered by a menu rule or a deliberate exemption.');
