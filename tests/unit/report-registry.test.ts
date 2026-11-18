import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_REGISTRY_PROBLEMS, EXTRA_ENTITIES, RESOLVED_ENTITIES } from '../../src/services/reports/entity-registry';
import { REPORT_ENTITY_PERMISSION, reportMeta, reportToolSpec, runUserReport } from '../../src/services/reports/report-center.service';
import { DynamicReportService, __joinInternals } from '../../src/services/inventory/dynamic-report.service';
import { groundReportFilters } from '../../src/services/ai/semantic-layer.service';
import { repairNote, reportTitle } from '../../src/services/ai/nexus-repair';
import { RBAC_PERMISSIONS as P } from '../../src/config/rbac-permissions';

test('every registry entity matches the real Prisma schema (a renamed column fails here, not in production)', () => {
    assert.deepEqual([...ENTITY_REGISTRY_PROBLEMS], []);
    for (const e of EXTRA_ENTITIES) assert.ok(RESOLVED_ENTITIES[e.id], `${e.id} was skipped`);
});

test('every registry entity is gated by a capability and its sensitive fields by another', () => {
    for (const e of EXTRA_ENTITIES) assert.ok(Object.values(P).includes(e.permission as never), `${e.id}: unknown capability`);
    assert.equal(REPORT_ENTITY_PERMISSION.project, P.PROJECT_READ);
    assert.equal(REPORT_ENTITY_PERMISSION.ticket, P.HELPDESK_READ);
    // nothing that identifies or pays a person is queryable
    const banned = /password|token|secret|nic|bank|email|salary|passbook|securityAnswer|contactNumber|phone/i;
    for (const e of EXTRA_ENTITIES) assert.deepEqual(e.fields.filter((f) => banned.test(f)), [], `${e.id} exposes a personal or secret field`);
});

test('field types come from the schema', () => {
    assert.equal(DynamicReportService.kindOf('purchaseOrder', 'totalAmount'), 'num');
    assert.equal(DynamicReportService.kindOf('purchaseOrder', 'orderDate'), 'date');
    assert.equal(DynamicReportService.kindOf('purchaseOrder', 'status'), 'text');
    assert.equal(DynamicReportService.kindOf('project', 'progress'), 'num');
    assert.equal(DynamicReportService.kindOf('serviceOrder', 'revenueAmount'), 'num');
});

test('joins and filters on registry entities build parameterised SQL', () => {
    const params: unknown[] = [];
    const c = __joinInternals.sqlCondition({ field: 'totalAmount', operator: 'gt', value: '1000' }, params, 'purchaseOrder');
    assert.match(c.sql, /"totalAmount" > \$1::numeric/);
    assert.deepEqual(params, [1000]);
    const joins = __joinInternals.sqlJoins('projectTask', ['project.opmc', 'contractor']);
    assert.match(joins, /LEFT JOIN "Project" j_project ON j_project\."id" = t\."projectId"/);
    assert.match(joins, /LEFT JOIN "OPMC" j_project_opmc ON j_project_opmc\."id" = j_project\."opmcId"/);
    assert.match(joins, /LEFT JOIN "Contractor" j_contractor/);
});

test('scope: entities with an OPMC path are limited to it, the others are refused for scoped users', async () => {
    assert.deepEqual(DynamicReportService.scopeWhereFor('project', ['o1']), { opmcId: { in: ['o1'] } });
    assert.deepEqual(DynamicReportService.scopeWhereFor('projectTask', ['o1']), { project: { opmcId: { in: ['o1'] } } });
    assert.deepEqual(DynamicReportService.scopeWhereFor('contractorInvoice', ['o1']), { contractor: { opmcId: { in: ['o1'] } } });
    assert.equal(DynamicReportService.scopeWhereFor('purchaseOrder', ['o1']), undefined);
    const proc = new Set<string>([P.PROCUREMENT_READ]);
    assert.deepEqual(await runUserReport({ entity: 'purchaseOrder', columns: ['poNumber'] }, proc, ['o1']), { error: 'This report is only available to users with company-wide access.' });
    const all = new Set<string>(Object.values(REPORT_ENTITY_PERMISSION));
    const scoped = reportMeta(all, ['o1']).map((e) => e.id);
    for (const id of ['project', 'projectTask', 'contractor', 'contractorInvoice', 'supplierInvoice']) assert.ok(scoped.includes(id), id);
    for (const id of ['purchaseOrder', 'grn', 'ticket', 'inventoryItem']) assert.ok(!scoped.includes(id), id);
});

test('fields that need an extra capability are hidden and refused', async () => {
    const proj = new Set<string>([P.PROJECT_READ]);
    const fields = reportMeta(proj, undefined).find((e) => e.id === 'project')!.fields.map((f) => f.path);
    assert.ok(fields.includes('status') && !fields.includes('budget') && !fields.includes('actualCost'));
    const withFin = new Set<string>([P.PROJECT_READ, P.PROJECT_FINANCE_READ]);
    assert.ok(reportMeta(withFin, undefined).find((e) => e.id === 'project')!.fields.some((f) => f.path === 'budget'));
    const r = await runUserReport({ entity: 'project', columns: ['budget'] }, proj, undefined);
    assert.ok('error' in r && /project\.finance\.read/.test(r.error));
    const g = await runUserReport({ entity: 'projectTask', columns: [], aggregation: { groupBy: 'status', targetField: 'actualCost', type: 'SUM' } }, proj, undefined);
    assert.ok('error' in g && /project\.finance\.read/.test(g.error));
});

test('an unknown table is a correctable request and lists only the tables this user may use', async () => {
    const r = await runUserReport({ entity: 'tickets', columns: ['status'] }, new Set<string>([P.HELPDESK_READ]), undefined);
    assert.ok('error' in r && r.repairable === true);
    assert.match((r as { hint: string }).hint, /ticket/);
    assert.doesNotMatch((r as { hint: string }).hint, /project\b/, 'a table the user cannot read must not be offered');
});

test('a malformed request is repairable, a refused one is not', async () => {
    const proj = new Set<string>([P.PROJECT_READ]);
    const bad = await runUserReport({ entity: 'project', columns: ['nonsense'] }, proj, undefined);
    assert.ok('error' in bad && bad.repairable === true && /Fields of "project"/.test(bad.hint ?? ''));
    assert.doesNotMatch(bad.hint ?? '', /budget/, 'a field the user may not read must not be suggested');
    const refused = await runUserReport({ entity: 'project', columns: ['name'] }, new Set<string>(), undefined);
    assert.ok('error' in refused && !refused.repairable);
});

test('values for fixed lists are corrected or explained from the schema', async () => {
    const ok = await groundReportFilters('project', [{ field: 'status', operator: 'contains', value: 'in progress' }], undefined);
    assert.equal(ok.issue, undefined);
    assert.equal(ok.filters[0].value, 'IN_PROGRESS');
    const typo = await groundReportFilters('ticket', [{ field: 'priority', operator: 'equals', value: 'critcal' }], undefined);
    assert.equal(typo.filters[0].value, 'CRITICAL');
    const bad = await groundReportFilters('ticket', [{ field: 'status', operator: 'equals', value: 'banana' }], undefined);
    assert.match(bad.issue ?? '', /Allowed values: OPEN, ASSIGNED/);
});

test('the model is told every table by name, without any data', () => {
    const spec = reportToolSpec();
    for (const id of ['serviceOrder', 'project', 'ticket', 'purchaseOrder', 'supplierInvoice']) assert.ok(spec.ids.includes(id), id);
    assert.match(spec.tables, /ticket \(.*\)\[ticketNumber,category,priority,status/);
    assert.match(spec.words, /helpdesk.* -> ticket/);
});

test('the correction note names what was wrong and forbids dropping a condition', () => {
    const note = repairNote({ name: 'runCustomReport', args: {}, result: { error: 'Columns [x] are not permitted for entity \'project\'.', repairable: true, hint: 'Fields of "project": name, status.' } });
    assert.match(note ?? '', /FAILED: Columns \[x\]/);
    assert.match(note ?? '', /Fields of "project": name, status\./);
    assert.match(note ?? '', /Never drop a condition/);
    assert.equal(repairNote({ name: 'runCustomReport', args: {}, result: { error: 'You do not have access to this report.' } }), null);
    assert.equal(repairNote({ name: 'getProfile', args: {}, result: { error: 'x', repairable: true } }), null);
    assert.equal(repairNote({ name: 'runCustomReport', args: {}, result: { rows: [] } }), null);
});

test('report titles are readable', () => {
    assert.equal(reportTitle({ entity: 'serviceOrder', aggregation: { groupBy: 'rtom', targetField: 'id', type: 'COUNT' } }), 'Service orders by RTOM');
    assert.equal(reportTitle({ entity: 'serviceOrder', aggregation: { groupBy: 'rtom', targetField: 'revenueAmount', type: 'SUM' } }), 'Total Revenue by RTOM');
    assert.equal(reportTitle({ entity: 'project' }), 'Projects');
    assert.equal(reportTitle({ entity: 'ticket', aggregation: { groupBy: 'status', targetField: 'id', type: 'COUNT' } }), 'Helpdesk tickets by Status');
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
