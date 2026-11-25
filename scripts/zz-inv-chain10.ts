import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
// Test plan sections B-E on ZZTEST data, TEN materials (decimals included), real roles, real services, real database:
//   GRN of 10 items into the main store -> sub store request, approval, release, receive -> issue to a registered contractor ->
//   use on a sample SOD (used + wastage) -> edit and remove usage -> return -> final reconciliation of every item.
// Balance check after every step: stock + contractor + consumed + wasted = received. Cleanup: users deleted, stores renamed, items renamed.
const results: Array<[string, boolean, string]> = [];
const check = (n: string, ok: boolean, d = '') => { results.push([n, ok, d]); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const refused = async (fn: () => Promise<any>) => { try { await fn(); return ''; } catch (e: any) { return String(e?.details?.message ?? e?.message ?? e).slice(0, 160); } };
const num = (v: any) => Number(v ?? 0);
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const fl2 = (v: number) => Math.floor(v * 100 + 1e-9) / 100;

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { InventoryService } = await import('../src/services/inventory');
    const { SODMaterialService } = await import('../src/services/service-order/sod.material.service');
    const { ServiceOrderService } = await import('../src/services/service-order');
    const { AuditLedgerService } = await import('../src/services/inventory/audit-ledger.service');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const TAG = 'ZZTEST-C10-' + Date.now().toString(36);
    const created: { users: string[]; stores: string[]; items: string[]; contractors: string[] } = { users: [], stores: [], items: [], contractors: [] };
    let createdSod: string | null = null;
    const month = new Date().toISOString().slice(0, 7);

    try {
        // ---------- setup ----------
        const main = await prisma.inventoryStore.create({ data: { name: `${TAG} Main`, type: 'MAIN', location: 'ZZTEST' } });
        const subA = await prisma.inventoryStore.create({ data: { name: `${TAG} Sub A`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmc.id }] } } });
        created.stores.push(main.id, subA.id);
        const defs: Array<[string, string, number]> = [['Drop wire', 'm', 10], ['Clamp', 'Nos', 5], ['Cable 12 core', 'm', 40], ['Conduit', 'm', 8], ['Tie wrap', 'Nos', 1], ['Sleeve', 'Nos', 3], ['Closure', 'Nos', 120], ['Marker', 'Nos', 15], ['Duct tape', 'm', 2], ['Bracket', 'Nos', 25]];
        const items: any[] = [];
        for (let i = 0; i < defs.length; i++) items.push(await prisma.inventoryItem.create({ data: { code: `${TAG}-${i + 1}`, name: `${TAG} ${defs[i][0]}`, unit: defs[i][1], costPrice: defs[i][2], unitPrice: defs[i][2] * 1.2 } }));
        created.items.push(...items.map((x) => x.id));
        const mk = async (name: string, role: string) => {
            const u: any = await UserAdminService.create({ username: `zztest_${name}_${TAG.slice(-5).toLowerCase()}`, email: `zztest.${name}.${TAG.slice(-5).toLowerCase()}@example.invalid`, password: 'Temp1234x', name: `ZZTEST ${name}`, role: role as any, opmcIds: [opmc.id] }, admin);
            created.users.push(u.id); return u.id as string;
        };
        const executive = await mk('exec', 'STORES_EXECUTIVE');
        const manager = await mk('mgr', 'STORES_MANAGER');
        const officer = await mk('officer', 'STORES_ASSISTANT');
        await prisma.user.update({ where: { id: executive }, data: { assignedStoreId: main.id } });
        await prisma.user.update({ where: { id: manager }, data: { assignedStoreId: main.id } });
        await prisma.user.update({ where: { id: officer }, data: { assignedStoreId: subA.id } });
        const tpl = await prisma.contractor.findFirstOrThrow({ where: { name: { startsWith: 'ZZTEST PAR Contractor' } } }).catch(async () => prisma.contractor.findFirstOrThrow({ where: { opmcId: opmc.id } }));
        const { id: _i, registrationNumber: _r, registrationToken: _t, uploadToken: _u, ...rest } = tpl as any;
        const contractor = await prisma.contractor.create({ data: { ...rest, name: `${TAG} Contractor`, registrationNumber: `${TAG}-C`, opmcId: opmc.id, status: 'ACTIVE' } as any });
        created.contractors.push(contractor.id);

        const stock = async (storeId: string, itemId: string) => r3(num((await prisma.inventoryStock.findFirst({ where: { storeId, itemId } }))?.quantity));
        const cstock = async (itemId: string) => r3(num((await prisma.contractorStock.findFirst({ where: { contractorId: contractor.id, itemId } }))?.quantity));
        const qtys = items.map((_, i) => [100, 200, 55.5, 80, 500, 60, 12, 40, 90.5, 30][i]);
        const consumed: number[] = items.map(() => 0);
        const wasted: number[] = items.map(() => 0);
        const balance = async (label: string) => {
            const diffs: string[] = [];
            for (let i = 0; i < items.length; i++) {
                const total = r3((await stock(main.id, items[i].id)) + (await stock(subA.id, items[i].id)) + (await cstock(items[i].id)) + consumed[i] + wasted[i]);
                if (total !== r3(qtys[i])) diffs.push(`${defs[i][0]}: ${total} vs ${qtys[i]}`);
            }
            check(`balance after ${label}: for all 10 items stores + contractor + used + wasted = received`, diffs.length === 0, diffs.join('; '));
        };

        // ---------- B: GRN of 10 items ----------
        await InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: executive, items: items.map((it, i) => ({ itemId: it.id, quantity: qtys[i] })) } as any);
        let ok = true; for (let i = 0; i < items.length; i++) ok = ok && (await stock(main.id, items[i].id)) === r3(qtys[i]);
        check('B GRN: ten materials (decimals included) received into the main store, each quantity exact', ok);
        check('B GRN: zero, negative and text quantities are refused', !!(await refused(() => InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: 'x', receivedById: executive, items: [{ itemId: items[0].id, quantity: 0 }] } as any))) && !!(await refused(() => InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: 'x', receivedById: executive, items: [{ itemId: items[0].id, quantity: -5 }] } as any))));
        await balance('the GRN');

        // ---------- C: sub store request, approval, release, receive (half of every item) ----------
        const half = (i: number) => r3(qtys[i] / 2);
        const req: any = await InventoryService.createStockRequest({ fromStoreId: subA.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: officer, priority: 'NORMAL', purpose: 'ZZTEST ten items for sub store A', items: items.map((it, i) => ({ itemId: it.id, requestedQty: half(i) })) } as any);
        const getReq = async () => prisma.stockRequest.findUniqueOrThrow({ where: { id: req.id }, include: { items: true } });
        let r = await getReq();
        check('C request: the sub store officer raises a request for ten items; it waits for approval', r.status === 'PENDING' && r.items.length === 10, `stage ${r.workflowStage}`);
        check('C request: the officer cannot approve their own request', !!(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: officer, items: [] } as any))));
        await InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: manager, items: r.items.map((i: any) => ({ id: i.id, approvedQty: num(i.requestedQty) })) } as any);
        r = await getReq();
        let allocOk = true; for (let i = 0; i < items.length; i++) { const s = await prisma.inventoryStock.findFirst({ where: { storeId: main.id, itemId: items[i].id } }); allocOk = allocOk && r3(num(s?.allocatedQuantity)) === half(i) && r3(num(s?.quantity)) === r3(qtys[i]); }
        { const dump: string[] = []; for (let i = 0; i < items.length; i++) { const s0 = await prisma.inventoryStock.findFirst({ where: { storeId: main.id, itemId: items[i].id } }); dump.push(`${i + 1}:q${num(s0?.quantity)}/a${num(s0?.allocatedQuantity)}/want${half(i)}`); } console.log('INFO approval', dump.join(' ')); }
        check('C approval: the approved quantities are reserved (allocated) and nothing has left the store yet', allocOk && r.workflowStage === 'MAIN_STORE_RELEASE', `stage ${r.workflowStage}`);
        check('C release: a store officer of the sub store cannot release from the main store', !!(await refused(() => InventoryService.processStockRequestAction({ requestId: req.id, action: 'RELEASE', userId: officer, items: [] } as any))));
        await InventoryService.processStockRequestAction({ requestId: req.id, action: 'RELEASE', userId: executive, items: r.items.map((i: any) => ({ id: i.id, issuedQty: num(i.approvedQty) })) } as any);
        r = await getReq();
        await InventoryService.processStockRequestAction({ requestId: req.id, action: 'RECEIVE', userId: officer, items: r.items.map((i: any) => ({ id: i.id, receivedQty: num(i.issuedQty) })) } as any);
        r = await getReq();
        let subOk = true, mainOk = true; for (let i = 0; i < items.length; i++) { subOk = subOk && (await stock(subA.id, items[i].id)) === half(i); mainOk = mainOk && (await stock(main.id, items[i].id)) === r3(qtys[i] - half(i)); }
        { const dump: string[] = []; for (let i = 0; i < items.length; i++) dump.push(`${i + 1}:sub${await stock(subA.id, items[i].id)}/main${await stock(main.id, items[i].id)}/want${half(i)}`); console.log('INFO receive', dump.join(' '), JSON.stringify(r.items.map((x: any) => [num(x.approvedQty), num(x.issuedQty), num(x.receivedQty)]))); }
        check('C receive: the sub store holds half of every item, the main store the other half, request complete', subOk && mainOk && ['COMPLETED', 'FULFILLED'].includes(r.status), `status ${r.status}`);
        await balance('the transfer to the sub store');

        // ---------- D: issue to the registered contractor (a third of the sub store stock) ----------
        const issueQ = (i: number) => fl2(half(i) / 2);
        check('D issue: more than the sub store holds is refused', !!(await refused(() => InventoryService.issueMaterial({ contractorId: contractor.id, storeId: subA.id, month, userId: officer, items: [{ itemId: items[0].id, quantity: half(0) + 1 }] } as any))));
        { const before0 = await cstock(items[0].id); const zr = await refused(() => InventoryService.issueMaterial({ contractorId: contractor.id, storeId: subA.id, month, userId: officer, items: [{ itemId: items[0].id, quantity: 0 }] } as any)); const nr = await refused(() => InventoryService.issueMaterial({ contractorId: contractor.id, storeId: subA.id, month, userId: officer, items: [{ itemId: items[0].id, quantity: -1 }] } as any)); console.log('INFO zero:', zr || 'ACCEPTED', '| negative:', nr || 'ACCEPTED', '| contractor stock', before0, '->', await cstock(items[0].id), '| sub store', await stock(subA.id, items[0].id)); check('D issue: zero and negative quantities are refused', !!zr && !!nr, `zero: ${zr || 'accepted'}; negative: ${nr || 'accepted'}`); }
        await InventoryService.issueMaterial({ contractorId: contractor.id, storeId: subA.id, month, userId: officer, items: items.map((it, i) => ({ itemId: it.id, quantity: issueQ(i) })) } as any);
        let cOk = true, sOk = true; for (let i = 0; i < items.length; i++) { cOk = cOk && (await cstock(items[i].id)) === issueQ(i); sOk = sOk && (await stock(subA.id, items[i].id)) === r3(half(i) - issueQ(i)); }
        { const dump: string[] = []; for (let i = 0; i < items.length; i++) dump.push(`${i + 1}:c${await cstock(items[i].id)}/sub${await stock(subA.id, items[i].id)}/wantC${issueQ(i)}`); console.log('INFO issue', dump.join(' ')); }
        check('D issue: ten items issued to the contractor; the contractor holds them and the sub store fell by the same', cOk && sOk);
        { const mk0 = (q: number) => InventoryService.createMaterialReturn({ contractorId: contractor.id, storeId: subA.id, month, reason: 'x', userId: officer, items: [{ itemId: items[0].id, quantity: q, condition: 'GOOD' }] } as any); const rz = await refused(() => mk0(0)); const rn = await refused(() => mk0(-1)); check('D return: zero and negative quantities are refused', !!rz && !!rn, `zero: ${rz || 'accepted'}; negative: ${rn || 'accepted'}`); }
        { const mkq = (q: number) => InventoryService.createStockRequest({ fromStoreId: subA.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: officer, priority: 'NORMAL', purpose: 'ZZTEST bad qty', items: [{ itemId: items[0].id, requestedQty: q }] } as any); const qz = await refused(() => mkq(0)); const qn = await refused(() => mkq(-5)); check('C request: zero and negative requested quantities are refused', !!qz && !!qn, `zero: ${qz || 'accepted'}; negative: ${qn || 'accepted'}`); }
        const issueRow = await prisma.contractorMaterialIssue.findFirst({ where: { contractorId: contractor.id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, issueNumber: true } as any }).catch(() => null) as any;
        check('D issue: an issue note number exists for the contractor app and the store screen', !!issueRow && !!(issueRow.issueNumber ?? issueRow.id), JSON.stringify(issueRow));
        await balance('the issue to the contractor');

        // ---------- E: use on a sample SOD ----------
        const sod: any = await prisma.serviceOrder.create({ data: { soNum: `${TAG}-SOD`, rtom: 'R-KX', status: 'INPROGRESS', sltsStatus: 'INPROGRESS', opmcId: opmc.id, contractorId: contractor.id, customerName: 'ZZTEST sample SOD (safe to delete)' } as any, select: { id: true, soNum: true, opmcId: true } });
        createdSod = sod.id;
        const use = [{ i: 0, used: fl2(issueQ(0) * 0.5), waste: fl2(issueQ(0) * 0.1) }, { i: 1, used: 5, waste: 0 }, { i: 2, used: fl2(issueQ(2) * 0.4), waste: 0 }, { i: 6, used: 1, waste: 0 }];
        const lines = (u: typeof use) => u.flatMap((x) => [{ itemId: items[x.i].id, quantity: String(x.used), usageType: 'USED' }, ...(x.waste ? [{ itemId: items[x.i].id, quantity: String(x.waste), usageType: 'WASTAGE' }] : [])]);
        await ServiceOrderService.updateServiceOrder(sod.id, { materialUsage: lines(use), contractorId: contractor.id } as any, executive);
        for (const x of use) { consumed[x.i] += x.used; wasted[x.i] += x.waste; }
        let usedOk = true; for (const x of use) usedOk = usedOk && (await cstock(items[x.i].id)) === r3(issueQ(x.i) - x.used - x.waste);
        check('E SOD usage: the contractor stock fell by used + wastage on the sample SOD', usedOk);
        const rows = await prisma.sODMaterialUsage.findMany({ where: { serviceOrderId: sod.id } });
        check('E SOD usage: one usage row per line, wastage kept apart from used', rows.length === lines(use).length && rows.filter((x: any) => x.usageType === 'WASTAGE').length === 1, `${rows.length} rows`);
        await balance('the SOD usage');
        const tooMuch = await refused(() => ServiceOrderService.updateServiceOrder(sod.id, { materialUsage: [{ itemId: items[4].id, quantity: String(issueQ(4) + 50), usageType: 'USED' }], contractorId: contractor.id } as any, executive));
        check('E SOD usage: using more than the contractor holds is refused, nothing changes', !!tooMuch);
        // the failed attempt rolled back the old usage rollback too: the previous state must be intact
        let intact = true; for (const x of use) intact = intact && (await cstock(items[x.i].id)) === r3(issueQ(x.i) - x.used - x.waste);
        check('E SOD usage: the refused attempt left the earlier usage and stock exactly as they were', intact);
        // edit: change item 1 from 5 to 3 and drop item 6
        const use2 = [use[0], { i: 1, used: 3, waste: 0 }, use[2]];
        await ServiceOrderService.updateServiceOrder(sod.id, { materialUsage: lines(use2), contractorId: contractor.id } as any, executive);
        for (let i = 0; i < items.length; i++) { consumed[i] = 0; wasted[i] = 0; }
        for (const x of use2) { consumed[x.i] += x.used; wasted[x.i] += x.waste; }
        let editOk = true; for (let i = 0; i < items.length; i++) { const u = use2.find((x) => x.i === i); editOk = editOk && (await cstock(items[i].id)) === r3(issueQ(i) - (u ? u.used + u.waste : 0)); }
        check('E SOD usage: an edit (5 -> 3 and one line removed) gives the stock back and the totals agree again', editOk);
        await balance('the edit of the SOD usage');

        // ---------- return unused to the sub store ----------
        await InventoryService.createMaterialReturn({ contractorId: contractor.id, storeId: subA.id, month, reason: 'ZZTEST unused', userId: officer, items: [{ itemId: items[3].id, quantity: r3(issueQ(3)), condition: 'GOOD' }] } as any);
        const back = (await stock(subA.id, items[3].id)) === r3(half(3)) && (await cstock(items[3].id)) === 0;
        check('E return: unused material goes back to the sub store, the contractor holds none of it', back);
        qtys.forEach(() => undefined);
        await balance('the return');

        // ---------- ledger ----------
        const integ: any = await AuditLedgerService.verifyLedgerIntegrity(main.id).catch(() => null);
        const integA: any = await AuditLedgerService.verifyLedgerIntegrity(subA.id).catch(() => null);
        check('ledger: the audit chain of the main store and the sub store is intact', !!integ && !!integA && integ.isIntegral === true && integA.isIntegral === true, JSON.stringify({ main: integ?.tamperedCount, sub: integA?.tamperedCount }));
        const upd = await refused(async () => { const row = await prisma.inventoryLedger.findFirst({ where: { itemId: items[0].id } }); if (!row) throw new Error('no row'); await prisma.inventoryLedger.update({ where: { id: row.id }, data: { quantityAfter: 1 } as any }); });
        check('ledger: a ledger row cannot be changed afterwards', !!upd, upd);

        // tidy: take the sample SOD usage out again (reversing entries), so the sample SOD is as it was
        await prisma.$transaction(async (tx: any) => { await SODMaterialService.rollbackMaterialUsage(tx, sod.id, executive); });
    } catch (e: any) {
        check('script ran to the end without an unexpected error', false, String(e?.stack ?? e).slice(0, 500));
    } finally {
        for (const id of created.users) await UserService.deleteUser(id, admin).catch(async () => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of created.users) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of created.stores) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of created.contractors) await prisma.contractor.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        if (createdSod) await prisma.serviceOrder.update({ where: { id: createdSod }, data: { soNum: `ZZTEST-CLOSED-${createdSod.slice(-8)}`, customerName: 'ZZTEST (closed)', contractorId: null } as any }).catch(() => undefined);
        for (const id of created.items) await prisma.inventoryItem.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
    }
    const bad = results.filter((x) => !x[1]).length;
    console.log(bad === 0 ? `ALL ${results.length} CHECKS PASSED` : `${bad} CHECK(S) FAILED of ${results.length}`);
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 900)); process.exit(1); });
