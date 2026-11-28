import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// SOD material entry browser test (localhost): a ZZTEST area (OPMC) with its own store, a ZZTEST contractor + team holding real SOD items
// (issued with a MIN), three ZZTEST service orders, and an Area Coordinator and a QC Officer limited to that area.
// usage: probe | setup <password> | check | teardown      (the password is chosen by the caller for these temporary test accounts only)
const MANIFEST = process.env.ZZ_SOD_GUI_MANIFEST || 'zz-sod-gui-manifest.json';
const num = (v: any) => Number(v ?? 0);
const stockQty = (unit: any) => (String(unit) === 'm' ? 1000 : String(unit) === 'km' ? 2 : 50);
const issueQty = (unit: any) => (String(unit) === 'm' ? 500 : String(unit) === 'km' ? 1 : 20);

async function main() {
    const mode = process.argv[2];
    const { prisma } = await import('../src/lib/prisma');

    if (mode === 'probe') {
        const ftth = await prisma.inventoryItem.findMany({ where: { isOspFtth: true } as any, select: { id: true, code: true, name: true, unit: true, type: true, hasSerial: true, costPrice: true } as any, orderBy: { code: 'asc' } });
        console.log('isOspFtth items', ftth.length); for (const i of ftth as any[]) console.log(' ', i.code, '|', i.name, '|', i.unit, '|', i.type, '| serial', i.hasSerial, '| cost', num(i.costPrice));
        const sample: any = await prisma.serviceOrder.findFirst({ where: { rtom: 'R-KX', status: { notIn: ['COMPLETED', 'RETURN'] } }, orderBy: { createdAt: 'desc' } });
        console.log('sample pending R-KX SOD keys/values:', sample && Object.fromEntries(Object.entries(sample).filter(([, v]) => v !== null && v !== false && v !== '')));
        const statuses = await prisma.serviceOrder.groupBy({ by: ['status'], where: { rtom: 'R-KX' }, _count: true });
        console.log('R-KX statuses', statuses.map((s: any) => `${s.status}:${s._count}`).join(' '));
        const rev = await prisma.sODRevenueConfig.findMany({ where: { isActive: true }, select: { rtomId: true, revenuePerSOD: true } });
        console.log('active revenue configs', rev.length, 'global', rev.filter((r) => !r.rtomId).length);
        process.exit(0);
    }

    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { IssueService } = await import('../src/services/inventory/issue.service');
    const { AuditLedgerService } = await import('../src/services/inventory/audit-ledger.service');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;

    if (mode === 'check') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        for (const id of m.sods) {
            const s: any = await prisma.serviceOrder.findUnique({ where: { id }, select: { soNum: true, status: true, sltsStatus: true, contractorId: true, teamId: true, completedDate: true, isInvoicable: true, materialUsage: { select: { itemId: true, quantity: true, usageType: true, batchId: true } } } as any });
            console.log(JSON.stringify(s));
        }
        const cs = await prisma.contractorStock.findMany({ where: { contractorId: m.contractor }, select: { itemId: true, quantity: true } });
        console.log('contractor stock', JSON.stringify(cs.map((c) => ({ item: m.itemCodes[c.itemId] ?? c.itemId, qty: num(c.quantity) }))));
        process.exit(0);
    }

    if (mode === 'teardown') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        for (const id of Object.values(m.users ?? {}) as string[]) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of Object.values(m.users ?? {}) as string[]) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of m.sods ?? []) await prisma.serviceOrder.update({ where: { id }, data: { soNum: 'ZZTEST-CLOSED-' + String(id).slice(-8), customerName: 'ZZTEST (closed)' } as any }).catch(() => undefined);
        if (m.contractor) await prisma.contractor.update({ where: { id: m.contractor }, data: { name: 'ZZTEST (closed) ' + String(m.contractor).slice(-6), status: 'INACTIVE' } as any }).catch(() => undefined);
        if (m.store) await prisma.inventoryStore.update({ where: { id: m.store }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + String(m.store).slice(-6) } }).catch(() => undefined);
        if (m.opmc) await prisma.oPMC.update({ where: { id: m.opmc }, data: { name: 'ZZTEST (closed)' } }).catch(() => undefined);
        console.log('torn down (renamed/locked; ledger rows stay)'); process.exit(0);
    }

    if (mode !== 'setup') throw new Error('usage: probe | setup <password> | check | teardown');
    const password = process.argv[3]; if (!password) throw new Error('password argument required');
    const TAG = 'ZZSG' + Date.now().toString(36).slice(-4).toUpperCase();
    const m: any = { tag: TAG, users: {}, sods: [], itemCodes: {} };
    const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));

    const opmc = await prisma.oPMC.create({ data: { rtom: TAG, name: `${TAG} Test Area` } });
    m.opmc = opmc.id; save();
    const store = await prisma.inventoryStore.create({ data: { name: `${TAG} Store`, type: 'MAIN', location: 'ZZTEST' } });
    m.store = store.id; save();
    await prisma.oPMC.update({ where: { id: opmc.id }, data: { storeId: store.id } });

    // real SOD (OSP FTTH) items, non-serial, so they appear in the material matrix
    const items: any[] = await prisma.inventoryItem.findMany({ where: { isOspFtth: true, hasSerial: false } as any, select: { id: true, code: true, unit: true, costPrice: true } as any, orderBy: { code: 'asc' } });
    if (!items.length) throw new Error('no OSP FTTH items');
    for (const it of items) {
        const qty = stockQty(it.unit);
        const cost = num(it.costPrice);
        const b = await prisma.inventoryBatch.create({ data: { itemId: it.id, initialQty: qty, costPrice: cost, unitPrice: cost, batchNumber: `${TAG}-${it.code}` } as any });
        await prisma.inventoryBatchStock.create({ data: { storeId: store.id, itemId: it.id, batchId: b.id, quantity: qty } });
        await prisma.inventoryStock.create({ data: { storeId: store.id, itemId: it.id, quantity: qty } });
        await AuditLedgerService.recordEntry({ storeId: store.id, itemId: it.id, batchId: b.id, transactionType: 'GRN_RECEIPT', referenceType: 'GRN', referenceId: `${TAG}-GRN`, quantityBefore: 0, quantityChange: qty, quantityAfter: qty, unitPrice: cost, performedById: admin });
        m.itemCodes[it.id] = it.code;
    }
    save();

    const contractor = await prisma.contractor.create({ data: { name: `${TAG} Contractor`, status: 'ACTIVE', type: 'SOD', opmcId: opmc.id } as any });
    m.contractor = contractor.id; save();
    const team = await prisma.contractorTeam.create({ data: { name: `${TAG} Team A`, contractorId: contractor.id, opmcId: opmc.id } });
    m.team = team.id; save();

    // issue half of each item to the contractor (MIN)
    const issueItems = items.map((it) => ({ itemId: it.id, quantity: issueQty(it.unit) }));
    const issue = await prisma.$transaction((tx: any) => IssueService.issueMaterial({ contractorId: contractor.id, storeId: store.id, month: new Date().toISOString().slice(0, 7), userId: admin, items: issueItems }, tx), { maxWait: 10000, timeout: 60000 });
    m.issueNumber = issue.issueNumber; save();

    // three orders: one with no contractor (assign on screen), two with the contractor (complete on screen)
    const mk = (n: number, contractorId: string | null) => prisma.serviceOrder.create({ data: {
        rtom: TAG, lea: 'ZZ', opmcId: opmc.id, soNum: `${TAG}-SOD${n}`, status: 'PENDING', sltsStatus: 'ASSIGNED', statusDate: new Date(), customerName: `${TAG} Customer ${n}`,
        orderType: 'CREATE', serviceType: 'AB-FTTH', voiceNumber: `0110000${n}${n}${n}`, address: `${n} ZZTEST Road`, dp: `ZZ-DP-000${n}`, package: 'VOICE_INT_IPTV',
        sltsPatStatus: 'PENDING', opmcPatStatus: 'PENDING', hoPatStatus: 'PENDING', qcStatus: 'PENDING_QC', woroTaskName: 'CONSTRUCT_OSP',
        contractorId, teamId: contractorId ? team.id : null, receivedDate: new Date(),
    } as any });
    for (const [n, c] of [[1, null], [2, contractor.id], [3, contractor.id]] as const) m.sods.push((await mk(n, c)).id);
    save();

    const mkUser = async (key: string, role: string) => {
        const username = `${TAG.toLowerCase()}_${key}`;
        const u: any = await UserAdminService.create({ username, email: `${username}@example.invalid`, password, name: `${TAG} ${key.toUpperCase()}`, role: role as any, opmcIds: [opmc.id] }, admin);
        await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false } });
        m.users[key] = u.id; save();
        return username;
    };
    const ac = await mkUser('ac', 'AREA_COORDINATOR');
    const qc = await mkUser('qc', 'QC_OFFICER');
    console.log(JSON.stringify({ tag: TAG, issue: m.issueNumber, items: items.length, users: { ac, qc } }));
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
