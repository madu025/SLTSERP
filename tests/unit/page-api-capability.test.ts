import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditPageApi } from '../../scripts/page-api-audit';

/**
 * A role that can open a page must hold the capability of the API the page calls, or the screen is half empty for that role.
 * The known mismatches (dashboard widgets that sit behind tabs, helper lists that only the administrator reads, owner decisions) are in
 * tests/unit/fixtures/page-api-baseline.json. A NEW mismatch fails this test; so does a baseline line that was fixed (remove it).
 * To list what a mismatch means for each role: pnpm exec tsx scripts/page-api-audit.ts
 * To rewrite the baseline after a reviewed change: UPDATE_PAGE_API_BASELINE=1 pnpm exec tsx --test tests/unit/page-api-capability.test.ts
 */
const BASELINE = 'tests/unit/fixtures/page-api-baseline.json';
const pairs = (): string[] => [...auditPageApi().problems.keys()].map((k) => k.replace(/ \(page needs [^)]*\) calls /, ' -> ').replace(/ \(needs [^)]*\)$/, '')).sort();

test('no new page calls an API that a role who opens the page cannot read', () => {
    const current = pairs();
    if (process.env.UPDATE_PAGE_API_BASELINE === '1') { fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n'); return; }
    const baseline: string[] = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    assert.deepEqual(current.filter((p) => !baseline.includes(p)), [], 'new mismatch: fix the capability, or add the pair to the baseline after review');
    assert.deepEqual(baseline.filter((p) => !current.includes(p)), [], 'fixed: remove these lines from the baseline');
});

test('the rate matrix is read by finance approvers and SF audit, changed by the administrator only', () => {
    const text = fs.readFileSync('src/app/api/admin/rate-matrix/route.ts', 'utf8');
    assert.match(text, /FINANCE_AUDIT/);
    assert.match(text, /permissions: \[RBAC_PERMISSIONS\.ADMIN_RBAC\]/);
});
