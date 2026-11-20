import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateSodForInvoicing } from '../../src/services/service-order/sod-financial-validation';
import { patSatisfied, isPatPassed } from '../../src/lib/sod-approval-rules';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('a manual return keeps the reason the person gave', () => {
    const src = read('src/services/service-order/sod.lifecycle.service.ts');
    assert.ok(src.includes("if (sltsStatus === 'RETURN')") && src.includes('updateData.returnReason = reason'), 'the return reason reaches the status writer');
});

test('a return made in the ERP is not undone by a portal listing that is not newer than the return', () => {
    const src = read('src/services/service-order/sod.sync.service.ts');
    assert.ok(src.includes("serviceOrderStatusHistory.findFirst({ where: { serviceOrderId: existing.id, status: 'RETURN' }"), 'the real time of the return comes from the status history');
    assert.ok(src.includes('portalTouchedAt.getTime() <= returnedRow.createdAt.getTime()'), 'a portal date that is not after the return leaves the return in place');
});

test('the side effects of a restore are written only when the restore itself is applied', () => {
    const src = read('src/services/service-order/sod.sync.service.ts');
    assert.ok(src.includes('restoreExtras.receivedDate') && src.includes('restoreExtras.comments'), 'received date and note are held apart');
    assert.ok(src.includes('write.changed ? { ...fieldPayload, ...restoreExtras } : fieldPayload'), 'a refused restore writes neither');
    assert.ok(!/updatePayload\.comments\s*=\s*existingComments/.test(src), 'the restore note is not put in the general payload');
});

test('service orders have no preset approval gates: only the approval before invoicing applies', () => {
    const seed = read('src/services/admin/process-gate.service.ts');
    assert.ok(!seed.includes("label: '1. Contractor Work Assignment'") && !seed.includes("label: '2. Field Survey & Civil Execution'") && !seed.includes("label: '3. Provisional Acceptance Testing (PAT)'"), 'the preset no longer creates assign, start or complete gates');
});

test("the QC Officer cannot pass an order without stating that its photos were received and checked", () => {
    const svc = read("src/services/service-order/sod-approval.service.ts");
    assert.ok(svc.includes("level?.requiredRole === SOD_PHOTO_CHECK_ROLE") && svc.includes("photosChecked !== true"), "the QC step refuses a pass without the statement");
    assert.ok(svc.includes("SOD_PHOTO_CHECK_NOTE") && svc.includes("remarks"), "the statement is kept in the approval history");
    const rules = read("src/lib/sod-approval-rules.ts");
    assert.ok(rules.includes("SOD_PHOTO_CHECK_ROLE = 'QC_OFFICER'"), "it is the QC Officer step");
    assert.ok(read("src/app/api/service-orders/approvals/route.ts").includes("photosChecked"), "the route carries the statement");
    const page = read("src/app/service-orders/approvals/page.tsx");
    assert.ok(page.includes("Photos received and checked") && page.includes("needsPhotoCheck"), "the approvals page asks for it at the QC step");
});

test('only PAT-passed orders, or orders entered by hand, enter the approval chain, are listed, can be approved and can be invoiced', () => {
    const rules = read('src/lib/sod-approval-rules.ts');
    assert.ok(rules.includes("PAT_PASSED_VALUES = ['PAT_PASSED']") && rules.includes('SOD_PAT_PASSED = {') && rules.includes('{ isManualEntry: true }'), 'one definition: PAT passed, or entered by hand');
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes('AND: [SOD_PAT_OK, { OR: [{ sodApprovalStage: null }'), 'the chain starts only for PAT-satisfied orders');
    assert.ok(svc.includes('AND: [SOD_PAT_OK,') && svc.includes('NOT: SOD_PAT_OK'), 'the queue lists them and counts the waiting ones');
    assert.ok(svc.includes('!patSatisfied(o)') && svc.includes('SOD_PAT_WAITING_MESSAGE'), 'a PAT-pending order cannot be approved');
    assert.ok(read('src/services/invoice/invoicing.service.ts').includes('AND: [SOD_PAT_OK]'), 'the engineer is offered them only');
    const page = read('src/app/service-orders/approvals/page.tsx');
    assert.ok(page.includes('awaitingPat') && page.includes('orders.some(needsPhotoCheck)'), 'the page says how many wait for PAT and shows the photo box only at the QC step');
});

test('an order entered by hand is accepted for invoicing by the QC Officer pass instead of PAT; a portal order still needs PAT', () => {
    const base = { soNum: 'X', contractorId: 'c', completedDate: new Date(), revenueAmount: 100, contractorAmount: 60, sltsPatStatus: 'PENDING', opmcPatStatus: 'PENDING', hoPatStatus: 'PENDING', materialUsage: [] as never[] };
    assert.ok(validateSodForInvoicing({ ...base, isManualEntry: true, sodApprovalStage: 'READY' }).eligible, 'manual order passed by the QC Officer');
    assert.ok(!validateSodForInvoicing({ ...base, isManualEntry: true, sodApprovalStage: 'QC_OFFICER' }).eligible, 'not yet passed by the QC Officer');
    assert.ok(!validateSodForInvoicing({ ...base, isManualEntry: false, sodApprovalStage: 'READY' }).eligible, 'a portal order needs its PAT');
    assert.ok(validateSodForInvoicing({ ...base, sltsPatStatus: 'PAT_PASSED', opmcPatStatus: 'PAT_PASSED', hoPatStatus: 'PAT_PASSED' }).eligible, 'a portal order with PAT passed');
    assert.equal(patSatisfied({ isManualEntry: true }), true);
    assert.equal(patSatisfied({ sltsPatStatus: 'PAT_PASSED', opmcPatStatus: 'PAT_PASSED', hoPatStatus: 'PENDING' }), false);
});

test('a person who holds an approval step lands on a "My work" dashboard tab with what waits for them', () => {
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes('static async summary(userId: string, rtom?: string)') && svc.includes('It only reads: nothing is started here'), 'a read-only summary of the steps the person holds');
    assert.ok(read('src/app/api/service-orders/approvals/summary/route.ts').includes('SodApprovalService.summary'), 'the dashboard reads it from its own route');
    const page = read('src/app/dashboard/page.tsx');
    assert.ok(page.includes('useMyWorkSummary(!!user && !canFilterGlobally, workFilters.rtom)') && page.includes("setActiveTab('work')") && page.includes('<TabsTrigger value="work"'), 'the tab is first and is the landing tab for a person with a step; managers keep their overview');
    const comp = read('src/app/dashboard/components/MyWorkSection.tsx');
    assert.ok(comp.includes('Waiting at the {s.label} step') && comp.includes('Waiting for their PAT') && comp.includes('Open Pending SOD'), 'it shows the orders waiting at the step, those waiting for PAT and a way to the pending orders');
});

test('the dashboard of a person who works on the orders of their own RTOMs shows only that work, their RTOMs and each contractor\'s progress', () => {
    const svc = read('src/services/service-order/area-overview.service.ts');
    assert.ok(svc.includes('resolveOpmcScope(userId)') && svc.includes('opmcId: { in: scope }'), 'always limited to the person\'s own areas');
    assert.ok(svc.includes('if (allScope === undefined) return null'), 'a company-wide person has no own area and keeps the company dashboards');
    assert.ok(svc.includes('inHand') && svc.includes('completedThisMonth') && svc.includes('returnedThisMonth') && svc.includes('oldestInHandDays'), 'in hand, completed and returned per contractor');
    assert.ok(read('src/app/api/service-orders/area-overview/route.ts').includes('AreaOverviewService.forUser'), 'its own read-only route');
    const page = read('src/app/dashboard/page.tsx');
    assert.ok(page.includes('{!hasMyWork && canViewInventory &&') && page.includes('{!hasMyWork && canViewFinance &&') && page.includes('{!hasMyWork && !resolvingWork && <DashboardFilters'), 'the store, finance, project and company views and the company filters are not shown to them');
    assert.ok(page.includes('const resolvingWork = !canFilterGlobally && workSummary.isLoading'), 'no company view flashes before it is known');
    const comp = read('src/app/dashboard/components/MyWorkSection.tsx');
    assert.ok(comp.includes('Your RTOMs:') && comp.includes('Contractor progress in your RTOMs'), 'the RTOMs and the contractor progress table');
});

test('one meaning of PAT passed in the approval chain and at invoicing, and the dashboard numbers count what they say', () => {
    assert.equal(isPatPassed('PAT_PASSED'), true);
    assert.equal(isPatPassed('PASSED'), false, 'the older value is not accepted anywhere, so no order can pass the chain and then fail at invoicing');
    assert.equal(isPatPassed('PENDING'), false);
    assert.equal(isPatPassed(null), false);
    const ov = read('src/services/service-order/area-overview.service.ts');
    assert.ok(ov.includes('contractors.filter((c) => c.contractorId !== null)'), '"with contractors" does not count orders that have no contractor');
    assert.ok(ov.includes('finishedNoContractor'), 'finished orders with no contractor are counted on their own');
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes("then 'rejected'") && svc.includes("then 'slts'") && svc.includes("then 'opmc'") && svc.includes('s."sodApprovalStage" is null or'), 'the PAT wait is split by the approval waited for and also counts orders not yet in the chain');
});

test('the My work tab has a month and an RTOM filter that can only narrow what the person sees, and its cards lead to the order lists', () => {
    const ov = read('src/services/service-order/area-overview.service.ts');
    assert.ok(ov.includes('export async function narrowScope') && ov.includes('id: { in: scope }') && ov.includes('return one ? [one.id] : scope;'), 'an RTOM that is not the person\'s own is ignored, so a filter never widens the view');
    assert.ok(ov.includes('opts.month') && ov.includes('opts.year') && ov.includes('const to = new Date(y, m, 1)'), 'the figures are for the chosen month');
    assert.ok(read('src/services/service-order/sod-approval.service.ts').includes('narrowScope(allScope, rtom)'), 'the waiting counts follow the RTOM filter too');
    const comp = read('src/app/dashboard/components/MyWorkSection.tsx');
    assert.ok(comp.includes('aria-label="Month"') && comp.includes('aria-label="RTOM"') && comp.includes('All my RTOMs') && comp.includes('(data?.areas.length ?? 0) > 1'), 'month and year always, the RTOM filter only when the person has several RTOMs');
    assert.ok(comp.includes("href: '/service-orders/work-order/completed'") && comp.includes("href: '/service-orders/work-order/return'") && comp.includes("href: '/service-orders/work-order'"), 'the figures lead to the lists they count');
    assert.ok(comp.includes('Completed in {data.month}') && comp.includes('Returned in {data.month}'), 'the table columns name the month shown');
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
