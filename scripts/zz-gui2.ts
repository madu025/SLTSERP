import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Test data and test people for the inventory GUI test (localhost): ZZTEST stores, items, stock in the main store, people with the REAL roles.
// usage: setup <password> | teardown      (the password is chosen by the caller for these temporary test accounts only)
const MANIFEST = 'C:/Users/Prasad/AppData/Local/Temp/claude/e397d143faaeb6c1/cf013f60-1b45-4b69-8da2-52e9230f861d/scratchpad/inv-gui2-manifest.json';
async function main() {
    const mode = process.argv[2];
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { InventoryService } = await import('../src/services/inventory');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;

    if (mode === 'teardown') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        for (const id of m.users) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of m.users) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of m.stores) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of m.contractors ?? []) await prisma.contractor.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        if (m.sod) await prisma.serviceOrder.update({ where: { id: m.sod }, data: { soNum: 'ZZTEST-CLOSED-' + String(m.sod).slice(-8), customerName: 'ZZTEST (closed)', contractorId: null } as any }).catch(() => undefined);
        console.log('torn down', m.users.length, 'users,', m.stores.length, 'stores'); process.exit(0);
    }

    const password = process.argv[3]; if (!password) throw new Error('password argument required');
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const TAG = 'ZZG2' + Date.now().toString(36).slice(-4).toUpperCase();
    const main = await prisma.inventoryStore.create({ data: { name: `${TAG} Main Store`, type: 'MAIN', location: 'ZZTEST' } });
    const kad = await prisma.inventoryStore.create({ data: { name: `${TAG} Kaduwela`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmc.id }] } } });
    const itemA = await prisma.inventoryItem.create({ data: { code: `${TAG}-A`, name: `${TAG} Drop wire`, unit: 'm', costPrice: 10, unitPrice: 12 } });
    const itemB = await prisma.inventoryItem.create({ data: { code: `${TAG}-B`, name: `${TAG} Clamp`, unit: 'Nos', costPrice: 5, unitPrice: 6 } });
    const tpl = await prisma.contractor.findFirstOrThrow({ where: { opmcId: opmc.id } });
    const { id: _i, registrationNumber: _r, registrationToken: _t, uploadToken: _u, ...rest } = tpl as any;
    const contractor = await prisma.contractor.create({ data: { ...rest, name: `${TAG} Kaduwela Contractor`, registrationNumber: `${TAG}-C`, opmcId: opmc.id, status: 'ACTIVE' } as any });
    const foreignOpmc = await prisma.oPMC.findFirstOrThrow({ where: { id: { not: opmc.id } } });
    const foreign = await prisma.contractor.create({ data: { ...rest, name: `${TAG} OtherArea Contractor`, registrationNumber: `${TAG}-F`, opmcId: foreignOpmc.id, status: 'ACTIVE' } as any });
    const users: Record<string, string> = {};
    const mk = async (key: string, role: string, store: string | null) => {
        const username = `zzg2_${key}`;
        const u: any = await UserAdminService.create({ username, email: `${username}@example.invalid`, password, name: `ZZG2 ${key}`, role: role as any, opmcIds: [opmc.id] }, admin);
        await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false, assignedStoreId: store } });
        users[key] = u.id;
    };
    await mk('officer', 'STORES_ASSISTANT', kad.id);
    await mk('exec', 'STORES_EXECUTIVE', main.id);
    await mk('mgr', 'STORES_MANAGER', main.id);
    await mk('mainoff', 'STORES_ASSISTANT', main.id);
    // stock in the main store through a GRN by the Executive
    await InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: users.exec, items: [{ itemId: itemA.id, quantity: 200 }, { itemId: itemB.id, quantity: 100 }] } as any);
    // a contractor portal login for the Kaduwela contractor (same role/designation as an existing contractor user), and a sample SOD of that contractor
    const supRole = await prisma.systemRole.findFirstOrThrow({ where: { code: 'CONTRACTOR_SUPERVISOR' }, select: { id: true } });
    const tmplUser = { role: 'CONTRACTOR_SUPERVISOR', roleId: supRole.id };
    const cu = await prisma.user.create({ data: { username: 'zzg2_contractor', email: 'zzg2_contractor@example.invalid', name: 'ZZG2 contractor user', password: await bcrypt.hash(password, 10), role: tmplUser.role, roleId: tmplUser.roleId, status: 'active', contractorId: contractor.id, mustChangePassword: false } as any });
    users.contractor = cu.id;
    const sod: any = await prisma.serviceOrder.create({ data: { soNum: TAG + '-SOD', rtom: 'R-KX', status: 'INPROGRESS', sltsStatus: 'INPROGRESS', opmcId: opmc.id, contractorId: contractor.id, customerName: 'ZZG2 sample SOD (safe to delete)' } as any });
    fs.writeFileSync(MANIFEST, JSON.stringify({ tag: TAG, users: Object.values(users), stores: [main.id, kad.id], contractors: [contractor.id, foreign.id], sod: sod.id, soNum: sod.soNum, contractorName: contractor.name, main: main.name, kad: kad.name, itemA: itemA.name, itemB: itemB.name }));
    console.log(JSON.stringify({ contractor: contractor.name, other: foreign.name, tag: TAG, main: main.name, kaduwela: kad.name, items: [itemA.name, itemB.name], logins: Object.keys(users).map((k) => `zzg2_${k}`) }));
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 700)); process.exit(1); });
