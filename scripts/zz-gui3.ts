import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Data for the procurement browser pass (localhost, ZZTEST): stores, items, vendor, people with the REAL roles, an approved purchase request and a purchase order
// that still waits for approval. After the browser has approved the order: `step2` receives the goods and enters the supplier invoice (as the real roles).
// usage: setup <password> | step2 | teardown      (the password is chosen by the caller for these temporary test accounts only)
const MANIFEST = 'C:/Users/Prasad/AppData/Local/Temp/claude/e397d143faaeb6c1/cf013f60-1b45-4b69-8da2-52e9230f861d/scratchpad/gui3-manifest.json';
const num = (v: any) => Number(v ?? 0);

async function main() {
    const mode = process.argv[2];
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { InventoryService } = await import('../src/services/inventory');
    const { PurchaseOrderService } = await import('../src/services/procurement/purchase-order.service');
    const { SupplierInvoiceService } = await import('../src/services/procurement/supplier-invoice.service');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;

    if (mode === 'teardown') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        for (const id of Object.values(m.users) as string[]) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of Object.values(m.users) as string[]) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of m.stores) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of m.items) await prisma.inventoryItem.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        if (m.vendor) await prisma.vendor.update({ where: { id: m.vendor }, data: { name: 'ZZTEST (closed) ' + m.vendor.slice(-6), status: 'INACTIVE' } as any }).catch(() => undefined);
        await prisma.stockRequest.updateMany({ where: { id: m.requestId, status: { in: ['PENDING', 'APPROVED'] } }, data: { status: 'REJECTED', workflowStage: 'REJECTED', remarks: 'ZZTEST data closed' } as any }).catch(() => undefined);
        console.log('torn down'); process.exit(0);
    }

    if (mode === 'step2') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        const po: any = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: m.poId }, include: { items: { include: { stockRequestItem: true } } } });
        console.log('PO status now', po.status);
        if (po.status === 'APPROVED') await PurchaseOrderService.issueStorePo(po.id, m.users.proc);
        const itemA = m.items[0], itemB = m.items[1];
        await InventoryService.createGRN({ storeId: m.stores[0], sourceType: 'LOCAL_PURCHASE', supplier: m.vendorName, receivedById: m.users.exec, purchaseOrderId: po.id, items: [{ itemId: itemA, quantity: 100 }, { itemId: itemB, quantity: 50 }] } as any);
        // the supplier invoice is entered in the browser (Supplier Invoices screen), so only the goods are received here
        console.log(JSON.stringify({ step2: 'goods received', po: po.poNumber }));
        process.exit(0);
    }

    if (mode === 'addosp') {
        // the people who really hold procurement.write above the maker: an OSP Manager and the Head of OSP
        const pw = process.argv[3]; if (!pw) throw new Error('password argument required');
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        const opmcId = (await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } })).id;
        for (const [key, role] of [['osp', 'OSP_MANAGER'], ['hosp', 'HEAD_OF_OSP']] as Array<[string, string]>) {
            const username = 'zzg3_' + key;
            const u: any = await UserAdminService.create({ username, email: username + '@example.invalid', password: pw, name: 'ZZG3 ' + key, role: role as any, opmcIds: [opmcId] }, admin);
            await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false, assignedStoreId: m.stores[0] } });
            m.users[key] = u.id;
        }
        fs.writeFileSync(MANIFEST, JSON.stringify(m));
        console.log('added zzg3_osp (OSP_MANAGER) and zzg3_hosp (HEAD_OF_OSP)');
        process.exit(0);
    }

    const password = process.argv[3]; if (!password) throw new Error('password argument required');
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const TAG = 'ZZG3' + Date.now().toString(36).slice(-4).toUpperCase();
    const main = await prisma.inventoryStore.create({ data: { name: `${TAG} Main Store`, type: 'MAIN', location: 'ZZTEST' } });
    const sub = await prisma.inventoryStore.create({ data: { name: `${TAG} Sub Store`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmc.id }] } } });
    const itemA = await prisma.inventoryItem.create({ data: { code: `${TAG}-A`, name: `${TAG} Drop wire`, unit: 'm', costPrice: 10, unitPrice: 12 } });
    const itemB = await prisma.inventoryItem.create({ data: { code: `${TAG}-B`, name: `${TAG} Clamp`, unit: 'Nos', costPrice: 5, unitPrice: 6 } });
    const vendor = await prisma.vendor.create({ data: { code: `${TAG}-V`, name: `${TAG} Supplier`, status: 'ACTIVE' } });
    const users: Record<string, string> = {};
    const mk = async (key: string, role: string, store: string | null) => {
        const username = `zzg3_${key}`;
        const u: any = await UserAdminService.create({ username, email: `${username}@example.invalid`, password, name: `ZZG3 ${key}`, role: role as any, opmcIds: [opmc.id] }, admin);
        await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false, assignedStoreId: store } });
        users[key] = u.id;
    };
    await mk('proc', 'PROCUREMENT_OFFICER', null);
    await mk('exec', 'STORES_EXECUTIVE', main.id);
    await mk('mgr', 'STORES_MANAGER', main.id);
    await mk('fm', 'FINANCE_MANAGER', null);
    await mk('hos', 'HEAD_OF_SECTION', main.id);
    // the purchase order chain: step 1 OSP Manager, step 2 Head of OSP, step 3 Finance Manager (fm); the CEO gives the second approval of a payment above 5M
    await mk('osp', 'OSP_MANAGER', main.id);
    await mk('hosp', 'HEAD_OF_OSP', main.id);
    await mk('ceo', 'CEO', main.id);

    // the purchase request goes through its approval chain (as in the procure-to-pay run)
    const req: any = await InventoryService.createStockRequest({ fromStoreId: main.id, sourceType: 'LOCAL_PURCHASE', requestedById: users.exec, priority: 'NORMAL', purpose: 'ZZG3 procurement browser pass', items: [{ itemId: itemA.id, requestedQty: 100 }, { itemId: itemB.id, requestedQty: 50 }] } as any);
    for (let round = 0; round < 3; round++) {
        const cur: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
        if (cur.status === 'APPROVED') break;
        for (const approver of [users.hos, users.mgr, users.proc, users.exec]) {
            try { await InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: approver, items: cur.items.map((i: any) => ({ id: i.id, approvedQty: num(i.requestedQty) })) } as any); break; } catch { /* the next role */ }
        }
    }
    const reqRow: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
    // above 5 million even without tax (the invoice form leaves tax empty), so that the supplier invoice also needs the CEO's second approval
    const lines = [{ requestItemId: reqRow.items.find((i: any) => i.itemId === itemA.id).id, quantity: 100, unitPrice: 55000, taxAmount: 450000 }, { requestItemId: reqRow.items.find((i: any) => i.itemId === itemB.id).id, quantity: 50, unitPrice: 8000, taxAmount: 72000 }];
    const po: any = await PurchaseOrderService.createStorePo({ requestId: req.id, userId: users.proc, vendorId: vendor.id, lines });
    fs.writeFileSync(MANIFEST, JSON.stringify({ tag: TAG, users, stores: [main.id, sub.id], items: [itemA.id, itemB.id], vendor: vendor.id, vendorName: vendor.name, requestId: req.id, requestNr: reqRow.requestNr, poId: po.id, poNumber: po.poNumber }));
    console.log(JSON.stringify({ tag: TAG, request: reqRow.requestNr, requestStatus: reqRow.status, po: po.poNumber, poStatus: po.status, poTotal: num(po.totalAmount), logins: Object.keys(users).map((k) => `zzg3_${k}`) }));
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 700)); process.exit(1); });
