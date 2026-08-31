import { getComputedSodStatus } from '../src/lib/constants/sod-constants';

// All 18 (sltsStatus, status) combinations observed in production DB
const cases: Array<[string | null, string | null, string, string]> = [
    // [sltsStatus, status, expected, note]
    ['COMPLETED', 'COMPLETED', 'COMPLETED', 'aligned completed'],
    ['INSTALL_CLOSED', 'INSTALL_CLOSED', 'INSTALL_CLOSED', 'aligned install closed'],
    ['DISAPPEARED', 'DISAPPEARED', 'DISAPPEARED', 'aligned disappeared'],
    ['INPROGRESS', 'PENDING', 'INPROGRESS', 'workflow pending beneath active portal'],
    ['COMPLETED', 'PAT_OPMC_PASSED', 'PAT OPMC PASSED', 'PAT stage surfaced'],
    ['RETURN', 'PENDING', 'RETURN', 'return requested'],
    ['RETURN', 'RETURN', 'RETURN', 'aligned return'],
    ['PROV_CLOSED', 'PENDING', 'PROV_CLOSED', 'prov closed pending workflow'],
    ['COMPLETED', 'PAT_OPMC_REJECTED', 'PAT OPMC REJECTED', 'PAT rejected surfaced'],
    ['COMPLETED', 'PAT_CORRECTED', 'PAT CORRECTED', 'PAT corrected surfaced'],
    ['INSTALL_CLOSED', 'DISAPPEARED', 'DISAPPEARED', 'portal absence overrides'],
    ['COMPLETED', 'PAT_REJECTED', 'PAT REJECTED', 'PAT rejected surfaced'],
    ['INPROGRESS', 'INPROGRESS', 'INPROGRESS', 'aligned inprogress'],
    ['PROV_CLOSED', 'DISAPPEARED', 'DISAPPEARED', 'portal absence overrides'],
    ['INPROGRESS', 'DISAPPEARED', 'DISAPPEARED', 'portal absence overrides'],
    ['INPROGRESS', 'RETURN', 'RETURN', 'workflow return beats stale portal'],
    ['RETURN', 'DISAPPEARED', 'DISAPPEARED', 'portal absence overrides'],
    ['PROV_CLOSED', 'PROV_CLOSED', 'PROV_CLOSED', 'aligned prov closed'],
    // legacy / edge
    [null, 'PENDING', 'PENDING', 'no portal status falls back to workflow'],
    [null, null, '-', 'both empty'],
    ['RETURNED', null, 'RETURNED', 'portal truth passes through'],
];

console.log('=== getComputedSodStatus verification ===');
let failed = 0;
for (const [slts, wf, expected, note] of cases) {
    const actual = getComputedSodStatus({ sltsStatus: slts, status: wf });
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(
        `${ok ? 'PASS' : 'FAIL'}  portal=${String(slts).padEnd(15)} workflow=${String(wf).padEnd(18)} -> ${actual.padEnd(18)} (${note})`
    );
}
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
