import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    normalizeSerial, serialFormatProblem, parseCpeType, readCpeLines, registerDecision, checkSerialForOrder, cpeReceiptGate, enforcementFor,
    type CpeSerialState,
} from '../../src/lib/cpe-serial-rules';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const state = (o: Partial<CpeSerialState> = {}): CpeSerialState => ({
    serialNumber: 'ZTEGC1234567', status: 'ISSUED', opmcId: 'kx', rtom: 'R-KX', cpeType: 'ONT', contractorId: 'c1', contractorName: 'Team One', sodId: null, issueCycle: 1, ...o,
});

test('one spelling for a serial: spaces, case and scanner prefixes are removed', () => {
    assert.equal(normalizeSerial(' ztegc 1234 567\r\n'), 'ZTEGC1234567');
    assert.equal(normalizeSerial('S/N: 32090w8004282'), '32090W8004282');
    assert.equal(serialFormatProblem(''), 'No serial number');
    assert.match(serialFormatProblem('AB1')!, /too short/);
    assert.match(serialFormatProblem('AB*123')!, /only letters, digits/);
    assert.equal(serialFormatProblem('3171041001502'), null);
    assert.equal(parseCpeType('router'), 'ONT');
    assert.equal(parseCpeType('IPTV set-top box'), 'STB');
    assert.equal(parseCpeType('voice phone'), 'PHONE');
    assert.equal(parseCpeType('modem'), null);
});

test('every line of a list says what is wrong with it; duplicates are marked on the second occurrence', () => {
    const lines = readCpeLines([
        { row: 1, serial: 'abc12345' }, { row: 2, serial: '' }, { row: 3, serial: 'ABC 12345' }, { row: 4, serial: 'XYZ99999', cpeType: 'STB' }, { row: 5, serial: 'QQQ11111', cpeType: 'ONT', model: 'TP LINK' },
    ], 'ONT');
    assert.deepEqual(lines.map((l) => l.problem), [null, 'No serial number', 'Same serial as row 1', 'This list is for ONT / Router; this line is IPTV STB', null]);
    assert.equal(lines[4].model, 'TP LINK');
});

test('a serial enters the register once; SLT may issue it again only after recovery, in the same RTOM', () => {
    assert.deepEqual(registerDecision(null, 'kx', 'ONT'), { kind: 'NEW' });
    assert.equal(registerDecision(state({ status: 'RECOVERED', issueCycle: 2 }), 'kx', 'ONT').kind, 'REISSUE');
    assert.deepEqual(registerDecision(state({ status: 'FAULTY', issueCycle: 2 }), 'kx', 'ONT'), { kind: 'REISSUE', nextCycle: 3 });
    const wrongArea = registerDecision(state({ status: 'RETURNED_TO_SLT' }), 'kd', 'ONT');
    assert.equal(wrongArea.kind === 'REFUSED' && wrongArea.code, 'CPE_SERIAL_WRONG_RTOM');
    const installed = registerDecision(state({ status: 'INSTALLED', soNum: 'KX2026' }), 'kx', 'ONT');
    assert.ok(installed.kind === 'REFUSED' && installed.code === 'CPE_SERIAL_ALREADY_REGISTERED' && /on order KX2026/.test(installed.message));
    const issued = registerDecision(state(), 'kx', 'ONT');
    assert.ok(issued.kind === 'REFUSED' && /With contractor: Team One/.test(issued.message));
    const wrongType = registerDecision(state({ status: 'RECOVERED' }), 'kx', 'STB');
    assert.equal(wrongType.kind === 'REFUSED' && wrongType.code, 'CPE_SERIAL_WRONG_TYPE');
});

test('on an order: only an SLT serial of the RTOM, with the order contractor, not installed elsewhere', () => {
    const ctx = { opmcId: 'kx', contractorId: 'c1', serviceOrderId: 'o1', cpeType: 'ONT' as const };
    assert.equal(checkSerialForOrder(state(), ctx).code, 'CPE_SERIAL_OK');
    assert.equal(checkSerialForOrder(null, ctx).code, 'CPE_SERIAL_NOT_FOUND');
    assert.equal(checkSerialForOrder(state({ opmcId: 'kd', rtom: 'R-KD' }), ctx).code, 'CPE_SERIAL_WRONG_RTOM');
    assert.equal(checkSerialForOrder(state({ contractorId: 'c2', contractorName: 'Other' }), ctx).code, 'CPE_SERIAL_NOT_WITH_CONTRACTOR');
    assert.equal(checkSerialForOrder(state({ status: 'IN_STORE', contractorId: null }), ctx).code, 'CPE_SERIAL_NOT_WITH_CONTRACTOR');
    assert.equal(checkSerialForOrder(state({ status: 'INSTALLED', sodId: 'o9', soNum: 'KX9' }), ctx).code, 'CPE_SERIAL_ALREADY_INSTALLED');
    assert.equal(checkSerialForOrder(state({ status: 'INSTALLED', sodId: 'o1' }), ctx).code, 'CPE_SERIAL_ON_THIS_ORDER');
    assert.equal(checkSerialForOrder(state({ cpeType: 'STB' }), ctx).code, 'CPE_SERIAL_WRONG_TYPE');
});

test('upgrade keeping the existing device: the serial must be the one already at the same voice number', () => {
    const ctx = { opmcId: 'kx', contractorId: 'c1', serviceOrderId: 'o2', cpeType: 'ONT' as const, reuse: true };
    assert.equal(checkSerialForOrder(state({ status: 'INSTALLED', sodId: 'o1' }), { ...ctx, installedAtSameVoice: true }).ok, true);
    assert.equal(checkSerialForOrder(null, { ...ctx, legacyAtSameVoice: true }).ok, true);
    assert.equal(checkSerialForOrder(state({ status: 'INSTALLED', sodId: 'o1' }), ctx).code, 'CPE_SERIAL_NOT_AT_CUSTOMER');
    assert.equal(checkSerialForOrder(state(), ctx).code, 'CPE_SERIAL_NOT_AT_CUSTOMER');
});

test('a receipt needs its RTOM store, the contractor of that RTOM, a date and a clean list', () => {
    const lines = readCpeLines([{ row: 1, serial: 'AAA11111' }], 'ONT');
    const ok = { mode: 'DIRECT_TO_CONTRACTOR', opmcChosen: true, inScope: true, storeLinked: true, contractorChosen: true, contractorOfRtom: true, receivedDate: "2026-11-28", today: "2026-11-28", lines, refused: [] as { serial: string; message: string }[] };
    const first = (o: Partial<typeof ok>) => cpeReceiptGate({ ...ok, ...o }).find((c) => !c.ok)?.text ?? null;
    assert.equal(first({}), null);
    assert.match(first({ storeLinked: false })!, /no store linked/);
    assert.match(first({ inScope: false })!, /not one of yours/);
    assert.match(first({ contractorChosen: false })!, /Choose the contractor/);
    assert.match(first({ mode: 'TO_STORE' })!, /recorded to the contractor/);
    assert.match(first({ contractorOfRtom: false })!, /does not work in this RTOM/);
    assert.match(first({ receivedDate: '2026-11-29' })!, /not in the future/);
    assert.match(first({ lines: readCpeLines([{ row: 7, serial: 'x' }], 'ONT') })!, /Row 7: Serial number is too short/);
    assert.match(first({ refused: [{ serial: 'AAA11111', message: 'Serial AAA11111 belongs to R-KD' }] })!, /belongs to R-KD/);
});

test('enforcement is per RTOM: one mode or a JSON map with a default', () => {
    assert.equal(enforcementFor(undefined, 'R-KX'), 'OFF');
    assert.equal(enforcementFor('warn', 'R-KX'), 'WARN');
    assert.equal(enforcementFor('{"default":"WARN","R-KX":"ENFORCE"}', 'R-KX'), 'ENFORCE');
    assert.equal(enforcementFor('{"default":"WARN","R-KX":"ENFORCE"}', 'R-KD'), 'WARN');
    assert.equal(enforcementFor('{broken', 'R-KX'), 'OFF');
});

test('wiring: capabilities guard the routes, the history is append-only, a MIN of a CPE serial writes its history', () => {
    const migration = read('prisma/migrations/20261230000000_cpe_serial_register/migration.sql');
    assert.match(migration, /BEFORE UPDATE OR DELETE ON "CpeSerialEvent"/);
    assert.doesNotMatch(migration, /\bDROP (TABLE|COLUMN)\b/);
    assert.match(read('src/app/api/cpe-serials/receipts/route.ts'), /permissions: \[RBAC_PERMISSIONS\.INVENTORY_CPE_RECEIVE\]/);
    assert.match(read('src/app/api/cpe-serials/route.ts'), /permissions: \[RBAC_PERMISSIONS\.INVENTORY_CPE_READ\]/);
    assert.match(read('src/config/page-capabilities.ts'), /'\/service-orders\/cpe-serials', permission: RBAC_PERMISSIONS\.INVENTORY_CPE_READ/);
    assert.match(read('src/services/inventory/issue.service.ts'), /recordCpeEvent\(transaction/);
    const svc = read('src/services/inventory/cpe-serial.service.ts');
    assert.match(svc, /transactionType: 'CPE_RECEIPT'/);
    assert.match(svc, /FOR UPDATE/);
});
