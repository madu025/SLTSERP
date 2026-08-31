import { SODLifecycleService } from '../src/services/service-order/sod.lifecycle.service';
import { getComputedSodStatus } from '../src/lib/constants/sod-constants';

// Portal CON_STATUS values arriving via the 10-min pending list (ftthpen)
const cases: Array<[string, string, string]> = [
    // [CON_STATUS, expected mapped sltsStatus, note]
    ['ASSIGN', 'ASSIGNED', 'portal assign form (normalized to ASSIGNED by slt-api)'],
    ['ASSIGNED', 'ASSIGNED', 'assigned SOD — distinct status in pending table'],
    ['RETURN_PENDING', 'RETURN', 'business rule: return request = RETURN immediately'],
    ['RETURN', 'RETURN', 'plain return'],
    ['INPROGRESS', 'INPROGRESS', 'active work'],
    ['PROV_CLOSED', 'PROV_CLOSED', 'provisioning closed'],
    ['INSTALL_CLOSED', 'COMPLETED', 'external completion list value'],
    ['COMPLETED', 'COMPLETED', 'completed'],
];

console.log('=== 10-min sync CON_STATUS mapping (mapExternalStatusToSltsStatus) ===');
let failed = 0;
for (const [con, expected, note] of cases) {
    const normalized = con === 'ASSIGN' ? 'ASSIGNED' : con;
    const actual = SODLifecycleService.mapExternalStatusToSltsStatus(normalized);
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  CON_STATUS=${con.padEnd(15)} -> ${actual.padEnd(12)} (${note})`);
}

// Bridge/extension detection mirror
console.log('\n=== Bridge isServiceReturn detection ===');
const bridgeDetect = (portalStatus: string, chksodrtn = '', hidden = false) =>
    chksodrtn === 'on' || hidden || portalStatus.includes('RETURN') || portalStatus.includes('REJECT');
for (const s of ['RETURN_PENDING', 'ASSIGNED', 'INPROGRESS', 'PROV_CLOSED']) {
    console.log(`CON_STATUS=${s.padEnd(15)} -> isServiceReturn: ${bridgeDetect(s)}`);
}

// Computed display status with ASSIGNED
console.log('\n=== getComputedSodStatus with ASSIGNED ===');
const computedCases: Array<[string | null, string | null, string, string]> = [
    ['ASSIGNED', 'PENDING', 'ASSIGNED', 'portal ASSIGNED, workflow PENDING — shows ASSIGNED'],
    ['ASSIGNED', null, 'ASSIGNED', 'portal ASSIGNED only'],
    [null, 'ASSIGNED', 'ASSIGNED', 'workflow ASSIGNED only'],
    ['COMPLETED', 'ASSIGNED', 'COMPLETED', 'portal COMPLETED beats workflow ASSIGNED'],
    [null, 'ASSIGNED', 'ASSIGNED', 'DISAPPEARED not set — ASSIGNED passes through'],
];
for (const [slts, status, expected, note] of computedCases) {
    const actual = getComputedSodStatus({ sltsStatus: slts, status });
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  slts=${(slts || 'null').padEnd(12)} status=${(status || 'null').padEnd(12)} -> ${(actual || '-').padEnd(12)} (${note})`);
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
