import { config } from 'dotenv'; config({ path: '.env.local' });
import fs from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Data for the company procure-to-pay browser pass (ZZTEST): C-Hook 1000 requested and reviewed by the Stores Manager, OSP Manager and Head of Section,
// bought by HO from two vendors (PO-A 600, PO-B 400), handed to the stores; people with the real roles and the three finance designations.
// usage: setup <password> | check | teardown [manifest]      (the password is chosen by the caller for these temporary test accounts only)
const DIR = 'C:/Users/Prasad/AppData/Local/Temp/claude/e397d143faaeb6c1/cf013f60-1b45-4b69-8da2-52e9230f861d/scratchpad';
const MANIFEST = `${DIR}/gui6-manifest.json`;
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
        // works for any of the ZZTEST manifests of this session (users, stores, items, vendors)
        const m = JSON.parse(fs.readFileSync(process.argv[3] || MANIFEST, 'utf8'));
        for (const id of Object.values(m.users ?? {}) as string[]) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of Object.values(m.users ?? {}) as string[]) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of [m.store, ...(m.stores ?? [])].filter(Boolean)) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of [m.item, ...(m.items ?? [])].filter(Boolean)) await prisma.inventoryItem.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of [m.vendor, ...(m.vendors ?? [])].filter(Boolean)) await prisma.vendor.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6), status: 'INACTIVE' } as any }).catch(() => undefined);
        console.log('torn down'); process.exit(0);
    }

    if (mode === 'cleanup-partial') {
        // a setup that stopped half way: close the zzg6 users and the ZZG6 records it made (no manifest was written)
        const us = await prisma.user.findMany({ where: { username: { startsWith: 'zzg6_' } }, select: { id: true } });
        for (const u of us) { await UserService.deleteUser(u.id, admin).catch(() => undefined); await prisma.user.update({ where: { id: u.id }, data: { status: 'deleted', assignedStoreId: null, password: 'x!locked', email: 'deleted+' + u.id + '@example.invalid', username: 'zztest_deleted_' + u.id.slice(-8) } }).catch(() => undefined); }
        const st = await prisma.inventoryStore.updateMany({ where: { name: { startsWith: 'ZZG6' } }, data: { type: 'SUB' } });
        const stores = await prisma.inventoryStore.findMany({ where: { name: { startsWith: 'ZZG6' } }, select: { id: true } });
        for (const x of stores) await prisma.inventoryStore.update({ where: { id: x.id }, data: { name: 'ZZTEST (closed) ' + x.id.slice(-6) } });
        const items = await prisma.inventoryItem.findMany({ where: { name: { startsWith: 'ZZG6' } }, select: { id: true } });
        for (const x of items) await prisma.inventoryItem.update({ where: { id: x.id }, data: { name: 'ZZTEST (closed) ' + x.id.slice(-6) } });
        const vs = await prisma.vendor.findMany({ where: { name: { startsWith: 'ZZG6' } }, select: { id: true } });
        for (const x of vs) await prisma.vendor.update({ where: { id: x.id }, data: { name: 'ZZTEST (closed) ' + x.id.slice(-6), status: 'INACTIVE' } as any });
        console.log(JSON.stringify({ users: us.length, stores: st.count, items: items.length, vendors: vs.length })); process.exit(0);
    }

    if (mode === 'check') {
        const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        const grns: any[] = await prisma.gRN.findMany({ where: { storeId: m.store }, include: { items: true }, orderBy: { createdAt: 'asc' } });
        const invoices: any[] = await prisma.supplierInvoice.findMany({ where: { storePoId: { in: m.poIds } }, orderBy: { createdAt: 'asc' } });
        const pvs: any[] = await prisma.paymentVoucher.findMany({ where: { supplierInvoiceId: { in: invoices.map((i) => i.id) } }, orderBy: { createdAt: 'asc' } });
        const parts: any[] = await prisma.hoPaymentInstallment.findMany({ where: { paymentVoucherId: { in: pvs.map((p) => p.id) } }, orderBy: { recordedAt: 'asc' } });
        const je: any[] = await prisma.journalEntry.findMany({ where: { referenceId: { in: [...invoices.map((i) => i.id), ...pvs.map((p) => p.id), ...grns.map((g) => g.id)] } }, include: { lines: true }, orderBy: { createdAt: 'asc' } as any });
        const stock: any = await prisma.inventoryStock.findFirst({ where: { storeId: m.store, itemId: m.item }, select: { quantity: true } });
        const pos: any[] = await prisma.purchaseOrder.findMany({ where: { id: { in: m.poIds } }, include: { items: true } });
        const notes: any[] = await prisma.notification.findMany({ where: { userId: { in: Object.values(m.users) as string[] } }, select: { userId: true, title: true }, orderBy: { createdAt: 'asc' } as any });
        const keyOf = new Map(Object.entries(m.users).map(([k, v]) => [v as string, k]));
        const notices: Record<string, string[]> = {};
        for (const n of notes) (notices[keyOf.get(n.userId) as string] ??= []).push(n.title);
        console.log('CHECK ' + JSON.stringify({
            stock: num(stock?.quantity),
            pos: pos.map((p) => ({ poNumber: p.poNumber, vendor: p.vendor, status: p.status, received: p.items.map((l: any) => num(l.receivedQty)) })),
            grns: grns.map((g) => ({ grnNumber: g.grnNumber, oracle: g.oracleGrnNumber, invoiceNo: g.vendorInvoiceNumber, accepted: g.items.map((i: any) => num(i.quantity)), rejected: g.items.map((i: any) => num(i.rejectedQty)), reason: g.items.map((i: any) => i.rejectReason) })),
            invoices: invoices.map((i) => ({ invoiceNumber: i.invoiceNumber, grnLinked: !!i.grnId, status: i.status, match: i.matchStatus, total: num(i.totalAmount), paid: num(i.paidAmount), due: i.dueDate?.toISOString().slice(0, 10) ?? null })),
            pvs: pvs.map((p) => ({ status: p.status, amount: num(p.amount), hoPaid: num(p.hoPaidAmount), stage: p.approvalStage, docs: p.docsStatus })),
            notices,
            parts: parts.map((x) => ({ amount: num(x.amount), status: x.status, posted: !!x.journalEntryId })),
            journals: je.map((e) => ({ type: e.referenceType, lines: e.lines.map((l: any) => `${l.accountCode} ${num(l.debit) ? 'DR ' + num(l.debit) : 'CR ' + num(l.credit)}`) })),
        }));
        process.exit(0);
    }

    const password = process.argv[3]; if (!password) throw new Error('password argument required');
    const TAG = 'ZZG6' + Date.now().toString(36).slice(-4).toUpperCase();
    const store = await prisma.inventoryStore.create({ data: { name: `${TAG} Main Store`, type: 'MAIN', location: 'ZZTEST' } });
    const item = await prisma.inventoryItem.create({ data: { code: `${TAG}-CH`, name: `${TAG} C-Hook`, unit: 'Nos', costPrice: 100, unitPrice: 120 } });
    const vA = await prisma.vendor.create({ data: { code: `${TAG}-VA`, name: `${TAG} Vendor A`, status: 'ACTIVE' } });
    const vB = await prisma.vendor.create({ data: { code: `${TAG}-VB`, name: `${TAG} Vendor B`, status: 'ACTIVE' } });
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const users: Record<string, string> = {};
    const mk = async (key: string, role: string, storeId: string | null, designation?: string) => {
        const username = `zzg6_${key}`;
        const u: any = await UserAdminService.create({ username, email: `${username}@example.invalid`, password, name: `ZZG6 ${key}`, role: role as any, opmcIds: [opmc.id] }, admin);
        await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false, assignedStoreId: storeId } });
        if (designation) {
            const d = await prisma.systemRole.findUniqueOrThrow({ where: { code: designation }, select: { id: true, sectionId: true } });
            // the user already has a Finance assignment from the role: it becomes the designation
            await prisma.userSectionAssignment.upsert({ where: { userId_sectionId: { userId: u.id, sectionId: d.sectionId! } }, update: { roleId: d.id }, create: { userId: u.id, roleId: d.id, sectionId: d.sectionId! } });
        }
        users[key] = u.id;
    };
    await mk('so', 'STORES_EXECUTIVE', store.id);
    await mk('sm', 'STORES_MANAGER', store.id);
    await mk('osp', 'OSP_MANAGER', store.id);
    await mk('hos', 'HEAD_OF_SECTION', store.id);
    await mk('proc', 'PROCUREMENT_OFFICER', store.id);
    await mk('ao', 'FINANCE_ASSISTANT', null, 'OSP_ACCOUNT_OFFICER_FINANCE_ASSISTANT');
    await mk('am', 'FINANCE_MANAGER', null, 'OSP_ACCOUNT_MANAGER_FINANCE_MANAGER');
    await mk('ae', 'FINANCE_ASSISTANT', null, 'HO_ACCOUNT_EXECUTIVE_FINANCE_ASSISTANT');

    // the material request and its review chain: the OSP Manager first must be refused (the Stores Manager reviews first)
    const req: any = await InventoryService.createStockRequest({ fromStoreId: store.id, sourceType: 'LOCAL_PURCHASE', requestedById: users.so, priority: 'NORMAL', purpose: 'ZZG6 company flow: C-Hook', items: [{ itemId: item.id, requestedQty: 1000 }] } as any);
    const chain: string[] = [];
    const approveAs = async (key: string) => {
        const cur: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
        try {
            await InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: users[key], items: cur.items.map((i: any) => ({ id: i.id, approvedQty: num(i.requestedQty) })) } as any);
            const after: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, select: { status: true, workflowStage: true } });
            chain.push(`${key}: ok -> ${after.status}/${after.workflowStage}`);
        } catch (e: any) { chain.push(`${key}: refused (${String(e.message).slice(0, 90)})`); }
    };
    await approveAs('osp');
    for (const k of ['sm', 'osp', 'hos', 'proc']) {
        const s: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, select: { status: true } });
        if (s.status === 'APPROVED') break;
        await approveAs(k);
    }
    const r: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
    // HO bought from two vendors: one PO each, recorded by the Procurement Officer with the HO approval and 30 days credit
    const ho = (ref: string) => ({ ref, date: new Date().toISOString().slice(0, 10), approvedBy: 'ZZTEST GM Procurement', documentUrl: '/api/storage/procurement/zztest-ho-approval.pdf' });
    const poA: any = await PurchaseOrderService.createStorePo({ requestId: r.id, userId: users.proc, vendorId: vA.id, lines: [{ requestItemId: r.items[0].id, quantity: 600, unitPrice: 150 }], ho: ho(`${TAG}/HO/A`), credit: { basis: 'CREDIT', creditDays: 30 } });
    const poB: any = await PurchaseOrderService.createStorePo({ requestId: r.id, userId: users.proc, vendorId: vB.id, lines: [{ requestItemId: r.items[0].id, quantity: 400, unitPrice: 160 }], ho: ho(`${TAG}/HO/B`), credit: { basis: 'CREDIT', creditDays: 45 } });
    let overOrder = 'not tried';
    try { await PurchaseOrderService.createStorePo({ requestId: r.id, userId: users.proc, vendorId: vA.id, lines: [{ requestItemId: r.items[0].id, quantity: 1, unitPrice: 150 }], ho: ho(`${TAG}/HO/X`), credit: { basis: 'CREDIT', creditDays: 30 } }); overOrder = 'ACCEPTED (wrong)'; } catch (e: any) { overOrder = 'refused: ' + String(e.message).slice(0, 80); }
    // the Procurement Officer hands the procurement details to the stores (ready for GRN)
    await InventoryService.processStockRequestAction({ requestId: r.id, action: 'PROCUREMENT_COMPLETE', userId: users.proc } as any).catch((e: any) => chain.push('ready for GRN: ' + String(e.message).slice(0, 80)));
    const ready: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: r.id }, select: { workflowStage: true, procurementStatus: true } });
    fs.writeFileSync(MANIFEST, JSON.stringify({ tag: TAG, users, store: store.id, item: item.id, vendors: [vA.id, vB.id], vendorA: vA.name, vendorB: vB.name, requestNr: r.requestNr, poIds: [poA.id, poB.id], poA: poA.poNumber, poB: poB.poNumber }));
    console.log(JSON.stringify({ tag: TAG, request: r.requestNr, status: r.status, chain, poA: [poA.poNumber, poA.status], poB: [poB.poNumber, poB.status], overOrder, ready }));
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 700)); process.exit(1); });
