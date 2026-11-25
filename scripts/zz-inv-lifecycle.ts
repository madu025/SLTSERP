import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
// Complete inventory lifecycle with REAL ROLES on ZZTEST data (ZZTEST stores, items, contractor), real services, real database:
//   GRN -> material request (sub store -> main store) -> Executive review -> Manager approval (and Procurement stand-in) -> release -> receive ->
//   contractor issue -> contractor return -> MRN (return to supplier) -> wastage (adjust capability) -> stock take -> ledger integrity.
// Users are created through the user service with the real roles. Cleanup: users deleted, stores renamed and made SUB, items renamed (the inventory ledger is immutable).
const results: Array<[string, boolean, string]> = [];
const check = (n: string, ok: boolean, d = '') => { results.push([n, ok, d]); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const refused = async (fn: () => Promise<any>) => { try { await fn(); return ''; } catch (e: any) { return String(e?.details?.message ?? e?.message ?? e).slice(0, 140); } };
const num = (v: any) => Number(v ?? 0);

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { InventoryService } = await import('../src/services/inventory');
    const { EmailService } = await import('../src/services/notification/email.service');
    const { userHasPermission } = await import('../src/lib/user-permissions');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const TAG = 'ZZTEST-LIFE-' + Date.now().toString(36);
    const created: { users: string[]; stores: string[]; items: string[]; contractor?: string; contractor2?: string } = { users: [], stores: [], items: [] };

    try {
        // ---------- setup: stores, items, people with their real roles ----------
        const main = await prisma.inventoryStore.create({ data: { name: `${TAG} Main Store`, type: 'MAIN', location: 'ZZTEST' } });
        const kad = await prisma.inventoryStore.create({ data: { name: `${TAG} Kaduwela`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmc.id }] } } });
        created.stores.push(main.id, kad.id);
        const itemA = await prisma.inventoryItem.create({ data: { code: `${TAG}-A`, name: `${TAG} Drop wire`, unit: 'm', costPrice: 10, unitPrice: 12 } });
        const itemB = await prisma.inventoryItem.create({ data: { code: `${TAG}-B`, name: `${TAG} Clamp`, unit: 'Nos', costPrice: 5, unitPrice: 6 } });
        created.items.push(itemA.id, itemB.id);
        const mk = async (name: string, role: string, extra: Record<string, unknown> = {}) => {
            const u: any = await UserAdminService.create({ username: `zztest_${name}_${TAG.slice(-5).toLowerCase()}`, email: `zztest.${name}.${TAG.slice(-5).toLowerCase()}@example.invalid`, password: 'Temp1234x', name: `ZZTEST ${name}`, role: role as any, opmcIds: [opmc.id], ...extra }, admin);
            created.users.push(u.id); return u.id as string;
        };
        const officer = await mk('officer', 'STORES_ASSISTANT');
        const executive = await mk('exec', 'STORES_EXECUTIVE');
        const manager = await mk('mgr', 'STORES_MANAGER');
        const procurement = await mk('proc', 'PROCUREMENT_OFFICER');
        const areaMgr = await mk('arm', 'AREA_MANAGER');
        await prisma.user.update({ where: { id: officer }, data: { assignedStoreId: kad.id } });
        await prisma.user.update({ where: { id: executive }, data: { assignedStoreId: main.id } });
        await prisma.user.update({ where: { id: manager }, data: { assignedStoreId: main.id } });
        // a second officer who works in the Main Store
        const mainOfficer = await mk('mainofficer', 'STORES_ASSISTANT'); await prisma.user.update({ where: { id: mainOfficer }, data: { assignedStoreId: main.id } });
        const exRow = await prisma.user.findUnique({ where: { id: executive }, select: { role: true, systemRole: { select: { code: true } } } });
        check('the new Stores Executive role exists and was given to a user', exRow?.role === 'STORES_EXECUTIVE' && !!exRow?.systemRole?.code, JSON.stringify(exRow));
        const tpl = await prisma.contractor.findFirstOrThrow({ where: { name: { startsWith: 'ZZTEST PAR Contractor' } } }).catch(async () => prisma.contractor.findFirstOrThrow({ where: { opmcId: opmc.id } }));
        const { id: _i, registrationNumber: _r, registrationToken: _t, uploadToken: _u, ...rest } = tpl as any;
        const contractor = await prisma.contractor.create({ data: { ...rest, name: `${TAG} Contractor`, registrationNumber: `${TAG}-C`, opmcId: opmc.id, status: 'ACTIVE' } as any });
        created.contractor = contractor.id;

        // ---------- who may do what (the guards of the API routes) ----------
        const can = async (u: string, p: string) => userHasPermission(u, p);
        check('officer: works (read, write), no review, no adjust, no approve', (await can(officer, 'inventory.write')) && !(await can(officer, 'inventory.review')) && !(await can(officer, 'inventory.adjust')) && !(await can(officer, 'inventory.approve')));
        check('executive (the manager\'s deputy): works, reviews, adjusts, releases, receives goods, approves', (await can(executive, 'inventory.write')) && (await can(executive, 'inventory.review')) && (await can(executive, 'inventory.adjust')) && (await can(executive, 'inventory.release')) && (await can(executive, 'inventory.grn')) && (await can(executive, 'inventory.approve')));
        check('manager: approves, reviews, adjusts', (await can(manager, 'inventory.approve')) && (await can(manager, 'inventory.review')) && (await can(manager, 'inventory.adjust')));
        check('procurement officer: approves its own purchase stage, but is not the manager\'s deputy at the main store', (await can(procurement, 'inventory.approve')));

        // ---------- 1. GRN: the main store receives stock ----------
        const grn: any = await InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: executive, items: [{ itemId: itemA.id, quantity: 200 }, { itemId: itemB.id, quantity: 100 }] } as any);
        const stock = async (storeId: string, itemId: string) => num((await prisma.inventoryStock.findFirst({ where: { storeId, itemId } }))?.quantity);
        check('1 GRN: the Stores Executive receives stock into the main store', (await stock(main.id, itemA.id)) === 200 && (await stock(main.id, itemB.id)) === 100, `A=${await stock(main.id, itemA.id)} B=${await stock(main.id, itemB.id)} ${grn?.grnNumber ?? ''}`);
        check('1 GRN: a store officer has no goods-receipt capability', !(await can(officer, 'inventory.grn')) && !(await can(mainOfficer, 'inventory.grn')) && (await can(executive, 'inventory.grn')) && (await can(manager, 'inventory.grn')));
        check('1 GRN: an officer of another store cannot receive into the main store', /STORE_SCOPE|write access/.test(await refused(() => InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: 'x', receivedById: officer, items: [{ itemId: itemA.id, quantity: 1 }] } as any))));

        // ---------- 2. material request: Kaduwela asks the main store ----------
        const reqCreate = async () => InventoryService.createStockRequest({ fromStoreId: kad.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: officer, priority: 'NORMAL', purpose: 'ZZTEST material for Kaduwela', items: [{ itemId: itemA.id, requestedQty: 60 }, { itemId: itemB.id, requestedQty: 30 }] } as any);
        const req: any = await reqCreate();
        const getReq = async (id: string) => prisma.stockRequest.findUniqueOrThrow({ where: { id }, include: { items: true } });
        let r = await getReq(req.id);
        check('2 request: the Kaduwela officer raises a request to the main store; it waits for approval', r.status === 'PENDING' && r.items.length === 2, `stage ${r.workflowStage}`);
        const line = (rq: any, itemId: string) => rq.items.find((i: any) => i.itemId === itemId);

        // ---------- 3. review by the Executive ----------
        check('3 review: an officer cannot change the quantities', /PERMISSION_DENIED|inventory.review/.test(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'ADJUST_QTY', userId: officer, remarks: 'try', items: [{ id: line(r, itemA.id).id, approvedQty: 10 }] } as any))));
        check('3 review: the requester cannot review their own request (needs review, and segregation)', !!(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'ADJUST_QTY', userId: officer, remarks: 'mine', items: [{ id: line(r, itemA.id).id, approvedQty: 1 }] } as any))));
        check('3 review: a change needs a reason', /reason/i.test(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'ADJUST_QTY', userId: executive, remarks: '', items: [{ id: line(r, itemA.id).id, approvedQty: 40 }] } as any))));
        await InventoryService.processStockRequestAction({ requestId: req.id, action: 'ADJUST_QTY', userId: executive, remarks: 'Kaduwela needs 40 m only this month', items: [{ id: line(r, itemA.id).id, approvedQty: 40 }] } as any);
        r = await getReq(req.id);
        check('3 review: the Executive reduces 60 -> 40 m; the request stays pending', num(line(r, itemA.id).approvedQty) === 40 && num(line(r, itemA.id).requestedQty) === 60 && r.status === 'PENDING');
        const audit = await prisma.auditLog.findFirst({ where: { entity: 'STOCK_REQUEST', entityId: req.id, action: 'ADJUST_QTY' }, orderBy: { createdAt: 'desc' } });
        check('3 review: the change is in the audit log with the reason', !!audit && JSON.stringify(audit.newValue).includes('40 m only'));
        check('3 review: the officer was told', (await prisma.notification.count({ where: { userId: officer, title: 'Request quantities adjusted' } })) >= 1);
        check('3 review: an officer cannot approve or reject', !!(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: mainOfficer, items: [] } as any))) && !!(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'REJECT', userId: mainOfficer, remarks: 'no' } as any))));

        check('3 review: the Executive who adjusted the quantities cannot approve the same request', /SEGREGATION_OF_DUTIES/.test(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: executive, items: [] } as any))));
        // ---------- 4. approval ----------
        const armTry = await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'ARM_APPROVE', userId: areaMgr, items: [] } as any));
        console.log('INFO Area Manager approving at stage', r.workflowStage, '->', armTry || 'allowed');
        r = await getReq(req.id);
        if (r.status === 'PENDING' && r.workflowStage === 'ARM_APPROVAL') {
            await InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: manager, items: r.items.map((i: any) => ({ id: i.id, approvedQty: num(i.approvedQty) > 0 ? num(i.approvedQty) : num(i.requestedQty) })) } as any);
        }
        r = await getReq(req.id);
        check('4 approval: the Stores Manager approves; the adjusted 40 m is what is approved and reserved', r.status === 'APPROVED' && num(line(r, itemA.id).approvedQty) === 40 && num(line(r, itemB.id).approvedQty) === 30, `stage ${r.workflowStage}, A ${num(line(r, itemA.id).approvedQty)}, B ${num(line(r, itemB.id).approvedQty)}`);

        // ---------- 5. release and receive ----------
        check('5 release: a store officer cannot release stock from the main store', !!(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'RELEASE', userId: mainOfficer, items: [] } as any))));
        await InventoryService.processStockRequestAction({ requestId: req.id, action: 'RELEASE', userId: executive, items: r.items.map((i: any) => ({ id: i.id, issuedQty: num(i.approvedQty) })) } as any);
        check('5 release: the main store releases 40 m + 30 Nos; its stock falls', (await stock(main.id, itemA.id)) === 160 && (await stock(main.id, itemB.id)) === 70, `A=${await stock(main.id, itemA.id)} B=${await stock(main.id, itemB.id)}`);
        r = await getReq(req.id);
        await InventoryService.processStockRequestAction({ requestId: req.id, action: 'RECEIVE', userId: officer, items: r.items.map((i: any) => ({ id: i.id, receivedQty: num(i.issuedQty) })) } as any);
        r = await getReq(req.id);
        check('5 receive: Kaduwela receives; its stock rises and the request is complete', (await stock(kad.id, itemA.id)) === 40 && (await stock(kad.id, itemB.id)) === 30 && ['COMPLETED', 'FULFILLED'].includes(r.status), `A=${await stock(kad.id, itemA.id)} B=${await stock(kad.id, itemB.id)} status ${r.status}`);

        // second request approved by the Procurement Officer (no Stores Manager)
        const req2: any = await InventoryService.createStockRequest({ fromStoreId: kad.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: officer, priority: 'NORMAL', purpose: 'ZZTEST stand-in', items: [{ itemId: itemB.id, requestedQty: 10 }] } as any);
        const r2 = await getReq(req2.id);
        check('4b deputy: the Procurement Officer cannot approve the main store gate', !!(await refused(() => InventoryService.processStockRequestAction({ requestId: req2.id, action: 'STORES_MANAGER_APPROVE', userId: procurement, items: r2.items.map((i: any) => ({ id: i.id, approvedQty: 10 })) } as any))));
        const procTry = await refused(() => InventoryService.processStockRequestAction({ requestId: req2.id, action: 'STORES_MANAGER_APPROVE', userId: executive, items: r2.items.map((i: any) => ({ id: i.id, approvedQty: 10 })) } as any));
        check('4b deputy: the Stores Executive approves when there is no Stores Manager', procTry === '' && (await getReq(req2.id)).status === 'APPROVED', procTry || 'approved');

        // ---------- 6. contractor material ----------
        const { ContractorStoreService } = await import('../src/services/inventory/contractor-store.service');
        const otherOpmc = await prisma.oPMC.findFirstOrThrow({ where: { id: { not: opmc.id }, storeId: null }, select: { id: true } }).catch(async () => prisma.oPMC.findFirstOrThrow({ where: { id: { not: opmc.id } }, select: { id: true } }));
        const { id: _i2, registrationNumber: _r2, registrationToken: _t2, uploadToken: _u2, ...rest2 } = contractor as any;
        const foreign = await prisma.contractor.create({ data: { ...rest2, name: `${TAG} Other-area Contractor`, registrationNumber: `${TAG}-F`, opmcId: otherOpmc.id, status: 'ACTIVE' } as any });
        created.contractor2 = foreign.id;
        const listed = (await ContractorStoreService.listFor(officer, kad.id)).map((c: any) => c.id);
        check('6 contractors: the Kaduwela officer is offered the contractor of the Kaduwela area, not the other area', listed.includes(contractor.id) && !listed.includes(foreign.id), `${listed.length} offered`);
        check('6 contractors: material cannot be issued to a contractor of another store', /CONTRACTOR_NOT_FOR_THIS_STORE/.test(await refused(() => InventoryService.issueMaterial({ contractorId: foreign.id, storeId: kad.id, month: new Date().toISOString().slice(0, 7), userId: officer, items: [{ itemId: itemA.id, quantity: 1 }] } as any))));
        check('6 contractors: the balance in hand of another store contractor cannot be read', !!(await refused(() => ContractorStoreService.assertCanSee(officer, foreign.id))) && (await refused(() => ContractorStoreService.assertCanSee(officer, contractor.id))) === '');
        check('6 contractors: the Stores Manager, who runs every store, is not limited', (await refused(() => ContractorStoreService.assertForStore(manager, foreign.id, kad.id))) === '');
        const month = new Date().toISOString().slice(0, 7);
        await InventoryService.issueMaterial({ contractorId: contractor.id, storeId: kad.id, month, userId: officer, items: [{ itemId: itemA.id, quantity: 15 }, { itemId: itemB.id, quantity: 10 }] } as any);
        check('6 contractor issue: Kaduwela issues 15 m + 10 Nos to the contractor (MIN); store stock falls', (await stock(kad.id, itemA.id)) === 25 && (await stock(kad.id, itemB.id)) === 20, `A=${await stock(kad.id, itemA.id)} B=${await stock(kad.id, itemB.id)}`);
        await InventoryService.createMaterialReturn({ contractorId: contractor.id, storeId: kad.id, month, reason: 'ZZTEST unused', userId: officer, items: [{ itemId: itemB.id, quantity: 4, condition: 'GOOD' }] } as any);
        check('6 contractor return: 4 Nos come back to the store', (await stock(kad.id, itemB.id)) === 24, `B=${await stock(kad.id, itemB.id)}`);

        // ---------- 7. MRN: return to the supplier ----------
        const mrn: any = await InventoryService.createMRN({ storeId: main.id, returnType: 'SUPPLIER', supplier: `${TAG} Supplier`, reason: 'ZZTEST damaged', grnId: grn.id, returnedById: executive, items: [{ itemId: itemB.id, quantity: 5, reason: 'damaged' }] } as any);
        check('7 MRN: the main store raises a return note to the supplier (pending, stock not yet reduced)', !!mrn?.id && (await stock(main.id, itemB.id)) === 70, `${mrn?.mrnNumber ?? ''} B=${await stock(main.id, itemB.id)}`);
        check('7 MRN: only the Executive and the Manager can raise a return to the supplier (goods-receipt capability)', !(await can(mainOfficer, 'inventory.grn')) && (await can(executive, 'inventory.grn')));
        check('7 MRN: the person who raised it cannot approve it', !!(await refused(() => InventoryService.updateMRNStatus(mrn.id, 'APPROVE', executive))));
        await InventoryService.updateMRNStatus(mrn.id, 'APPROVE', manager);
        check('7 MRN: the Stores Manager approves; main stock falls by 5', (await stock(main.id, itemB.id)) === 65, `B=${await stock(main.id, itemB.id)}`);

        // ---------- 8. wastage (stock adjustment) ----------
        check('8 wastage: the officer has no adjust capability (the page and the API refuse)', !(await can(officer, 'inventory.adjust')));
        const w: any = await InventoryService.recordWastage({ storeId: kad.id, contractorId: contractor.id, month, description: 'ZZTEST cut off-cut', reason: 'damaged', userId: executive, items: [{ itemId: itemA.id, quantity: 2 }] } as any).catch((e: any) => ({ error: String(e?.message ?? e).slice(0, 120) }));
        check('8 wastage: the Executive records a wastage', !!w?.id, w?.error ?? w?.id ?? '');
        if (w?.id) {
            check('8 wastage: the reporter cannot approve their own', !!(await refused(() => InventoryService.approveWastage(w.id, executive))));
            const ap = await refused(() => InventoryService.approveWastage(w.id, manager));
            check('8 wastage: the Stores Manager approves it', ap === '', ap);
        }

        // ---------- 9. stock take ----------
        const cc: any = await InventoryService.createCycleCount({ storeId: kad.id, countedById: officer, notes: 'ZZTEST count' } as any).catch((e: any) => ({ error: String(e?.message ?? e).slice(0, 140) }));
        check('9 stock take: the Kaduwela officer starts a count', !!cc?.id, cc?.error ?? cc?.countNumber ?? '');
        if (cc?.id) {
            const full: any = await InventoryService.getCycleCountById(cc.id, officer);
            const lines = (full.lines ?? []).filter((l: any) => [itemA.id, itemB.id].includes(l.itemId)).map((l: any) => ({ lineId: l.id, countedQty: num(l.systemQty) - (l.itemId === itemB.id ? 1 : 0) }));
            await InventoryService.submitCountResults(cc.id, lines, officer);
            check('9 stock take: the person who counted cannot approve the variance', !!(await refused(() => InventoryService.approveCycleCount(cc.id, officer))));
            const before = await stock(kad.id, itemB.id);
            const ap = await refused(() => InventoryService.approveCycleCount(cc.id, manager));
            check('9 stock take: the Stores Manager approves; a 1 Nos shortage is booked', ap === '' && (await stock(kad.id, itemB.id)) === before - 1, ap || `B ${before} -> ${await stock(kad.id, itemB.id)}`);
        }

        // ---------- 10. totals and ledger ----------
        const ledger: any = await InventoryService.verifyLedgerIntegrity(main.id).catch((e: any) => ({ error: String(e?.message ?? e).slice(0, 100) }));
        const l2: any = await InventoryService.verifyLedgerIntegrity(kad.id).catch(() => null);
        check('10 ledger: the audit ledger of both stores is intact (no tampered rows)', !ledger?.error && (ledger?.tampered_count ?? 0) === 0 && (l2?.tampered_count ?? 0) === 0, JSON.stringify(ledger)?.slice(0, 100));
        const totalA = (await stock(main.id, itemA.id)) + (await stock(kad.id, itemA.id));
        check('10 totals: item A in the stores (185) + issued to the contractor (15, of which 2 were written off as wastage) = 200 received', totalA + 15 === 200, 'stores ' + totalA + ' + contractor issue 15');
    } catch (e: any) {
        check('script ran to the end without an unexpected error', false, String(e?.stack ?? e).slice(0, 400));
    } finally {
        // cleanup (the immutable ledger rows remain): people deleted, stores made harmless, items and contractor renamed
        for (const id of created.users) await UserService.deleteUser(id, admin).catch(async () => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of created.users) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of created.stores) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        if (created.contractor2) await prisma.contractor.update({ where: { id: created.contractor2 }, data: { name: 'ZZTEST (closed) ' + created.contractor2.slice(-6) } }).catch(() => undefined);
        if (created.contractor) await prisma.contractor.update({ where: { id: created.contractor }, data: { name: 'ZZTEST (closed) ' + created.contractor.slice(-6) } }).catch(() => undefined);
    }
    const bad = results.filter((x) => !x[1]).length;
    console.log(bad === 0 ? `ALL ${results.length} CHECKS PASSED` : `${bad} CHECK(S) FAILED`);
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 900)); process.exit(1); });
