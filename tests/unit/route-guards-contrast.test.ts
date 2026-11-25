import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findUnguarded, scanRoutes } from '../../scripts/route-guard-scan';
import { scan as scanContrast, scanText } from '../../scripts/contrast-scan';

/**
 * 1. Every API handler is guarded by a capability (explicit `permissions`, or the automatic one of route-capabilities.ts), except the handlers listed in
 *    tests/unit/fixtures/unguarded-routes.json. Those are public on purpose (sign-in, one-time links, public lookups, health) or authenticate
 *    themselves (cron secret, agent key, extension key, bridge). A NEW unguarded handler fails this test: guard it, or add it to the list after review.
 *    To list them: pnpm exec tsx scripts/route-guard-scan.ts. To rewrite the list after review: UPDATE_ROUTE_BASELINE=1 pnpm exec tsx --test tests/unit/route-guards-contrast.test.ts
 * 2. The high-contrast rule of AGENTS.md: no light text on a light background and no dark text on a dark background inside one className.
 *    To list findings: pnpm exec tsx scripts/contrast-scan.ts
 */
const BASELINE = 'tests/unit/fixtures/unguarded-routes.json';

test('no new API handler without a capability guard', () => {
    const current = scanRoutes().map((r) => `${r.method} ${r.url}`).sort();
    if (process.env.UPDATE_ROUTE_BASELINE === '1') { fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n'); return; }
    const baseline: string[] = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    assert.deepEqual(current.filter((r) => !baseline.includes(r)), [], 'new unguarded handler: add a permissions guard, or list it after review');
    assert.deepEqual(baseline.filter((r) => !current.includes(r)), [], 'now guarded or removed: delete these lines from the list');
});

test('high contrast: no light-on-light and no dark-on-dark text in one className', () => {
    assert.deepEqual(scanContrast().map((f) => `${f.kind} ${f.file}:${f.line}`), []);
});

test('the route scan sees what a guard really is: a schema field called permissions is no guard, function-style handlers are scanned, publicRoute is recognised', () => {
    const schemaField = "const schema = z.object({ permissions: z.array(z.string()) });\nexport const POST = apiHandler(async () => ({}), { schema });";
    assert.deepEqual(findUnguarded(schemaField, '/api/zz/one').map((r) => r.method), ['POST']);
    assert.deepEqual(findUnguarded("export async function DELETE(req: Request) { return new Response(null); }", '/api/zz/two').map((r) => r.method), ['DELETE']);
    assert.deepEqual(findUnguarded("const handler = async () => ({});\nexport { handler as GET };", '/api/zz/three').map((r) => r.method), ['GET']);
    assert.deepEqual(findUnguarded("// permissions: [x]\nexport const GET = apiHandler(async () => ({}), {});", '/api/zz/four').map((r) => r.method), ['GET']);
    assert.deepEqual(findUnguarded("export const GET = apiHandler(async () => ({}), { publicRoute: true });", '/api/zz/five'), []);
    assert.deepEqual(findUnguarded("export const GET = apiHandler(async () => ({}), { permissions: [RBAC_PERMISSIONS.ADMIN_RBAC] });", '/api/zz/six'), []);
    assert.deepEqual(findUnguarded("const PERMISSIONS = [RBAC_PERMISSIONS.DASHBOARD_READ];\nexport const GET = apiHandler(async () => ({}), { permissions: PERMISSIONS });", '/api/zz/seven'), []);
});

test('the contrast scan sees cn(...) and multi-line classNames, and does not mix conditional alternatives', () => {
    assert.equal(scanText('<div className={cn("bg-white", "text-white")} />').length, 1);
    assert.equal(scanText('<div className="bg-white\n   text-white" />').length, 1);
    assert.equal(scanText('<div className={clsx("bg-slate-900", "text-slate-900")} />').length, 1);
    assert.equal(scanText('<div className={cn("bg-white text-slate-900", active && "bg-slate-900 text-white")} />').length, 0);
    assert.equal(scanText('<div className="bg-slate-900 text-white hover:text-slate-900" />').length, 0);
});
