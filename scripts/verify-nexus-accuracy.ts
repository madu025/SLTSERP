/**
 * Accuracy oracle for the Nexus report engine. Every case asks the report engine a question and compares the
 * answer with an independent raw-SQL query on the real database (read-only). Exit code 1 on any mismatch.
 *
 *   pnpm run verify:nexus        (needs DATABASE_URL; with a tunnel, put it in .env.local)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

type Agg = { groupBy: string; targetField: string; type: 'SUM' | 'AVG' | 'COUNT' };

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { DynamicReportService } = await import('../src/services/inventory/dynamic-report.service');
    let failed = 0; let passed = 0;
    const report = (ok: boolean, name: string, detail = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
    const run = async (entity: string, columns: string[], filters: Array<{ field: string; operator: string; value: string }>, aggregation?: Agg, opts: { opmcIds?: string[] } = {}) => {
        try { return await DynamicReportService.generateReport({ entity: entity as never, columns, filters: filters as never, aggregation }, opts); }
        catch (e) { return { type: 'ERROR', columns: [] as string[], rows: [{ error: String(e instanceof Error ? e.message : e).slice(0, 200) }] as Array<Record<string, unknown>>, capped: false, verified: false }; }
    };
    const sql = async (q: string) => (await prisma.$queryRawUnsafe<Array<{ k: unknown; v: unknown }>>(q)).map((r) => [r.k === null ? 'N/A' : String(r.k), Number(r.v)] as const);
    const same = (got: Array<Record<string, unknown>>, cols: string[], want: ReadonlyArray<readonly [string, number]>) => {
        const g = new Map(got.map((r) => [String(r[cols[0]]), Number(r[cols[1]])]));
        const w = new Map(want);
        const bad: string[] = [];
        for (const k of new Set([...g.keys(), ...w.keys()])) if (Math.abs((g.get(k) ?? 0) - (w.get(k) ?? 0)) > 0.011) bad.push(`${k}: agent=${g.get(k) ?? '-'} db=${w.get(k) ?? '-'}`);
        return { ok: bad.length === 0, detail: bad.length ? `${bad.length} wrong, e.g. ${bad.slice(0, 3).join(' | ')}` : `${g.size} groups` };
    };
    const check = async (name: string, entity: string, filters: Array<{ field: string; operator: string; value: string }>, agg: Agg, oracle: string, opts: { opmcIds?: string[] } = {}) => {
        const r = await run(entity, [], filters, agg, opts);
        if (r.type === 'ERROR') return report(false, name, String(r.rows[0].error));
        const c = same(r.rows, r.columns, await sql(oracle));
        report(c.ok && !r.capped && r.verified === true, name, c.detail + (r.capped ? ' CAPPED' : '') + (r.verified ? '' : ' UNVERIFIED'));
    };

    // ---- hand-written oracles: single table, joined, multi-hop, filtered, scoped ----
    await check('orders per status', 'serviceOrder', [], { groupBy: 'status', targetField: 'id', type: 'COUNT' }, `select status::text k, count(*) v from "ServiceOrder" group by 1`);
    await check('orders per RTOM, completed only', 'serviceOrder', [{ field: 'status', operator: 'equals', value: 'COMPLETED' }], { groupBy: 'rtom', targetField: 'id', type: 'COUNT' }, `select rtom k, count(*) v from "ServiceOrder" where status::text='COMPLETED' group by 1`);
    await check('revenue per RTOM', 'serviceOrder', [], { groupBy: 'rtom', targetField: 'revenueAmount', type: 'SUM' }, `select rtom k, round(sum("revenueAmount"),2) v from "ServiceOrder" group by 1`);
    await check('average revenue per status', 'serviceOrder', [], { groupBy: 'status', targetField: 'revenueAmount', type: 'AVG' }, `select status::text k, round(avg("revenueAmount"),2) v from "ServiceOrder" group by 1`);
    await check('orders per contractor (join)', 'serviceOrder', [], { groupBy: 'contractor.name', targetField: 'id', type: 'COUNT' }, `select c.name k, count(*) v from "ServiceOrder" s left join "Contractor" c on c.id=s."contractorId" group by 1`);
    await check('completed orders per OPMC region (join)', 'serviceOrder', [{ field: 'status', operator: 'equals', value: 'COMPLETED' }], { groupBy: 'opmc.region', targetField: 'id', type: 'COUNT' }, `select o.region k, count(*) v from "ServiceOrder" s left join "OPMC" o on o.id=s."opmcId" where s.status::text='COMPLETED' group by 1`);
    await check('revenue per contractor (join)', 'serviceOrder', [], { groupBy: 'contractor.name', targetField: 'revenueAmount', type: 'SUM' }, `select c.name k, round(sum(s."revenueAmount"),2) v from "ServiceOrder" s left join "Contractor" c on c.id=s."contractorId" group by 1`);
    await check('Oct completions by contractor, inclusive end date', 'serviceOrder', [{ field: 'completedDate', operator: 'gte', value: '2026-10-01' }, { field: 'completedDate', operator: 'lte', value: '2026-10-31' }], { groupBy: 'contractor.name', targetField: 'id', type: 'COUNT' }, `select c.name k, count(*) v from "ServiceOrder" s left join "Contractor" c on c.id=s."contractorId" where s."completedDate">='2026-10-01'::timestamp - interval '5:30' and s."completedDate"<'2026-11-01'::timestamp - interval '5:30' group by 1`);
    await check('material per item (join)', 'materialUsage', [], { groupBy: 'item.name', targetField: 'quantity', type: 'SUM' }, `select i.name k, round(sum(m.quantity),2) v from "SODMaterialUsage" m join "InventoryItem" i on i.id=m."itemId" group by 1`);
    await check('material per RTOM (join)', 'materialUsage', [], { groupBy: 'serviceOrder.rtom', targetField: 'quantity', type: 'SUM' }, `select s.rtom k, round(sum(m.quantity),2) v from "SODMaterialUsage" m join "ServiceOrder" s on s.id=m."serviceOrderId" group by 1`);
    await check('material per contractor (3 tables)', 'materialUsage', [], { groupBy: 'serviceOrder.contractor.name', targetField: 'quantity', type: 'SUM' }, `select c.name k, round(sum(m.quantity),2) v from "SODMaterialUsage" m join "ServiceOrder" s on s.id=m."serviceOrderId" left join "Contractor" c on c.id=s."contractorId" group by 1`);
    await check('completed + cable material per RTOM (2 filters, 3 tables)', 'materialUsage', [{ field: 'serviceOrder.status', operator: 'equals', value: 'COMPLETED' }, { field: 'item.name', operator: 'contains', value: 'cable' }], { groupBy: 'serviceOrder.rtom', targetField: 'quantity', type: 'SUM' }, `select s.rtom k, round(sum(m.quantity),2) v from "SODMaterialUsage" m join "ServiceOrder" s on s.id=m."serviceOrderId" join "InventoryItem" i on i.id=m."itemId" where s.status::text='COMPLETED' and i.name ilike '%cable%' group by 1`);
    await check('average material per item', 'materialUsage', [], { groupBy: 'item.name', targetField: 'quantity', type: 'AVG' }, `select i.name k, round(avg(m.quantity),2) v from "SODMaterialUsage" m join "InventoryItem" i on i.id=m."itemId" group by 1`);
    await check('contractor stock per contractor', 'contractorStock', [], { groupBy: 'contractor.name', targetField: 'quantity', type: 'SUM' }, `select c.name k, round(sum(s.quantity),2) v from "ContractorStock" s join "Contractor" c on c.id=s."contractorId" group by 1`);
    await check('contractor stock per item category', 'contractorStock', [], { groupBy: 'item.category', targetField: 'quantity', type: 'SUM' }, `select i.category k, round(sum(s.quantity),2) v from "ContractorStock" s join "InventoryItem" i on i.id=s."itemId" group by 1`);
    await check('wastage reports per contractor', 'wastage', [], { groupBy: 'contractor.name', targetField: 'id', type: 'COUNT' }, `select c.name k, count(*) v from "ContractorWastage" w join "Contractor" c on c.id=w."contractorId" group by 1`);
    const opmcs = await prisma.oPMC.findMany({ take: 3, select: { id: true, rtom: true } });
    for (const o of opmcs) {
        await check(`scope ${o.rtom}: material per item`, 'materialUsage', [], { groupBy: 'item.name', targetField: 'quantity', type: 'SUM' }, `select i.name k, round(sum(m.quantity),2) v from "SODMaterialUsage" m join "ServiceOrder" s on s.id=m."serviceOrderId" join "InventoryItem" i on i.id=m."itemId" where s."opmcId"='${o.id}' group by 1`, { opmcIds: [o.id] });
        await check(`scope ${o.rtom}: orders per status`, 'serviceOrder', [], { groupBy: 'status', targetField: 'id', type: 'COUNT' }, `select status::text k, count(*) v from "ServiceOrder" where "opmcId"='${o.id}' group by 1`, { opmcIds: [o.id] });
    }

    // ---- sweep: every queryable field of every entity as a group key; the engine's own reconciliation must hold ----
    const entities = ['serviceOrder', 'materialUsage', 'contractorStock', 'wastage', 'journalEntry'];
    for (const entity of entities) {
        const fields = DynamicReportService.fieldsFor(entity) ?? [];
        let n = 0; let bad = 0; const examples: string[] = [];
        for (const f of fields.filter((x) => x !== 'id' && !/Id$/.test(x) && !/(quantity|costPrice|unitPrice|revenueAmount|createdAt|updatedAt|date|Date|description|customerName|voiceNumber|soNum|referenceId|approvedAt)$/.test(x))) {
            const r = await run(entity, [], [], { groupBy: f, targetField: 'id', type: 'COUNT' });
            n++;
            if (r.type === 'ERROR' || !r.verified) { bad++; examples.push(`${f}: ${r.type === 'ERROR' ? r.rows[0].error : 'unverified'}`); }
        }
        report(bad === 0, `sweep ${entity}: ${n} group-by fields reconcile`, examples.slice(0, 2).join(' | '));
    }

    // ---- executive metrics and the dashboard must agree with the database and with each other ----
    {
        const { ExecutiveMetricService, resolvePeriod } = await import('../src/services/ai/executive-metrics.service');
        const { CompanyHealthService } = await import('../src/services/core/company-health.service');
        const { RBAC_PERMISSIONS } = await import('../src/config/rbac-permissions');
        const { ExecutiveInsightService } = await import('../src/services/ai/executive-insights.service');
        const perms = new Set<string>(Object.values(RBAC_PERMISSIONS) as string[]);
        const now = new Date();
        const p = resolvePeriod('this_month', now);
        const one = async (q: string) => Number((await prisma.$queryRawUnsafe<Array<{ v: unknown }>>(q))[0].v);
        const DONE = `('COMPLETED','INSTALL_CLOSED','PROV_CLOSED','PAT_OPMC_PASSED','PAT_CORRECTED')`;
        const between = (col: string) => `"${col}" >= '${p.from.toISOString()}'::timestamptz AND "${col}" <= '${p.to.toISOString()}'::timestamptz`;
        const eq = (name: string, got: number, want: number) => report(Math.abs(got - want) < 0.01, name, `agent=${got} db=${want}`);
        const val = async (id: string, from = p.from, to = p.to) => { const v = await ExecutiveMetricService.value(id as never, from, to, perms, undefined); return typeof v === 'number' ? v : NaN; };
        eq('metric completed_orders (this month, Colombo) = SQL', await val('completed_orders'), await one(`select count(*)::float v from "ServiceOrder" where status::text in ${DONE} and ${between('completedDate')}`));
        eq('metric new_orders = SQL', await val('new_orders'), await one(`select count(*)::float v from "ServiceOrder" where ${between('receivedDate')}`));
        eq('metric open_orders = SQL', await val('open_orders'), await one(`select count(*)::float v from "ServiceOrder" where status::text in ('PENDING','INPROGRESS','ASSIGNED')`));
        eq('metric orders_revenue = SQL', await val('orders_revenue'), await one(`select coalesce(sum("revenueAmount"),0)::float v from "ServiceOrder" where status::text in ${DONE} and ${between('completedDate')}`));
        const health = await CompanyHealthService.getCompanyHealth([...perms], now);
        eq('dashboard "completed" card = assistant completed_orders', health.operations?.completed.current ?? NaN, await val('completed_orders'));
        eq('dashboard open orders = assistant open_orders', health.operations?.openOrders ?? NaN, await val('open_orders'));
        const lastMonthly = health.operations?.completedMonthly.at(-1)?.completed ?? NaN;
        eq('dashboard monthly chart (this month) = assistant completed_orders', lastMonthly, await val('completed_orders'));
        if (health.finance) {
            eq('dashboard revenue = assistant revenue', health.finance.revenue.current, await val('revenue'));
            eq('dashboard expense = assistant expense', health.finance.expense.current, await val('expense'));
        }
        // brief, anomalies, projection must run end to end and never return an error for a user with full access
        for (const [name, fn] of [['anomalies', () => ExecutiveInsightService.anomalies(perms, undefined)], ['projection (completed_orders)', () => ExecutiveInsightService.project('completed_orders', perms, undefined)], ['profile of a contractor', async () => ExecutiveInsightService.profile('contractor', (await prisma.contractor.findFirst({ select: { name: true } }))!.name, perms, undefined)]] as const) {
            const r = await (fn as () => Promise<Record<string, unknown>>)();
            report(!('error' in r), `executive ${name} runs`, 'error' in r ? String(r.error) : '');
        }
    }

    // ---- safety: hostile input is rejected or treated as plain text ----
    for (const g of ['item.name; drop table x', 'item."name', 'serviceOrder.contractor.password']) {
        const r = await run('materialUsage', [], [], { groupBy: g, targetField: 'quantity', type: 'SUM' });
        report(r.type === 'ERROR', `rejects group key ${JSON.stringify(g)}`);
    }
    const inj = await run('materialUsage', [], [{ field: 'item.name', operator: 'contains', value: `x'; drop table "Contractor"; --` }], { groupBy: 'item.name', targetField: 'quantity', type: 'SUM' });
    report(inj.type === 'AGGREGATED' && inj.rows.length === 0, 'quote and semicolon in a value are plain text');
    const nonNumeric = await run('serviceOrder', [], [], { groupBy: 'status', targetField: 'customerName', type: 'SUM' });
    report(nonNumeric.type === 'ERROR', 'SUM of a text field is refused, not guessed');

    console.log(`\n${passed} passed, ${failed} failed`);
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
