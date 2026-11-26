import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Data for the HO-mode procurement browser pass (ZZTEST): a main store, two items, one vendor, people with the real roles, two approved purchase requests.
// The browser records the PO of request 1 with its HO approval; this script records the PO of request 2 (HO evidence too), so one GRN can receive both.
// usage: setup <password> | check | teardown      (the password is chosen by the caller for these temporary test accounts only)
const MANIFEST = 'C:/Users/Prasad/AppData/Local/Temp/claude/e397d143faaeb6c1/cf013f60-1b45-4b69-8da2-52e9230f861d/scratchpad/gui4-manifest.json';
const num = (v: any) => Number(v ?? 0);

async function main() {
    const mode = process.argv[2];
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { InventoryService } = await import('../src/services/inventory');
    const { PurchaseOrderService } = await import('../src/services/procurement/purchase-order.service');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;

    if (mode === 'teardown') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        for (const id of Object.values(m.users) as string[]) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of Object.values(m.users) as string[]) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of m.stores) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of m.items) await prisma.inventoryItem.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        await prisma.vendor.update({ where: { id: m.vendor }, data: { name: 'ZZTEST (closed) ' + m.vendor.slice(-6), status: 'INACTIVE' } as any }).catch(() => undefined);
        console.log('torn down'); process.exit(0);
    }

    if (mode === 'check') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        const pos: any[] = await prisma.purchaseOrder.findMany({ where: { stockRequestId: { in: m.requestIds } }, include: { items: true }, orderBy: { createdAt: 'asc' } });
        const stock: any[] = await prisma.inventoryStock.findMany({ where: { storeId: m.stores[0], itemId: { in: m.items } }, select: { itemId: true, quantity: true } });
        const grns: any[] = await prisma.gRN.findMany({ where: { storeId: m.stores[0] }, include: { items: true } });
        const reqs: any[] = await prisma.stockRequest.findMany({ where: { id: { in: m.requestIds } }, select: { requestNr: true, status: true } });
        const je = await prisma.journalEntry.findMany({ where: { referenceId: { in: pos.map((p) => p.id) }, referenceType: 'PURCHASE_ORDER' }, include: { lines: true } as any });
        const grnJe: any[] = await prisma.journalEntry.findMany({ where: { referenceId: { in: grns.map((g) => g.id) }, referenceType: 'GRN' }, include: { lines: true } as any });
        const items: any[] = await prisma.inventoryItem.findMany({ where: { id: { in: m.items } }, select: { id: true, costPrice: true } });
        const batches: any[] = await prisma.inventoryBatch.findMany({ where: { grnId: { in: grns.map((g) => g.id) } }, select: { itemId: true, costPrice: true, initialQty: true } });
        const ledger: any[] = await prisma.inventoryLedger.findMany({ where: { storeId: m.stores[0], transactionType: 'GRN_RECEIPT' }, select: { itemId: true, quantityChange: true, quantityAfter: true, unitPrice: true, checksum: true }, orderBy: { createdAt: 'asc' } });
        const { getProcurementConfig } = await import('../src/services/procurement/procurement-config');
        const cfg: any = await getProcurementConfig(prisma as any);
        const lines = (e: any) => e.lines.map((l: any) => ({ account: l.accountCode, debit: num(l.debit), credit: num(l.credit) }));
        const key = (id: string) => (id === m.items[0] ? 'A' : 'B');
        console.log('CHECK ' + JSON.stringify({
            pos: pos.map((p) => ({ poNumber: p.poNumber, status: p.status, hoApprovalRef: p.hoApprovalRef, hasDocument: !!p.hoDocumentUrl, hoPaymentRef: p.hoPaymentRef, hoCleared: num(p.hoClearedAmount), received: p.items.map((l: any) => num(l.receivedQty)) })),
            stock: Object.fromEntries(stock.map((s) => [s.itemId === m.items[0] ? 'A' : 'B', num(s.quantity)])),
            grns: grns.map((g) => ({ grnNumber: g.grnNumber, purchaseOrderId: g.purchaseOrderId, lines: g.items.length, linkedLines: g.items.filter((i: any) => i.poItemId).length, batches: g.items.filter((i: any) => i.batchId).length })),
            requests: reqs, hoJournal: je.length, hoJournalLines: je.map(lines), grnJournal: grnJe.map((e) => ({ status: e.status, lines: lines(e) })),
            costingMethod: cfg.costingMethod, itemCost: Object.fromEntries(items.map((i) => [key(i.id), num(i.costPrice)])),
            batches: batches.map((b) => ({ item: key(b.itemId), qty: num(b.initialQty), cost: num(b.costPrice) })),
            ledger: ledger.map((l) => ({ item: key(l.itemId), change: num(l.quantityChange), after: num(l.quantityAfter), unitPrice: num(l.unitPrice), sealed: !!l.checksum })),
        }));
        process.exit(0);
    }

    const password = process.argv[3]; if (!password) throw new Error('password argument required');
    const TAG = 'ZZG4' + Date.now().toString(36).slice(-4).toUpperCase();
    const main = await prisma.inventoryStore.create({ data: { name: `${TAG} Main Store`, type: 'MAIN', location: 'ZZTEST' } });
    const itemA = await prisma.inventoryItem.create({ data: { code: `${TAG}-A`, name: `${TAG} Drop wire`, unit: 'm', costPrice: 10, unitPrice: 12 } });
    const itemB = await prisma.inventoryItem.create({ data: { code: `${TAG}-B`, name: `${TAG} Clamp`, unit: 'Nos', costPrice: 5, unitPrice: 6 } });
    const vendor = await prisma.vendor.create({ data: { code: `${TAG}-V`, name: `${TAG} Supplier`, status: 'ACTIVE' } });
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const users: Record<string, string> = {};
    const mk = async (key: string, role: string, store: string | null) => {
        const username = `zzg4_${key}`;
        const u: any = await UserAdminService.create({ username, email: `${username}@example.invalid`, password, name: `ZZG4 ${key}`, role: role as any, opmcIds: [opmc.id] }, admin);
        await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false, assignedStoreId: store } });
        users[key] = u.id;
    };
    await mk('proc', 'PROCUREMENT_OFFICER', main.id);
    await mk('exec', 'STORES_EXECUTIVE', main.id);
    await mk('mgr', 'STORES_MANAGER', main.id);
    await mk('hos', 'HEAD_OF_SECTION', main.id);
    await mk('fm', 'FINANCE_MANAGER', null);

    const approve = async (lines: { itemId: string; requestedQty: number }[]) => {
        const req: any = await InventoryService.createStockRequest({ fromStoreId: main.id, sourceType: 'LOCAL_PURCHASE', requestedById: users.exec, priority: 'NORMAL', purpose: 'ZZG4 HO-mode procurement pass', items: lines } as any);
        for (let round = 0; round < 3; round++) {
            const cur: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
            if (cur.status === 'APPROVED') break;
            for (const approver of [users.hos, users.mgr, users.proc, users.exec]) {
                try { await InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: approver, items: cur.items.map((i: any) => ({ id: i.id, approvedQty: num(i.requestedQty) })) } as any); break; } catch { /* the next role */ }
            }
        }
        return prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
    };
    const req1: any = await approve([{ itemId: itemA.id, requestedQty: 100 }, { itemId: itemB.id, requestedQty: 50 }]);
    const req2: any = await approve([{ itemId: itemA.id, requestedQty: 40 }]);
    // request 2's order, recorded with its HO approval (the browser records request 1's)
    const po2: any = await PurchaseOrderService.createStorePo({
        requestId: req2.id, userId: users.proc, vendorId: vendor.id,
        lines: [{ requestItemId: req2.items[0].id, quantity: 40, unitPrice: 2100 }],
        ho: { ref: `${TAG}/HO/0002`, date: new Date().toISOString().slice(0, 10), approvedBy: 'ZZTEST GM Procurement', documentUrl: '/api/storage/procurement/zztest-ho-approval.pdf' },
    });
    fs.writeFileSync(MANIFEST, JSON.stringify({ tag: TAG, users, stores: [main.id], items: [itemA.id, itemB.id], vendor: vendor.id, vendorName: vendor.name, requestIds: [req1.id, req2.id], requestNr1: req1.requestNr, po2: po2.poNumber }));
    console.log(JSON.stringify({ tag: TAG, req1: req1.requestNr, req1Status: req1.status, req2: req2.requestNr, req2Status: req2.status, po2: po2.poNumber, po2Status: po2.status, vendor: vendor.name, itemA: itemA.name, itemB: itemB.name }));
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 700)); process.exit(1); });
