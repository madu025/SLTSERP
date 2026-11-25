import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Role } from '@prisma/client';
import { RBAC_PERMISSIONS, RBAC_PERMISSION_DEFINITIONS } from '../../src/config/rbac-permissions';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { landingPath } from '../../src/config/landing';
import { resolvePageCapability } from '../../src/config/page-capabilities';

/**
 * The authorization rules of the code base (docs/authorization-architecture.md), kept by tests so a new developer or an AI assistant
 * learns of a broken rule at once:
 *   1. The menu, the page rules and the first page decide by capabilities, never by the name of a role.
 *   2. Every capability in the catalog has a definition for the database and is granted to somebody.
 *   3. Where a person lands after signing in follows from what the person may do.
 */
const RUNTIME_FILES = ['src/config/sidebar-menu.ts', 'src/config/menu-access.ts', 'src/config/page-capabilities.ts', 'src/config/landing.ts', 'src/lib/route-capabilities.ts'];

test('rule 1: no role name is written in the runtime menu, page rules, first page or route rules', () => {
    const roles = Object.values(Role).filter((r) => r.length > 4);
    const found: string[] = [];
    for (const file of RUNTIME_FILES) {
        const text = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
        for (const role of roles) if (new RegExp(`['"\`]${role}['"\`]`).test(text)) found.push(`${file}: ${role}`);
    }
    assert.deepEqual(found, []);
});

test('rule 2: every capability has a definition and at least one role holds it', () => {
    const defined = new Set<string>(RBAC_PERMISSION_DEFINITIONS.map((d) => d.code));
    const missing = Object.values(RBAC_PERMISSIONS).filter((code) => !defined.has(code));
    assert.deepEqual(missing, [], 'in RBAC_PERMISSIONS but without a definition');
    const granted = new Set<string>([...Object.keys(CANONICAL_BOOTSTRAP_ROLE_GRANTS), ...Object.keys(MODULE_DESIGNATION_GRANTS)]);
    // capabilities that exist for the administrator to grant when needed
    const spare = new Set<string>(['finance.salary-hold.read', 'menu.sod.view']);
    const ungranted = Object.values(RBAC_PERMISSIONS).filter((code) => !granted.has(code) && !spare.has(code));
    assert.deepEqual(ungranted, [], 'in the catalog but granted to no role');
});

const grantsOf = (role: string): string[] => [
    ...Object.entries(CANONICAL_BOOTSTRAP_ROLE_GRANTS).filter(([, r]) => (r as readonly string[]).includes(role)).map(([p]) => p),
    ...Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, r]) => r.includes(role)).map(([p]) => p),
];

test('rule 3: contractors land on the contractor portal, store people on the inventory pages, everyone else on the dashboard', () => {
    const landing = (role: string) => landingPath(grantsOf(role));
    for (const r of ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE']) assert.equal(landing(r), '/contractor/dashboard', r);
    for (const r of ['STORES_MANAGER', 'STORES_EXECUTIVE', 'STORES_ASSISTANT']) assert.equal(landing(r), '/inventory', r);
    for (const r of Object.values(Role).filter((x) => !/CONTRACTOR_|^STORES_/.test(x))) assert.equal(landing(r), '/dashboard', r);
    assert.equal(landingPath(undefined), '/dashboard', 'an old session keeps landing on the dashboard');
});

/** Pages that anybody may open, with or without a session: sign-in, one-time links, public notices. Every other page needs a page rule. */
const PUBLIC_PAGES = new Set(['/', '/login', '/forgot-password', '/privacy', '/extension-download', '/approvals/action', '/public/device-audit']);
const isPublicPage = (url: string) => PUBLIC_PAGES.has(url) || /^\/(contractor-registration|contractor-upload|team-upload|public)\//.test(url);

test('rule 4: every page that is not public has a page rule (a capability), so a signed-in user without it is turned away', () => {
    const walk = (dir: string, out: string[] = []): string[] => {
        for (const e of fs.readdirSync(dir)) { const p = dir + '/' + e; if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p); }
        return out;
    };
    const pages = walk('src/app').filter((f) => f.endsWith('/page.tsx') && !f.startsWith('src/app/api/'));
    const missing = pages
        .map((f) => '/' + f.slice('src/app/'.length, -'/page.tsx'.length).split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/'))
        .map((u) => (u === '/page.tsx' || u === '/' ? '/' : u))
        .filter((u) => !isPublicPage(u) && !resolvePageCapability(u.replace(/\[[^\]]+\]/g, 'x')));
    assert.deepEqual(missing, []);
});

test('rule 5: the Head of Section and the OSP Manager see every store (scope.inventory.all), so no store is assigned to them one by one', () => {
    const holders = (CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>)['scope.inventory.all'] ?? [];
    for (const r of ['HEAD_OF_SECTION', 'OSP_MANAGER', 'HEAD_OF_OSP', 'CEO']) assert.ok(holders.includes(r), r);
    // a role that approves stock requests for every store needs the same reach
    const approvers = (CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>)['inventory.approve'] ?? [];
    for (const r of ['HEAD_OF_SECTION', 'OSP_MANAGER']) assert.ok(approvers.includes(r) && holders.includes(r), r);
});
