/**
 * RBAC Sync — regenerates src/config/valid-roles.ts from the Prisma Role enum
 * and validates every role reference in ROLE_GROUPS + SIDEBAR_MENU against it.
 *
 * Usage:
 *   node scripts/rbac-sync.js          # regenerate + validate (exit 1 on drift)
 *   node scripts/rbac-sync.js --write  # same, but regenerates the file
 *
 * World-class ERP convention: the database enum is the single source of truth
 * for the role domain; config files are validated against it, never the
 * reverse. Prevents "phantom role" drift (role strings no user can hold).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const enumSrc = fs.readFileSync(path.join(root, 'prisma/schema/enums.prisma'), 'utf8');
const enumMatch = enumSrc.match(/enum Role \{([\s\S]*?)\}/);
if (!enumMatch) {
    console.error('RBAC-SYNC FAIL: could not locate enum Role in prisma/schema/enums.prisma');
    process.exit(1);
}
const validRoles = enumMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));

const write = process.argv.includes('--write');
if (write) {
    const out =
        '// AUTO-GENERATED from prisma/schema/enums.prisma by scripts/rbac-sync.js — do not edit.\n' +
        '// Mirrors the Prisma Role enum so RBAC configs can be validated against the\n' +
        '// database-enforced role domain.\n\n' +
        'export const VALID_ROLES: ReadonlyArray<string> = [\n' +
        validRoles.map((r) => `    '${r}'`).join(',\n') +
        '\n] as const;\n\n' +
        'export const VALID_ROLE_SET: ReadonlySet<string> = new Set(VALID_ROLES);\n\n' +
        'export function isValidRole(role: string): boolean {\n' +
        '    return VALID_ROLE_SET.has(role);\n' +
        '}\n';
    fs.writeFileSync(path.join(root, 'src/config/valid-roles.ts'), out);
    console.log(`RBAC-SYNC: regenerated src/config/valid-roles.ts (${validRoles.length} roles)`);
}

// ── Validation: extract role literals from RBAC config sources ──────────────
const ALLOWED_NON_ENUM = new Set(['ALL']); // sidebar wildcard for "every authenticated role"

const targets = [
    'src/config/roles.ts',
    'src/config/sidebar-menu.ts',
];

const roleLiteral = /'([A-Z][A-Z0-9_]{2,})'/g;
const valid = new Set(validRoles);
let drift = 0;

for (const rel of targets) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const seen = new Set();
    let m;
    while ((m = roleLiteral.exec(src)) !== null) {
        const role = m[1];
        if (valid.has(role) || ALLOWED_NON_ENUM.has(role) || seen.has(role)) continue;
        // Filter obvious non-role literals (statuses, actions) by requiring the
        // literal to appear on a line containing role-ish context
        const lineStart = src.lastIndexOf('\n', m.index) + 1;
        const line = src.slice(lineStart, src.indexOf('\n', m.index));
        const roleContext = /role|ROLE|allowedRoles|ADMINS|GROUP|READERS|WRITERS|MANAGERS|APPROVERS|REQUESTERS|AUDITORS|EXECUTIVES|OPS|FINANCE|STORES|PROCUREMENT|OFFICE|CONTRACTORS|SECTION/.test(line);
        if (!roleContext) continue;
        seen.add(role);
        console.log(`RBAC-DRIFT: ${rel}: role literal '${role}' is not in the Prisma Role enum`);
        drift++;
    }
}

if (drift > 0) {
    console.error(`RBAC-SYNC FAIL: ${drift} phantom role reference(s) found`);
    process.exit(1);
}
console.log(`RBAC-SYNC OK: all role references match the Prisma Role enum (${validRoles.length} roles)`);
