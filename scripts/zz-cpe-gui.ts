import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// CPE serial browser test (localhost, phase 1): a ZZTEST area (OPMC) with its own store, a ZZTEST contractor + team, one ZZTEST order with that
// contractor, and an Area Coordinator, a QC Officer and a Stores Executive limited to that area. Until the RBAC seed has run after the deploy, the
// people get the new CPE capabilities through an audited-style override (their inherited grants + inventory.cpe.*).
// usage: setup <password> | check | teardown      (the password is chosen by the caller for these temporary test accounts only)
const MANIFEST = process.env.ZZ_CPE_GUI_MANIFEST || 'zz-cpe-gui-manifest.json';

async function main() {
    const mode = process.argv[2];
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { getUserEffectivePermissions } = await import('../src/lib/user-permissions');
    const { RBAC_PERMISSIONS } = await import('../src/config/rbac-permissions');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;

    if (mode === 'check') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        const serials = await prisma.inventoryItemSerial.findMany({ where: { opmcId: m.opmc }, select: { serialNumber: true, status: true, contractorId: true, storeId: true, issueCycle: true, receipt: { select: { receiptNumber: true } } }, orderBy: { serialNumber: 'asc' } });
        const receipts = await prisma.cpeReceipt.findMany({ where: { opmcId: m.opmc }, select: { receiptNumber: true, mode: true, quantity: true, issueNumber: true } });
        const events = await prisma.cpeSerialEvent.findMany({ where: { opmcId: m.opmc }, select: { serialNumber: true, eventType: true, toStatus: true, documentNumber: true, previousChecksum: true, checksum: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        const stock = await prisma.inventoryStock.findMany({ where: { storeId: m.store }, select: { quantity: true, item: { select: { code: true } } } });
        const cstock = await prisma.contractorStock.findMany({ where: { contractorId: m.contractor }, select: { quantity: true, item: { select: { code: true } } } });
        const ledger = await prisma.inventoryLedger.findMany({ where: { storeId: m.store }, select: { transactionType: true, quantityChange: true, quantityAfter: true }, orderBy: { createdAt: 'asc' } });
        console.log(JSON.stringify({ serials, receipts, events: events.map((e) => [e.serialNumber, e.eventType, e.toStatus, e.documentNumber]), store: stock.map((s) => [s.item.code, Number(s.quantity)]), contractor: cstock.map((s) => [s.item.code, Number(s.quantity)]), ledger: ledger.map((l) => [l.transactionType, Number(l.quantityChange), Number(l.quantityAfter)]) }, null, 1));
        process.exit(0);
    }

    if (mode === 'teardown') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        for (const id of Object.values(m.users ?? {}) as string[]) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of Object.values(m.users ?? {}) as string[]) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, permissions: '[]', password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        if (m.sod) await prisma.serviceOrder.update({ where: { id: m.sod }, data: { soNum: 'ZZTEST-CLOSED-' + String(m.sod).slice(-8), customerName: 'ZZTEST (closed)' } as any }).catch(() => undefined);
        if (m.contractor) await prisma.contractor.update({ where: { id: m.contractor }, data: { name: 'ZZTEST (closed) ' + String(m.contractor).slice(-6), status: 'INACTIVE' } as any }).catch(() => undefined);
        if (m.store) await prisma.inventoryStore.update({ where: { id: m.store }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + String(m.store).slice(-6) } }).catch(() => undefined);
        if (m.opmc) await prisma.oPMC.update({ where: { id: m.opmc }, data: { name: 'ZZTEST (closed)' } }).catch(() => undefined);
        console.log('torn down (renamed/locked; ledger, CPE history and the ZZ serials stay)'); process.exit(0);
    }

    if (mode !== 'setup' && mode !== 'users') throw new Error('usage: setup <password> | users <password> | check | teardown');
    const password = process.argv[3]; if (!password) throw new Error('password argument required');
    const resume = mode === 'users';
    const m: any = resume ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { tag: 'ZZCP' + Date.now().toString(36).slice(-4).toUpperCase(), users: {} };
    const TAG: string = m.tag;
    const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
    const opmc = resume ? await prisma.oPMC.findUniqueOrThrow({ where: { id: m.opmc } }) : undefined as any;
    const store = resume ? await prisma.inventoryStore.findUniqueOrThrow({ where: { id: m.store } }) : undefined as any;
    const sod = resume ? await prisma.serviceOrder.findUniqueOrThrow({ where: { id: m.sod } }) : undefined as any;
    if (!resume) await createData();
    async function createData() {
    const opmc = await prisma.oPMC.create({ data: { rtom: TAG, name: `${TAG} Test Area` } }); m.opmc = opmc.id; save();
    const store = await prisma.inventoryStore.create({ data: { name: `${TAG} Store`, type: 'MAIN', location: 'ZZTEST' } }); m.store = store.id; save();
    await prisma.oPMC.update({ where: { id: opmc.id }, data: { storeId: store.id } });
    const contractor = await prisma.contractor.create({ data: { name: `${TAG} Contractor`, status: 'ACTIVE', type: 'SOD', opmcId: opmc.id } as any }); m.contractor = contractor.id; save();
    const team = await prisma.contractorTeam.create({ data: { name: `${TAG} Team A`, contractorId: contractor.id, opmcId: opmc.id } }); m.team = team.id; save();
    const sod = await prisma.serviceOrder.create({ data: {
        rtom: TAG, lea: 'ZZ', opmcId: opmc.id, soNum: `${TAG}-SOD1`, status: 'PENDING', sltsStatus: 'ASSIGNED', statusDate: new Date(), customerName: `${TAG} Customer 1`,
        orderType: 'CREATE', serviceType: 'AB-FTTH', voiceNumber: '0110009991', address: '1 ZZTEST Road', dp: 'ZZ-DP-0001', package: 'VOICE_INT_IPTV', iptv: '1',
        sltsPatStatus: 'PENDING', opmcPatStatus: 'PENDING', hoPatStatus: 'PENDING', qcStatus: 'PENDING_QC', woroTaskName: 'CONSTRUCT_OSP',
        contractorId: contractor.id, teamId: team.id, receivedDate: new Date(),
    } as any }); m.sod = sod.id; save();
    Object.assign(globalThis, { __zz: { opmc, store, sod } });
    }
    const made: any = (globalThis as any).__zz ?? { opmc, store, sod };

    const extra = [RBAC_PERMISSIONS.INVENTORY_CPE_READ, RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE];
    const mkUser = async (key: string, role: string, storeId: string | null, receive: boolean) => {
        const username = `${TAG.toLowerCase()}_${key}`;
        const u: any = (await prisma.user.findFirst({ where: { username } })) ?? await UserAdminService.create({ username, email: `${username}@example.invalid`, password, name: `${TAG} ${key.toUpperCase()}`, role: role as any, opmcIds: [made.opmc.id] }, admin);
        m.users[key] = u.id; save();
        const inherited = await getUserEffectivePermissions(u.id);
        await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false, assignedStoreId: storeId, permissions: JSON.stringify([...new Set([...inherited, ...(receive ? extra : extra.slice(0, 1))])]) } });
        m.users[key] = u.id; save();
        return username;
    };
    const ac = await mkUser('ac', 'AREA_COORDINATOR', null, true);
    const qc = await mkUser('qc', 'QC_OFFICER', null, true);
    const se = await mkUser('se', 'STORES_EXECUTIVE', made.store.id, true);
    console.log(JSON.stringify({ tag: TAG, sod: made.sod.soNum, users: { ac, qc, se } }));
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
