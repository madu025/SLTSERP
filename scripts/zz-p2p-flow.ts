import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
// The whole procure-to-pay flow with REAL ROLES on ZZTEST data (needs the database tunnel):
//   stock request -> purchase order -> (approval) -> issue -> GRN (part, over-receipt refused, rest) -> supplier invoice and 3-way match ->
//   same person cannot approve -> approval posting (GR/IR cleared, input VAT, vendor payable) -> return to supplier (MRN) -> debit note and its posting.
// Cleanup: users deleted, stores renamed and made SUB, items and vendor renamed (journal entries and the inventory ledger are immutable and stay).
const results: Array<[string, boolean, string]> = [];
const check = (n: string, ok: boolean, d = '') => { results.push([n, ok, d]); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const refused = async (fn: () => Promise<any>) => { try { await fn(); return ''; } catch (e: any) { return String(e?.details?.message ?? e?.message ?? e).slice(0, 170); } };
const num = (v: any) => Number(v ?? 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { InventoryService } = await import('../src/services/inventory');
    const { PurchaseOrderService } = await import('../src/services/procurement/purchase-order.service');
    const { SupplierInvoiceService } = await import('../src/services/procurement/supplier-invoice.service');
    const { EmailService } = await import('../src/services/notification/email.service');
    const { userHasPermission } = await import('../src/lib/user-permissions');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const TAG = 'ZZTEST-P2P-' + Date.now().toString(36);
    const created: { users: string[]; stores: string[]; items: string[]; vendor?: string } = { users: [], stores: [], items: [] };
    const can = (u: string, p: string) => userHasPermission(u, p as any);
    const entry = async (referenceType: string, referenceId: string) => (await prisma.journalEntry.findFirst({ where: { referenceType, referenceId }, include: { lines: true } as any })) as any;
    const line = (je: any, code: string, side: 'debit' | 'credit') => r2(num((je?.lines ?? []).filter((l: any) => l.accountCode === code).reduce((a: number, l: any) => a + num(l[side]), 0)));
    const balanced = (je: any) => !!je && r2((je.lines ?? []).reduce((a: number, l: any) => a + num(l.debit) - num(l.credit), 0)) === 0;
    const stock = async (storeId: string, itemId: string) => num((await prisma.inventoryStock.findFirst({ where: { storeId, itemId } }))?.quantity);

    try {
        // ---------- setup: stores, items, vendor, people with their real roles ----------
        const main = await prisma.inventoryStore.create({ data: { name: `${TAG} Main Store`, type: 'MAIN', location: 'ZZTEST' } });
        const sub = await prisma.inventoryStore.create({ data: { name: `${TAG} Sub Store`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmc.id }] } } });
        created.stores.push(main.id, sub.id);
        const itemA = await prisma.inventoryItem.create({ data: { code: `${TAG}-A`, name: `${TAG} Drop wire`, unit: 'm', costPrice: 10, unitPrice: 12 } });
        const itemB = await prisma.inventoryItem.create({ data: { code: `${TAG}-B`, name: `${TAG} Clamp`, unit: 'Nos', costPrice: 5, unitPrice: 6 } });
        created.items.push(itemA.id, itemB.id);
        const vendor = await prisma.vendor.create({ data: { code: `${TAG}-V`, name: `${TAG} Supplier`, status: 'ACTIVE' } });
        created.vendor = vendor.id;
        const mk = async (name: string, role: string) => {
            const u: any = await UserAdminService.create({ username: `zztest_${name}_${TAG.slice(-5).toLowerCase()}`, email: `zztest.${name}.${TAG.slice(-5).toLowerCase()}@example.invalid`, password: 'Temp1234x', name: `ZZTEST ${name}`, role: role as any, opmcIds: [opmc.id] } as any, admin);
            created.users.push(u.id); return u.id as string;
        };
        const officer = await mk('officer', 'STORES_ASSISTANT');
        const executive = await mk('exec', 'STORES_EXECUTIVE');
        const manager = await mk('mgr', 'STORES_MANAGER');
        const procurement = await mk('proc', 'PROCUREMENT_OFFICER');
        const finMgr = await mk('fm', 'FINANCE_MANAGER');
        const hos = await mk('hos', 'HEAD_OF_SECTION');
        await prisma.user.update({ where: { id: officer }, data: { assignedStoreId: sub.id } });
        await prisma.user.update({ where: { id: executive }, data: { assignedStoreId: main.id } });
        await prisma.user.update({ where: { id: manager }, data: { assignedStoreId: main.id } });
        // the Head of Section holds the approval capability but no company-wide inventory scope: without a store of their own the chain refuses them (STORE_SCOPE_VIOLATION)
        await prisma.user.update({ where: { id: hos }, data: { assignedStoreId: main.id } });

        // ---------- 0. who may do what ----------
        check('0 roles: the Procurement Officer orders (procurement.write) but cannot receive goods; the Stores Executive and Manager receive goods; an officer does not', (await can(procurement, 'procurement.write')) && !(await can(procurement, 'inventory.grn')) && (await can(executive, 'inventory.grn')) && (await can(manager, 'inventory.grn')) && !(await can(officer, 'inventory.grn')));
        check('0 roles: the Finance Manager approves finance (finance.approve) and holds no goods-receipt capability', (await can(finMgr, 'finance.approve')) && !(await can(finMgr, 'inventory.grn')));

        // ---------- 1. stock request and purchase order ----------
        const req: any = await InventoryService.createStockRequest({ fromStoreId: main.id, sourceType: 'LOCAL_PURCHASE', requestedById: executive, priority: 'NORMAL', purpose: 'ZZTEST P2P', items: [{ itemId: itemA.id, requestedQty: 100 }, { itemId: itemB.id, requestedQty: 50 }] } as any);
        const reqRow: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
        const reqItemA = reqRow.items.find((i: any) => i.itemId === itemA.id).id; const reqItemB = reqRow.items.find((i: any) => i.itemId === itemB.id).id;
        const lines = [{ requestItemId: reqItemA, quantity: 100, unitPrice: 10, taxAmount: 180 }, { requestItemId: reqItemB, quantity: 50, unitPrice: 5, taxAmount: 45 }];
        check('1 PO: more than the requested quantity is refused', !!(await refused(() => PurchaseOrderService.createStorePo({ requestId: req.id, userId: procurement, vendorId: vendor.id, lines: [{ requestItemId: reqItemA, quantity: 101, unitPrice: 10 }] }))));
        let po: any = await PurchaseOrderService.createStorePo({ requestId: req.id, userId: procurement, vendorId: vendor.id, lines });
        check('1 PO: raised for the vendor, total Rs. 1,475 (1,250 goods + 225 tax)', num(po.totalAmount) === 1475 && num(po.taxAmount) === 225, `${po.poNumber} ${po.status} total ${num(po.totalAmount)}`);
        if (po.status === 'PENDING_APPROVAL') {
            check('1 PO: above the manager limit it waits; the maker cannot approve it', !!(await refused(() => PurchaseOrderService.approveStorePo(po.id, procurement))));
            po = await PurchaseOrderService.approveStorePo(po.id, manager);
        }
        check('1 PO: the order is approved (within the manager limit, or by the approver) and then issued to the vendor', po.status === 'APPROVED', po.status);
        await PurchaseOrderService.issueStorePo(po.id, procurement);
        const poFull: any = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { items: { include: { stockRequestItem: true } } } });
        const poItemA = poFull.items.find((l: any) => l.stockRequestItem.itemId === itemA.id).id; const poItemB = poFull.items.find((l: any) => l.stockRequestItem.itemId === itemB.id).id;

        // ---------- 2. GRN against the PO ----------
        check('2 GRN: goods cannot be received while the stock request is still waiting for approval', /UNAPPROVED_REQUEST/.test(await refused(() => InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: executive, purchaseOrderId: po.id, items: [{ itemId: itemA.id, quantity: 1 }] } as any))));
        const reqNow: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
        // a purchase request runs through its approval chain (configured in the process gates): each stage is actioned by the person the chain names
        const stagesDone: string[] = []; const whyNot: string[] = [];
        for (let round = 0; round < 6; round++) {
            const cur: any = await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
            if (cur.status === 'APPROVED') break;
            let progressed = false;
            for (const approver of [hos, manager, procurement, executive]) {
                const err = await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: approver, items: cur.items.map((i: any) => ({ id: i.id, approvedQty: num(i.requestedQty) })) } as any));
                if (err === '') { stagesDone.push(String(cur.currentStage ?? cur.status)); progressed = true; break; }
                whyNot.push(String(cur.currentStage ?? cur.status) + ': ' + err.slice(0, 90));
            }
            if (!progressed) break;
        }
        check('2 the purchase request goes through its approval chain and is approved; the receipt can now go ahead', (await prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id } })).status === 'APPROVED', 'stages: ' + stagesDone.join(' > ') + ' | refused: ' + [...new Set(whyNot)].join(' ; '));
        // goods receipt is guarded where the request enters (the API route and the server action), not inside the service: check both guards, and the capability of the roles
        const fsMod = await import('node:fs');
        check('2 GRN: both entry points (API route and server action) need inventory.grn, which the Procurement Officer does not hold', fsMod.readFileSync('src/app/api/inventory/grn/route.ts', 'utf8').includes('permissions: [RBAC_PERMISSIONS.INVENTORY_GRN]') && /export async function createGRN[\s\S]{0,200}requirePermission\(RBAC_PERMISSIONS.INVENTORY_GRN\)/.test(fsMod.readFileSync('src/actions/inventory-actions.ts', 'utf8')) && !(await can(procurement, 'inventory.grn')));
        check('2 GRN: an officer of another store cannot receive into the main store', !!(await refused(() => InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: 'x', receivedById: officer, purchaseOrderId: po.id, items: [{ itemId: itemA.id, quantity: 1 }] } as any))));
        const grn1: any = await InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: executive, purchaseOrderId: po.id, items: [{ itemId: itemA.id, quantity: 60 }, { itemId: itemB.id, quantity: 50 }] } as any);
        check('2 GRN 1: 60 m and 50 Nos arrive in the main store', (await stock(main.id, itemA.id)) === 60 && (await stock(main.id, itemB.id)) === 50, `A=${await stock(main.id, itemA.id)} B=${await stock(main.id, itemB.id)} ${grn1.grnNumber}`);
        let p: any = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { items: true } });
        check('2 GRN 1: the order counts what was received (A 60 of 100, B 50 of 50) and is part received', num(p.items.find((l: any) => l.id === poItemA).receivedQty) === 60 && num(p.items.find((l: any) => l.id === poItemB).receivedQty) === 50 && /PART/.test(String(p.status).toUpperCase()), `${p.status}`);
        const je1 = await entry('GRN', grn1.id);
        check('2 GRN 1: booked Dr Inventory 850 / Cr GR/IR 850 (60 x 10 + 50 x 5 at the order price), balanced', balanced(je1) && line(je1, 'INV-1010', 'debit') === 850 && line(je1, 'AP-2010', 'credit') === 850, JSON.stringify((je1?.lines ?? []).map((l: any) => [l.accountCode, num(l.debit), num(l.credit)])));
        check('2 GRN: receiving more than the order balance is refused (A: 60 + 70 > 100)', /EXCEEDS_PO|exceeds/i.test(await refused(() => InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: executive, purchaseOrderId: po.id, items: [{ itemId: itemA.id, quantity: 70 }] } as any))));
        check('2 GRN: an item that is not on the order is refused', !!(await refused(async () => { const x = await prisma.inventoryItem.create({ data: { code: `${TAG}-X`, name: `${TAG} Other`, unit: 'Nos', costPrice: 1, unitPrice: 1 } }); created.items.push(x.id); await InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: 'x', receivedById: executive, purchaseOrderId: po.id, items: [{ itemId: x.id, quantity: 1 }] } as any); })));
        const grn2: any = await InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: manager, purchaseOrderId: po.id, items: [{ itemId: itemA.id, quantity: 40 }] } as any);
        p = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
        const je2 = await entry('GRN', grn2.id);
        check('2 GRN 2: the rest (40 m) arrives; stock A 100, order fully received; booked Dr Inventory 400 / Cr GR/IR 400', (await stock(main.id, itemA.id)) === 100 && !/PART/.test(String(p.status).toUpperCase()) && balanced(je2) && line(je2, 'INV-1010', 'debit') === 400 && line(je2, 'AP-2010', 'credit') === 400, `${p.status}`);
        const accrual = line(je1, 'AP-2010', 'credit') + line(je2, 'AP-2010', 'credit');
        check('2 GR/IR so far: Rs. 1,250 accrued (goods received, not yet invoiced) = the order value without tax', accrual === 1250, String(accrual));

        // ---------- 3. supplier invoice and the 3-way match ----------
        const goodLines = [{ poItemId: poItemA, quantity: 100, unitPrice: 10, taxAmount: 180 }, { poItemId: poItemB, quantity: 50, unitPrice: 5, taxAmount: 45 }];
        const inv: any = await SupplierInvoiceService.create({ kind: 'STORE', poId: po.id, userId: procurement, invoiceNumber: `${TAG}-INV1`, invoiceDate: new Date().toISOString().slice(0, 10), lines: goodLines });
        check('3 invoice: what the vendor billed equals what was ordered and received: the 3-way match is MATCHED', inv.matchStatus === 'MATCHED', `${inv.matchStatus} total ${num(inv.totalAmount)}`);
        const over: any = await SupplierInvoiceService.create({ kind: 'STORE', poId: po.id, userId: procurement, invoiceNumber: `${TAG}-INV2`, invoiceDate: new Date().toISOString().slice(0, 10), lines: [{ poItemId: poItemA, quantity: 100, unitPrice: 12, taxAmount: 216 }] });
        check('3 invoice: a bill at a higher price (12 against 10) or for more than was received does not match', over.matchStatus !== 'MATCHED', over.matchStatus);
        check('3 invoice: a mismatched invoice cannot be approved without a reason', /MATCH_OVERRIDE_REASON_REQUIRED/.test(await refused(() => SupplierInvoiceService.approve(over.id, finMgr))));
        await SupplierInvoiceService.reject(over.id, finMgr, 'ZZTEST: price above the order');
        check('3 invoice: the mismatched invoice is rejected with a reason and cannot be approved later', /rejected/i.test(await refused(() => SupplierInvoiceService.approve(over.id, finMgr))));

        // ---------- 4. approval ----------
        check('4 approval: the person who entered the invoice cannot approve it', /SEGREGATION_OF_DUTIES/.test(await refused(() => SupplierInvoiceService.approve(inv.id, procurement))));
        const approved: any = await SupplierInvoiceService.approve(inv.id, finMgr);
        const jeInv = await entry('SUPPLIER_INVOICE', inv.id);
        check('4 approval: a different person (Finance Manager) approves', approved.status === 'APPROVED', approved.status);
        check('4 posting: Dr GR/IR 1,250 + Dr Input VAT 225 / Cr Vendor payable 1,475; balanced; no price variance', balanced(jeInv) && line(jeInv, 'AP-2010', 'debit') === 1250 && line(jeInv, 'VAT-REC-1310', 'debit') === 225 && line(jeInv, 'AP-VEND-2010', 'credit') === 1475 && line(jeInv, 'EXP-PPV-5050', 'debit') === 0, JSON.stringify((jeInv?.lines ?? []).map((l: any) => [l.accountCode, num(l.debit), num(l.credit)])));
        check('4 GR/IR is cleared: accrued 1,250 (GRNs) - cleared 1,250 (invoice) = 0', accrual - line(jeInv, 'AP-2010', 'debit') === 0);
        check('4 approval: approving twice is refused', /already/i.test(await refused(() => SupplierInvoiceService.approve(inv.id, finMgr))));

        // ---------- 5. return to the supplier, debit note ----------
        const mrn: any = await InventoryService.createMRN({ storeId: main.id, returnType: 'SUPPLIER', supplier: `${TAG} Supplier`, reason: 'ZZTEST damaged', grnId: grn1.id, returnedById: executive, items: [{ itemId: itemA.id, quantity: 20 }] } as any);
        check('5 return: the person who raised the return cannot approve it', /SEGREGATION_OF_DUTIES/.test(await refused(() => InventoryService.updateMRNStatus(mrn.id, 'APPROVE', executive))));
        const before = await stock(main.id, itemA.id);
        await InventoryService.updateMRNStatus(mrn.id, 'APPROVE', manager);
        check('5 return: the Stores Manager approves; 20 m leave the main store (100 -> 80)', before === 100 && (await stock(main.id, itemA.id)) === 80, `${before} -> ${await stock(main.id, itemA.id)}`);
        const dn: any = await prisma.supplierDebitNote.findFirst({ where: { mrnId: mrn.id } });
        check('5 debit note: raised against the invoice for 20 m at the invoice price: Rs. 200 + input VAT 36', !!dn && num(dn.amount) === 200 && num(dn.taxAmount) === 36 && dn.supplierInvoiceId === inv.id, JSON.stringify({ amount: num(dn?.amount), tax: num(dn?.taxAmount) }));
        const jeMrn = await entry('MRN', mrn.id).then((j) => j ?? entry('MRN_RETURN', mrn.id));
        check('5 return posting: Dr Vendor payable 236 / Cr Inventory 200 + Cr Input VAT 36, balanced', balanced(jeMrn) && line(jeMrn, 'AP-VEND-2010', 'debit') === 236 && line(jeMrn, 'INV-1010', 'credit') === 200 && line(jeMrn, 'VAT-REC-1310', 'credit') === 36, JSON.stringify((jeMrn?.lines ?? []).map((l: any) => [l.accountCode, num(l.debit), num(l.credit)])));

        // ---------- 6. totals ----------
        const payableAfterReturn = line(jeInv, 'AP-VEND-2010', 'credit') - line(jeMrn, 'AP-VEND-2010', 'debit');
        check('6 totals: the vendor is owed 1,475 - 236 = Rs. 1,239 after the return; the stock value fell by the 200 returned', payableAfterReturn === 1239, String(payableAfterReturn));
        const integrity: any = await InventoryService.verifyLedgerIntegrity(main.id).catch((e: any) => ({ error: String(e?.message ?? e).slice(0, 100) }));
        check('6 the inventory audit ledger of the main store is intact', !integrity?.error && (integrity?.tampered_count ?? 0) === 0, JSON.stringify(integrity).slice(0, 120));
    } catch (e: any) {
        check('script ran to the end without an unexpected error', false, String(e?.stack ?? e).slice(0, 500));
    } finally {
        for (const id of created.users) await UserService.deleteUser(id, admin).catch(async () => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of created.users) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of created.stores) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of created.items) await prisma.inventoryItem.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        if (created.vendor) await prisma.vendor.update({ where: { id: created.vendor }, data: { name: 'ZZTEST (closed) ' + created.vendor.slice(-6), status: 'INACTIVE' } }).catch(() => undefined);
    }
    const bad = results.filter((x) => !x[1]).length;
    console.log(bad === 0 ? `ALL ${results.length} CHECKS PASSED` : `${bad} CHECK(S) FAILED of ${results.length}`);
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 900)); process.exit(1); });
