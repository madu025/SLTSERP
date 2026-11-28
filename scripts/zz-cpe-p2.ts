import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// CPE serials phase 2 test on ZZ data: a ZZTEST area, store, contractor and team, three orders (SOD1 new, SOD2 upgrade of the same voice
// number, SOD3 to be returned), serials received from SLT direct to the contractor, an Area Coordinator. Runs the completion flow through
// ServiceOrderService.updateServiceOrder (the same call the order screen makes) and prints what happened; the Collected CPE page is then
// checked in the browser. usage: setup <password> | run | check | teardown
const MANIFEST = process.env.ZZ_CPE_P2_MANIFEST || 'zz-cpe-p2-manifest.json';

async function main() {
    const mode = process.argv[2];
    const { prisma } = await import('../src/lib/prisma');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const load = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

    if (mode === 'setup') {
        const password = process.argv[3]; if (!password) throw new Error('password argument required');
        const { UserAdminService } = await import('../src/services/hr/user-admin.service');
        const { CpeSerialService } = await import('../src/services/inventory/cpe-serial.service');
        const TAG = 'ZZC2' + Date.now().toString(36).slice(-4).toUpperCase();
        const m: any = { tag: TAG, users: {} };
        const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
        const opmc = await prisma.oPMC.create({ data: { rtom: TAG, name: `${TAG} Test Area` } }); m.opmc = opmc.id; save();
        const store = await prisma.inventoryStore.create({ data: { name: `${TAG} Store`, type: 'MAIN', location: 'ZZTEST' } }); m.store = store.id; save();
        await prisma.oPMC.update({ where: { id: opmc.id }, data: { storeId: store.id } });
        const contractor = await prisma.contractor.create({ data: { name: `${TAG} Contractor`, status: 'ACTIVE', type: 'SOD', opmcId: opmc.id } as any }); m.contractor = contractor.id; save();
        const team = await prisma.contractorTeam.create({ data: { name: `${TAG} Team A`, contractorId: contractor.id, opmcId: opmc.id } }); m.team = team.id; save();
        const mkSod = async (n: number, orderType: string, voice: string) => (await prisma.serviceOrder.create({ data: {
            rtom: TAG, lea: 'ZZ', opmcId: opmc.id, soNum: `${TAG}-SOD${n}`, status: 'PENDING', sltsStatus: 'ASSIGNED', statusDate: new Date(), customerName: `${TAG} Customer ${n}`,
            orderType, serviceType: 'AB-FTTH', voiceNumber: voice, address: `${n} ZZTEST Road`, dp: 'ZZ-DP-0001', package: 'VOICE_INT_IPTV', iptv: n === 3 ? '0' : '1',
            sltsPatStatus: 'PENDING', opmcPatStatus: 'PENDING', hoPatStatus: 'PENDING', qcStatus: 'PENDING_QC', woroTaskName: 'CONSTRUCT_OSP',
            contractorId: contractor.id, teamId: team.id, receivedDate: new Date(),
        } as any })).id;
        m.sod1 = await mkSod(1, 'CREATE', '0110009981'); save();
        m.sod2 = await mkSod(2, 'MODIFY-SPEED', '0110009981'); save();
        m.sod3 = await mkSod(3, 'CREATE', '0110009982'); save();
        const u: any = await UserAdminService.create({ username: `${TAG.toLowerCase()}_ac`, email: `${TAG.toLowerCase()}_ac@example.invalid`, password, name: `${TAG} AC`, role: 'AREA_COORDINATOR' as any, opmcIds: [opmc.id] }, admin);
        m.users.ac = u.id; save();
        await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false } });
        const recv = (cpeType: 'ONT' | 'STB', serials: string[]) => CpeSerialService.receive({ userId: u.id, mode: 'DIRECT_TO_CONTRACTOR' as any, opmcId: opmc.id, contractorId: contractor.id, cpeType, model: cpeType === 'ONT' ? 'HG8145V5' : 'ZXV10', receivedDate: new Date().toISOString().slice(0, 10), rows: serials.map((serial, i) => ({ row: i + 1, serial })) });
        console.log('receipts', (await recv('ONT', [`${TAG}ONT1`, `${TAG}ONT2`])).receiptNumber ?? 'ok', (await recv('STB', [`${TAG}STB1`, `${TAG}STB2`])).receiptNumber ?? 'ok');
        await prisma.systemConfig.create({ data: { key: 'CPE_SERIAL_ENFORCEMENT', value: JSON.stringify({ [TAG]: 'ENFORCE' }) } as any }); m.config = true; save();
        console.log(JSON.stringify({ tag: TAG, user: `${TAG.toLowerCase()}_ac` }));
        process.exit(0);
    }

    if (mode === 'run') {
        const m = load(); const T = m.tag; const ac = m.users.ac;
        const { ServiceOrderService } = await import('../src/services/service-order');
        const step = async (name: string, fn: () => Promise<unknown>) => {
            try { await fn(); console.log('OK  ', name); } catch (e: any) { console.log('FAIL', name, '->', e?.message ?? e); }
        };
        const done = (extra: any) => ({ sltsStatus: 'COMPLETED', completedDate: new Date().toISOString(), contractorId: m.contractor, teamId: m.team, materialUsage: [], ...extra });
        // 1. ENFORCE: a serial SLT never issued is refused, nothing changes
        await step('SOD1 refused with an unknown ONT serial (expect FAIL)', () => ServiceOrderService.updateServiceOrder(m.sod1, done({ ontSerialNumber: `${T}NOPE`, iptvSerialNumbers: [`${T}STB1`] }), ac));
        // 2. ENFORCE: the STB is required (iptv = 1)
        await step('SOD1 refused without the STB (expect FAIL)', () => ServiceOrderService.updateServiceOrder(m.sod1, done({ ontSerialNumber: `${T}ONT1`, iptvSerialNumbers: [] }), ac));
        // 3. good completion: ONT1 + STB1 installed
        await step('SOD1 completed with ONT1 + STB1', () => ServiceOrderService.updateServiceOrder(m.sod1, done({ ontSerialNumber: `${T}ONT1`, ontType: 'NEW', iptvSerialNumbers: [`${T}STB1`], stbType: 'NEW' }), ac));
        // 4. upgrade on the same voice number: ONT1 kept, new STB2, old STB1 collected as faulty
        await step('SOD2 upgrade keeps ONT1, installs STB2, collects STB1 faulty', () => ServiceOrderService.updateServiceOrder(m.sod2, done({
            ontSerialNumber: `${T}ONT1`, ontType: 'EXISTING', iptvSerialNumbers: [`${T}STB2`], stbType: 'NEW',
            collectedCpes: [{ deviceType: 'STB', serialNumber: `${T}STB1`, condition: 'FAULTY', model: 'ZXV10', pstnNumber: '0110009981' }, { deviceType: 'PHONE', serialUnreadable: true, condition: 'FAULTY', model: 'Old phone' }],
        }), ac));
        process.exit(0);
    }

    if (mode === 'sod3') {
        // SOD3 (no IPTV) completed with ONT2, then RETURN: ONT2 goes back to the contractor
        const m = load(); const T = m.tag;
        const { ServiceOrderService } = await import('../src/services/service-order');
        await prisma.serviceOrder.update({ where: { id: m.sod3 }, data: { iptv: '0', sltsStatus: 'ASSIGNED', status: 'PENDING', returnReason: null } as any });
        const ont2 = async () => { const s = await prisma.inventoryItemSerial.findUnique({ where: { serialNumber: `${T}ONT2` }, select: { status: true, sodId: true, contractorId: true } }); console.log('   ONT2', s?.status, s?.sodId ? 'on order' : 'no order', s?.contractorId === m.contractor ? 'with contractor' : '-'); };
        for (const [n, d] of [
            ['SOD3 completed with ONT2', { sltsStatus: 'COMPLETED', completedDate: new Date().toISOString(), contractorId: m.contractor, teamId: m.team, materialUsage: [], ontSerialNumber: `${T}ONT2`, ontType: 'NEW', iptvSerialNumbers: [] }],
            ['SOD3 returned', { sltsStatus: 'RETURN', returnReason: 'ZZ test return' }],
        ] as const) {
            try { await ServiceOrderService.updateServiceOrder(m.sod3, d as any, m.users.ac); console.log('OK  ', n); } catch (e: any) { console.log('FAIL', n, '->', e?.message); }
            await ont2();
        }
        process.exit(0);
    }

    if (mode === 'check') {
        const m = load();
        const serials = await prisma.inventoryItemSerial.findMany({ where: { opmcId: m.opmc }, select: { serialNumber: true, status: true, contractorId: true, sodId: true }, orderBy: { serialNumber: 'asc' } });
        const sods = await prisma.serviceOrder.findMany({ where: { opmcId: m.opmc }, select: { id: true, soNum: true, sltsStatus: true } });
        const so = (id: string | null) => sods.find((s) => s.id === id)?.soNum ?? id;
        const events = await prisma.cpeSerialEvent.findMany({ where: { opmcId: m.opmc }, select: { serialNumber: true, eventType: true, toStatus: true, documentNumber: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        const collected = await prisma.collectedCPE.findMany({ where: { opmcId: m.opmc }, select: { deviceType: true, serialNumber: true, serialUnreadable: true, condition: true, status: true, handbackReference: true } });
        const cstock = await prisma.contractorStock.findMany({ where: { contractorId: m.contractor }, select: { quantity: true, item: { select: { code: true } } } });
        console.log(JSON.stringify({
            sods: sods.map((s) => [s.soNum, s.sltsStatus]), serials: serials.map((s) => [s.serialNumber, s.status, so(s.sodId)]), events: events.map((e) => [e.serialNumber, e.eventType, e.toStatus, e.documentNumber]),
            collected: collected.map((c) => [c.deviceType, c.serialUnreadable ? '(unreadable)' : c.serialNumber, c.condition, c.status, c.handbackReference]),
            contractorStock: cstock.map((s) => [s.item.code, Number(s.quantity)]),
        }, null, 1));
        process.exit(0);
    }

    if (mode === 'teardown') {
        const m = load();
        const { UserService } = await import('../src/services/hr/user.service');
        if (m.config) await prisma.systemConfig.deleteMany({ where: { key: 'CPE_SERIAL_ENFORCEMENT', value: { contains: m.tag } } });
        for (const id of Object.values(m.users ?? {}) as string[]) {
            await UserService.deleteUser(id, admin).catch(() => undefined);
            await prisma.user.update({ where: { id }, data: { status: 'deleted', permissions: '[]', password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } as any }).catch(() => undefined);
        }
        for (const k of ['sod1', 'sod2', 'sod3']) if (m[k]) await prisma.serviceOrder.update({ where: { id: m[k] }, data: { soNum: `ZZTEST-CLOSED-${k}-` + String(m[k]).slice(-8), customerName: 'ZZTEST (closed)' } as any }).catch(() => undefined);
        if (m.contractor) await prisma.contractor.update({ where: { id: m.contractor }, data: { name: 'ZZTEST (closed) ' + String(m.contractor).slice(-6), status: 'INACTIVE' } as any }).catch(() => undefined);
        if (m.store) await prisma.inventoryStore.update({ where: { id: m.store }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + String(m.store).slice(-6) } }).catch(() => undefined);
        if (m.opmc) await prisma.oPMC.update({ where: { id: m.opmc }, data: { name: 'ZZTEST (closed)' } }).catch(() => undefined);
        console.log('torn down (renamed/locked; ledger, CPE history and the ZZ serials stay; enforcement config row removed)'); process.exit(0);
    }
    throw new Error('usage: setup <password> | run | check | teardown');
}
main().catch((e) => { console.error(e); process.exit(1); });
