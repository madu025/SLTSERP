import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
// Test plan, next phase, on ZZTEST data in production: concurrency, area scope between two sub stores, SQL report functions against their tables.
const results: Array<[string, boolean, string]> = [];
const check = (n: string, ok: boolean, d = '') => { results.push([n, ok, d]); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const refused = async (fn: () => Promise<any>) => { try { await fn(); return ''; } catch (e: any) { return String(e?.details?.message ?? e?.message ?? e).slice(0, 150); } };
const num = (v: any) => Number(v ?? 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const show = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x));

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { InventoryService } = await import('../src/services/inventory');
    const { StoreService } = await import('../src/services/inventory/store.service');
    const { ContractorStoreService } = await import('../src/services/inventory/contractor-store.service');
    const { ServiceOrderService } = await import('../src/services/service-order');
    const { EmailService } = await import('../src/services/notification/email.service');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const opmcX = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const opmcY = await prisma.oPMC.findFirstOrThrow({ where: { id: { not: opmcX.id }, storeId: null }, select: { id: true } }).catch(async () => prisma.oPMC.findFirstOrThrow({ where: { id: { not: opmcX.id } }, select: { id: true } }));
    const TAG = 'ZZTEST-P2-' + Date.now().toString(36);
    const created: { users: string[]; stores: string[]; items: string[]; contractors: string[]; sods: string[] } = { users: [], stores: [], items: [], contractors: [], sods: [] };
    const month = new Date().toISOString().slice(0, 7);

    try {
        // ---------- setup: main, sub A (area X), sub B (area Y); contractors of each area ----------
        const main = await prisma.inventoryStore.create({ data: { name: `${TAG} Main`, type: 'MAIN', location: 'ZZTEST' } });
        const subA = await prisma.inventoryStore.create({ data: { name: `${TAG} Sub A`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmcX.id }] } } });
        const subB = await prisma.inventoryStore.create({ data: { name: `${TAG} Sub B`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmcY.id }] } } });
        created.stores.push(main.id, subA.id, subB.id);
        const items: any[] = [];
        for (let i = 0; i < 3; i++) items.push(await prisma.inventoryItem.create({ data: { code: `${TAG}-${i + 1}`, name: `${TAG} Item ${i + 1}`, unit: 'Nos', costPrice: 10, unitPrice: 12 } }));
        created.items.push(...items.map((x) => x.id));
        const mk = async (name: string, role: string, opmcId: string) => {
            const u: any = await UserAdminService.create({ username: `zztest_${name}_${TAG.slice(-5).toLowerCase()}`, email: `zztest.${name}.${TAG.slice(-5).toLowerCase()}@example.invalid`, password: 'Temp1234x', name: `ZZTEST ${name}`, role: role as any, opmcIds: [opmcId] }, admin);
            created.users.push(u.id); return u.id as string;
        };
        const exec = await mk('exec', 'STORES_EXECUTIVE', opmcX.id);
        const mgr = await mk('mgr', 'STORES_MANAGER', opmcX.id);
        const offA = await mk('offa', 'STORES_ASSISTANT', opmcX.id);
        const offB = await mk('offb', 'STORES_ASSISTANT', opmcY.id);
        await prisma.user.update({ where: { id: exec }, data: { assignedStoreId: main.id } });
        await prisma.user.update({ where: { id: mgr }, data: { assignedStoreId: main.id } });
        await prisma.user.update({ where: { id: offA }, data: { assignedStoreId: subA.id } });
        await prisma.user.update({ where: { id: offB }, data: { assignedStoreId: subB.id } });
        const tpl = await prisma.contractor.findFirstOrThrow({ where: { name: { startsWith: 'ZZTEST PAR Contractor' } } }).catch(async () => prisma.contractor.findFirstOrThrow({ where: { opmcId: opmcX.id } }));
        const { id: _i, registrationNumber: _r, registrationToken: _t, uploadToken: _u, ...rest } = tpl as any;
        const cA = await prisma.contractor.create({ data: { ...rest, name: `${TAG} Contractor A`, registrationNumber: `${TAG}-CA`, opmcId: opmcX.id, status: 'ACTIVE' } as any });
        const cB = await prisma.contractor.create({ data: { ...rest, name: `${TAG} Contractor B`, registrationNumber: `${TAG}-CB`, opmcId: opmcY.id, status: 'ACTIVE' } as any });
        created.contractors.push(cA.id, cB.id);
        const sodData = (n: string) => ({ soNum: `${TAG}-${n}`, rtom: 'R-KX', status: 'INPROGRESS', sltsStatus: 'INPROGRESS', opmcId: opmcX.id, contractorId: cA.id, customerName: 'ZZTEST sample SOD (safe to delete)' } as any);
        const sod1: any = await prisma.serviceOrder.create({ data: sodData('SOD1'), select: { id: true } });
        const sod2: any = await prisma.serviceOrder.create({ data: sodData('SOD2'), select: { id: true } });
        created.sods.push(sod1.id, sod2.id);

        const stock = async (storeId: string, itemId: string) => num((await prisma.inventoryStock.findFirst({ where: { storeId, itemId } }))?.quantity);
        const cstock = async (contractorId: string, itemId: string) => num((await prisma.contractorStock.findFirst({ where: { contractorId, itemId } }))?.quantity);
        const getReq = async (id: string) => prisma.stockRequest.findUniqueOrThrow({ where: { id }, include: { items: true } });
        const newRequest = async (toStore: any, officer: string, qty: Record<number, number>) => {
            const req: any = await InventoryService.createStockRequest({ fromStoreId: toStore.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: officer, priority: 'NORMAL', purpose: 'ZZTEST phase 2', items: Object.entries(qty).map(([i, q]) => ({ itemId: items[Number(i)].id, requestedQty: q })) } as any);
            let r = await getReq(req.id);
            await InventoryService.processStockRequestAction({ requestId: req.id, action: 'STORES_MANAGER_APPROVE', userId: mgr, items: r.items.map((i: any) => ({ id: i.id, approvedQty: num(i.requestedQty) })) } as any);
            return req.id as string;
        };
        const release = async (id: string, userId = exec) => { const r = await getReq(id); return InventoryService.processStockRequestAction({ requestId: id, action: 'RELEASE', userId, items: r.items.map((i: any) => ({ id: i.id, issuedQty: num(i.approvedQty) })) } as any); };
        const receive = async (id: string, userId: string) => { const r = await getReq(id); return InventoryService.processStockRequestAction({ requestId: id, action: 'RECEIVE', userId, items: r.items.map((i: any) => ({ id: i.id, receivedQty: num(i.issuedQty) })) } as any); };

        // stock: main receives 300 of each, sub A gets 100 of each, sub B gets 50 of each
        await InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: exec, items: items.map((it) => ({ itemId: it.id, quantity: 300 })) } as any);
        let id1 = await newRequest(subA, offA, { 0: 100, 1: 100, 2: 100 }); await release(id1); await receive(id1, offA);
        let id2 = await newRequest(subB, offB, { 0: 50, 1: 50, 2: 50 }); await release(id2); await receive(id2, offB);
        check('setup: main 150, sub A 100, sub B 50 of every item', (await stock(main.id, items[0].id)) === 150 && (await stock(subA.id, items[0].id)) === 100 && (await stock(subB.id, items[0].id)) === 50);

        // ======================= CONCURRENCY =======================
        const k1Before = await stock(main.id, items[2].id);
        const k1 = await Promise.allSettled([1, 2].map(() => InventoryService.createGRN({ storeId: main.id, sourceType: 'LOCAL_PURCHASE', supplier: `${TAG} Supplier`, receivedById: exec, items: [{ itemId: items[2].id, quantity: 50 }] } as any)));
        check('K1 two goods receipts at the same moment: both succeed and no quantity is lost', k1.every((x) => x.status === 'fulfilled') && (await stock(main.id, items[2].id)) === k1Before + 100, `${k1.map((x) => x.status).join(',')} ${k1Before} -> ${await stock(main.id, items[2].id)}`);

        const k2 = await Promise.allSettled([1, 2, 3, 4, 5].map(() => InventoryService.issueMaterial({ contractorId: cA.id, storeId: subA.id, month, userId: offA, items: [{ itemId: items[0].id, quantity: 30 }] } as any)));
        const k2ok = k2.filter((x) => x.status === 'fulfilled').length;
        const subAQ = await stock(subA.id, items[0].id); const cAQ = await cstock(cA.id, items[0].id);
        check('K2 five issues of 30 at the same moment from a store that holds 100: exactly three succeed, none goes negative', k2ok === 3 && subAQ === 10 && cAQ === 90, `${k2ok} succeeded; store ${subAQ}, contractor ${cAQ}`);

        const id3 = await newRequest(subB, offB, { 1: 40 }); await release(id3);
        const k3Before = await stock(subB.id, items[1].id);
        const k3 = await Promise.allSettled([receive(id3, offB), receive(id3, offB)]);
        check('K3 the same receipt submitted twice at the same moment is booked once', (await stock(subB.id, items[1].id)) === k3Before + 40 && k3.filter((x) => x.status === 'fulfilled').length >= 1, `${k3.map((x) => x.status).join(',')} ${k3Before} -> ${await stock(subB.id, items[1].id)}`);

        const id4 = await newRequest(subA, offA, { 1: 20 });
        const k4Before = await stock(main.id, items[1].id);
        const k4 = await Promise.allSettled([release(id4, exec), release(id4, mgr)]);
        check('K4 the same request released by two people at the same moment: main store falls once', (await stock(main.id, items[1].id)) === k4Before - 20, `${k4.map((x: any) => x.status === 'rejected' ? 'rejected: ' + String(x.reason?.details?.message ?? x.reason?.message ?? x.reason).slice(0, 140) : x.status).join(' | ')} ${k4Before} -> ${await stock(main.id, items[1].id)}`);

        const useLine = (q: number) => [{ itemId: items[0].id, quantity: String(q), usageType: 'USED' }];
        const k5 = await Promise.allSettled([sod1.id, sod2.id].map((sid) => ServiceOrderService.updateServiceOrder(sid, { materialUsage: useLine(60), contractorId: cA.id } as any, exec)));
        const k5ok = k5.filter((x) => x.status === 'fulfilled').length;
        const cAafter = await cstock(cA.id, items[0].id);
        check('K5 two orders using 60 each of a contractor stock of 90 at the same moment: exactly one succeeds, nothing goes negative', k5ok === 1 && cAafter === 30, `${k5ok} succeeded; contractor ${cAafter}`);
        const negatives = await prisma.inventoryStock.count({ where: { storeId: { in: [main.id, subA.id, subB.id] }, quantity: { lt: 0 } } }) + await prisma.contractorStock.count({ where: { contractorId: { in: [cA.id, cB.id] }, quantity: { lt: 0 } } });
        check('K6 after all of that no store or contractor holds a negative quantity', negatives === 0, String(negatives));

        // ======================= AREA SCOPE =======================
        const idsOf = async (u: string) => (await StoreService.getAccessibleStores(u)).map((s: any) => s.id);
        const aIds = await idsOf(offA); const bIds = await idsOf(offB);
        check('S1 the officer of sub A sees sub A and not sub B; the officer of sub B sees sub B and not sub A', aIds.includes(subA.id) && !aIds.includes(subB.id) && bIds.includes(subB.id) && !bIds.includes(subA.id), `A sees ${aIds.length}, B sees ${bIds.length}`);
        check('S2 issuing from the other sub store is refused, both ways', !!(await refused(() => InventoryService.issueMaterial({ contractorId: cB.id, storeId: subB.id, month, userId: offA, items: [{ itemId: items[0].id, quantity: 1 }] } as any))) && !!(await refused(() => InventoryService.issueMaterial({ contractorId: cA.id, storeId: subA.id, month, userId: offB, items: [{ itemId: items[0].id, quantity: 1 }] } as any))));
        check('S3 a material request in the name of the other sub store is refused', !!(await refused(() => InventoryService.createStockRequest({ fromStoreId: subB.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: offA, priority: 'NORMAL', purpose: 'ZZTEST', items: [{ itemId: items[0].id, requestedQty: 1 }] } as any))), (await refused(() => InventoryService.createStockRequest({ fromStoreId: subB.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: offA, priority: 'NORMAL', purpose: 'ZZTEST', items: [{ itemId: items[0].id, requestedQty: 1 }] } as any))) || 'ACCEPTED');
        const id5 = await newRequest(subB, offB, { 2: 5 }); await release(id5);
        check('S4 receiving a delivery addressed to the other sub store is refused', !!(await refused(() => receive(id5, offA))));
        const listedA = (await ContractorStoreService.listFor(offA, subA.id)).map((c: any) => c.id);
        check('S5 contractors offered to sub A are the area X ones only; the balance of an area Y contractor cannot be read', listedA.includes(cA.id) && !listedA.includes(cB.id) && !!(await refused(() => ContractorStoreService.assertCanSee(offA, cB.id))));
        check('S6 stock of the other sub store cannot be read through the stock service', !!(await refused(async () => { const allowed = await idsOf(offA); if (!allowed.includes(subB.id)) throw new Error('STORE_SCOPE_VIOLATION'); return InventoryService.getStock(subB.id, allowed); })));
        check('S7 a user with no store and no area right sees no store at all', (await idsOf((await (async () => { const u: any = await mk('nostore', 'STORES_ASSISTANT', opmcY.id); await prisma.user.update({ where: { id: u }, data: { assignedStoreId: null } }); return u; })()))).filter((x: string) => [main.id, subA.id].includes(x)).length === 0);

        // ======================= SQL FUNCTIONS AGAINST THEIR TABLES =======================
        await prisma.inventoryStock.updateMany({ where: { storeId: subA.id, itemId: items[0].id }, data: { minLevel: 150 } });
        const ids = [main.id, subA.id, subB.id];
        const bal: any[] = await prisma.$queryRaw`SELECT * FROM fn_multi_store_material_balance(${ids}::uuid[], NULL::text)`;
        const rows = await prisma.inventoryStock.findMany({ where: { storeId: { in: ids } }, include: { item: true } });
        const mism: string[] = [];
        for (const s of rows) {
            const b = bal.find((x) => x.store_id === s.storeId && x.item_id === s.itemId);
            if (!b) { mism.push('missing ' + s.itemId); continue; }
            if (r2(num(b.current_stock)) !== r2(num(s.quantity)) || r2(num(b.allocated_stock)) !== r2(num(s.allocatedQuantity)) || r2(num(b.available_stock)) !== r2(num(s.quantity) - num(s.allocatedQuantity))) mism.push(`${s.itemId}: fn ${b.current_stock}/${b.allocated_stock}/${b.available_stock} vs ${s.quantity}/${s.allocatedQuantity}`);
        }
        check('Q1 material balance function = stock table (on hand, allocated, available) for every store and item', mism.length === 0 && bal.length === rows.length, mism.join('; ') || `${rows.length} rows`);

        const low: any[] = await prisma.$queryRaw`SELECT * FROM fn_low_stock_alerts(${subA.id}::uuid)`;
        const l0 = low.find((x) => x.item_id === items[0].id);
        check('Q2 low stock function: the item below its store minimum (10 held, minimum 150) is listed with the right deficit; items above their minimum are not', !!l0 && r2(num(l0.deficit)) === 140 && !low.some((x) => x.item_id === items[2].id), JSON.stringify(low.map((x) => [x.item_code?.slice(-1), x.current_stock, x.min_level, x.deficit])));

        const dash: any[] = await prisma.$queryRaw`SELECT * FROM fn_store_dashboard_summary(${subA.id}::uuid)`;
        const dm = (k: string) => num(dash.find((x) => x.metric_name === k)?.metric_value);
        const sAll = await prisma.inventoryStock.findMany({ where: { storeId: subA.id } });
        check('Q3 store dashboard function: item count and total quantity equal the stock table', dm('total_unique_items') === sAll.length && r2(dm('total_quantity')) === r2(sAll.reduce((a, s) => a + num(s.quantity), 0)), JSON.stringify(Object.fromEntries(dash.map((x) => [x.metric_name, num(x.metric_value)]))));
        const balA = r2(bal.filter((x) => x.store_id === subA.id).reduce((a, x) => a + num(x.total_value), 0));
        check('Q4 the value of a store is the same on the dashboard and in the material balance (cost 10 per piece; the item selling price is 12)', r2(dm('total_value')) === balA, `dashboard ${dm('total_value')} vs material balance ${balA} (stock value at cost = ${r2(sAll.reduce((a, s) => a + num(s.quantity) * 10, 0))})`);

        const mv: any[] = await prisma.$queryRaw`SELECT * FROM fn_stock_movement_report(${subA.id}::uuid, NULL::date, NULL::date)`;
        const mvBad: string[] = [];
        for (const it of items) {
            const lines = mv.filter((x) => x.item_id === it.id);
            const last = lines.length ? num(lines[0].running_balance) : 0; // the report is newest first
            const net = lines.reduce((a, x) => a + num(x.quantity_in) - num(x.quantity_out), 0);
            const held = await stock(subA.id, it.id);
            if (r2(last) !== r2(held) || r2(net) !== r2(held)) mvBad.push(`${it.code.slice(-1)}: running ${last}, in-out ${net}, held ${held}`);
        }
        check('Q5 stock movement report (stock card): the running balance and in minus out equal the stock held, for every item', mvBad.length === 0, mvBad.join('; '));

        const cs: any[] = await prisma.$queryRaw`SELECT * FROM fn_contractor_stock_summary(${cA.id}::uuid)`;
        const cRows = await prisma.contractorStock.findMany({ where: { contractorId: cA.id } });
        check('Q6 contractor stock summary: item count and total quantity equal the contractor stock table', num(cs[0]?.total_items) === cRows.filter((x) => num(x.quantity) > 0).length && r2(num(cs[0]?.total_quantity)) === r2(cRows.reduce((a, x) => a + num(x.quantity), 0)), show(cs[0]));

        const ledgerBad: string[] = [];
        for (const st of [main, subA, subB]) for (const it of items) {
            const last = await prisma.inventoryLedger.findFirst({ where: { storeId: st.id, itemId: it.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
            const held = await stock(st.id, it.id);
            if (!last || r2(num(last.quantityAfter)) !== r2(held)) ledgerBad.push(`${st.name.slice(-6)}/${it.code.slice(-1)}: ledger ${last?.quantityAfter} vs stock ${held}`);
        }
        check('Q7 the last audit ledger entry of every store and item equals the stock held', ledgerBad.length === 0, ledgerBad.join('; '));

    } catch (e: any) {
        check('script ran to the end without an unexpected error', false, String(e?.stack ?? e).slice(0, 600));
    } finally {
        const { UserService: US } = await import('../src/services/hr/user.service');
        for (const id of created.users) await US.deleteUser(id, admin).catch(async () => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of created.users) await prisma.user.update({ where: { id }, data: { assignedStoreId: null, email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
        for (const id of created.stores) await prisma.inventoryStore.update({ where: { id }, data: { type: 'SUB', name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of created.contractors) await prisma.contractor.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        for (const id of created.sods) await prisma.serviceOrder.update({ where: { id }, data: { soNum: `ZZTEST-CLOSED-${id.slice(-8)}`, customerName: 'ZZTEST (closed)', contractorId: null } as any }).catch(() => undefined);
        for (const id of created.items) await prisma.inventoryItem.update({ where: { id }, data: { name: 'ZZTEST (closed) ' + id.slice(-6) } }).catch(() => undefined);
        void UserService;
    }
    const bad = results.filter((x) => !x[1]).length;
    console.log(bad === 0 ? `ALL ${results.length} CHECKS PASSED` : `${bad} CHECK(S) FAILED of ${results.length}`);
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 900)); process.exit(1); });
