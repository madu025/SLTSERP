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
    const table = read("src/app/service-orders/work-order/components/SODSheetTable.tsx");
    assert.ok(table.includes("Photos received and checked") && table.includes("onTickPhotos"), "the Completed SOD list asks for it on each order");
    assert.ok(read("src/app/api/service-orders/approvals/photos/route.ts").includes("setPhotos"), "the tick goes through the check step");
});

test('only PAT-passed orders, or orders entered by hand, enter the approval chain, are listed, can be approved and can be invoiced', () => {
    const rules = read('src/lib/sod-approval-rules.ts');
    assert.ok(rules.includes("PAT_PASSED_VALUES = ['PAT_PASSED']") && rules.includes('SOD_PAT_PASSED = {') && rules.includes('{ isManualEntry: true }'), 'one definition: PAT passed, or entered by hand');
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes('AND: [SOD_PAT_OK, { OR: [{ sodApprovalStage: null }'), 'the chain starts only for PAT-satisfied orders');
    assert.ok(svc.includes('AND: [SOD_PAT_OK,') && svc.includes('NOT: SOD_PAT_OK'), 'the queue lists them and counts the waiting ones');
    assert.ok(svc.includes('!patSatisfied(o)') && svc.includes('SOD_PAT_WAITING_MESSAGE'), 'a PAT-pending order cannot be approved');
    assert.ok(read('src/services/invoice/invoicing.service.ts').includes('AND: [SOD_PAT_OK]'), 'the engineer is offered them only');
    assert.ok(read('src/app/dashboard/components/MyWorkSection.tsx').includes('awaitingPat'), 'the dashboard says how many wait for PAT');
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
    assert.ok(ov.includes('contractorId: { not: null }') && !ov.includes('finishedNoContractor') && !ov.includes('notAssigned'), 'every figure is the contractors\x27 own: orders with no contractor are not part of the dashboard');
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

test('the area dashboard shows why orders were returned and each contractor\'s SLA and return rate, from the same data as the Return SOD page', () => {
    const ov = read('src/services/service-order/area-overview.service.ts');
    assert.ok(ov.includes('SODReturnClassifierService.classify(text)') && ov.includes("by: ['contractorId', 'returnReason']"), 'the free-text return reasons are grouped by the same classifier the performance report uses, per contractor');
    assert.ok(ov.includes('SOD_TURNAROUND_SLA_DAYS') && ov.includes('make_interval(days =>'), 'the SLA is the same target of days as the performance report');
    assert.ok(ov.includes('c.returnRatePct = all > 0') && ov.includes('c.slaPct ='), 'return rate is returned over completed plus returned');
    const comp = read('src/app/dashboard/components/MyWorkSection.tsx');
    assert.ok(comp.includes('Why orders were returned in {data.month}') && comp.includes('Open Return SOD') && comp.includes('Main return reason') && comp.includes('Return rate'), 'the reasons and the contractor columns are on the tab, with a way to the Return SOD list');
});

test('an area person sees only the stock of their own contractors, and the contractor field portal is for the contractors own people', () => {
    const svc = read('src/services/service-order/area-contractor-stock.service.ts');
    assert.ok(svc.includes('resolveOpmcScope(userId)') && svc.includes('contractor: { opmcId: { in: scope } }') && svc.includes('narrowScope('), 'stock is limited to the contractors of their own RTOMs');
    assert.ok(read('src/app/api/service-orders/contractor-stock/route.ts').includes('RBAC_PERMISSIONS.SOD_READ'), 'read with the service order capability');
    const menu = read('src/config/sidebar-menu.ts');
    assert.ok(menu.includes("path: '/service-orders/contractor-stock'") && menu.includes('permissionId: RBAC_PERMISSIONS.CONTRACTOR_WRITE, // the field portal'), 'the stock page is in the menu and the field portal needs the contractor capability');
});

test('the order screens read the material list through the service order capability, so an area person does not need the inventory module', () => {
    const route = read('src/app/api/service-orders/material-items/route.ts');
    assert.ok(route.includes('RBAC_PERMISSIONS.SOD_READ') && route.includes('unitPrice: _u') && route.includes('costPrice: _c'), 'read with the order capability, without the store prices');
    assert.ok(read('src/app/service-orders/work-order/page.tsx').includes('/api/service-orders/material-items') && !read('src/app/service-orders/work-order/page.tsx').includes('/api/inventory/items'), 'the Pending SOD page no longer reads the inventory module');
    const boot = read('src/config/rbac-bootstrap.ts');
    const inv = boot.slice(boot.indexOf('[RBAC_PERMISSIONS.INVENTORY_READ]'), boot.indexOf('[RBAC_PERMISSIONS.INVENTORY_COST_READ]'));
    assert.ok(!inv.includes('AREA_COORDINATOR'), 'the Area Coordinator has no inventory access; the stock of their contractors is on Contractor Stock');
});

test('Offline is a filter on every order list, not a page of its own, and the menu lists the order pages in the order the work goes', () => {
    const menu = read('src/config/sidebar-menu.ts');
    assert.ok(!menu.includes("title: 'Offline Work Orders'"), 'no separate Offline page in the menu');
    const at = (t: string) => menu.indexOf(`title: '${t}'`);
    assert.ok(at('Pending SOD') < at('Install Closed SOD') && at('Install Closed SOD') < at('Completed SOD') && at('Completed SOD') < at('Return SOD') && at('Return SOD') < at('Disappeared SODs'), 'pending, install closed, completed, return, disappeared');
    assert.ok(read('src/services/service-order/sod.query.service.ts').includes('if (offlineOnly) andFilters.push({ isOfflineWorkOrder: true })') && read('src/app/api/service-orders/route.ts').includes("offlineOnly: searchParams.get('offline') === '1'"), 'the list API filters on the Offline mark');
    assert.ok(read('src/app/service-orders/work-order/page.tsx').includes('Offline only'), 'every list page has the Offline only button');
});

test('manual and offline orders sit on the same lists as portal orders and differ only by their marks', () => {
    const q = read('src/services/service-order/sod.query.service.ts');
    assert.ok(q.includes('isManualEntry: true,') && q.includes('isOfflineWorkOrder: true,') && q.includes('offlineReference: true,'), 'the list returns where an order came from, so the marks can show');
    const table = read('src/app/service-orders/work-order/components/SODSheetTable.tsx');
    assert.ok(table.includes('order.isManualEntry &&') && table.includes('MANUAL') && table.includes('OFFLINE'), 'a mark for a manual order and one for an offline order');
    const create = read('src/app/api/service-orders/route.ts');
    assert.ok(create.includes("completedDate: mappedStatus === 'INSTALL_CLOSED' ? now : null") && create.includes('Choose the contractor who did the work'), 'a manual Install Closed order has a completion date, so it is on Completed too, and names its contractor');
    assert.ok(create.includes('opmcId: opmc.id') && create.includes('The contractor does not belong to this RTOM'), 'the contractor must be one of the RTOM');
    const modal = read('src/components/modals/ManualEntryModal.tsx');
    assert.ok(modal.includes('name="contractorId"') && modal.includes('if (!isOpen) form.reset()'), 'the form takes a contractor and is cleared when it closes, not when a save fails');
});

test('a manual return keeps its reason, its date and its comment', () => {
    const schema = read('src/lib/validations/service-order.schema.ts');
    const patch = schema.slice(schema.indexOf('export const serviceOrderPatchSchema'), schema.indexOf('export const serviceOrderUpdateSchema'));
    assert.ok(patch.includes('returnReason:') && patch.includes('statusDate:'), 'the PATCH schema must not strip the return reason and date');
    assert.ok(read('src/app/service-orders/work-order/page.tsx').includes('comments: [pendingReturnOrder.comments'), 'the comment keeps the earlier lines and adds the manual return line');
});

test('no order is completed by a person without a contractor, and finished orders without one are marked', () => {
    const svc = read('src/services/service-order/index.ts');
    assert.ok(svc.includes("(data.sltsStatus === 'COMPLETED' || data.sltsStatus === 'INSTALL_CLOSED') && oldOrder.sltsStatus !== data.sltsStatus") && svc.includes('Assign the contractor who did the work before completing the order'), 'the server refuses a completion without a contractor (a system writer such as the portal sync has no person and is not refused)');
    assert.ok(svc.includes('data.contractorId !== undefined ? data.contractorId : oldOrder.contractorId'), 'a contractor sent with the completion counts');
    assert.ok(read('src/components/modals/order-action/useOrderAction.ts').includes('Select the contractor who did the work'), 'the Complete form asks for it');
    const page = read('src/app/service-orders/work-order/page.tsx');
    assert.ok(page.includes("if (action === 'COMPLETE')") && page.includes('have no contractor'), 'the bulk Complete stops when a selected order has none');
    assert.ok(read('src/app/service-orders/work-order/components/SODSheetTable.tsx').includes('NO CONTRACTOR'), 'a finished order with no contractor carries a mark');
});

test('the Area Coordinator and the QC Officer hold both order approval steps, so either covers the other', () => {
    const boot = read('src/config/rbac-bootstrap.ts');
    const grant = (code: string) => boot.slice(boot.indexOf(`[RBAC_PERMISSIONS.${code}]`), boot.indexOf('],', boot.indexOf(`[RBAC_PERMISSIONS.${code}]`)) + 2);
    for (const code of ['INVOICE_CONFIRM_COORDINATOR', 'INVOICE_CONFIRM_QC']) {
        assert.ok(grant(code).includes('AREA_COORDINATOR') && grant(code).includes('QC_OFFICER'), `both roles hold ${code}`);
    }
});

test('the check is done on the Completed SOD page: connection, material and photos make an order ready, and the separate approvals page is gone', () => {
    const menu = read('src/config/sidebar-menu.ts');
    assert.ok(!menu.includes("title: 'SOD Approvals'"), 'no SOD Approvals entry in the menu');
    assert.ok(read('src/app/service-orders/approvals/page.tsx').includes("redirect('/service-orders/work-order/completed?check=waiting')"), 'the old address leads to the list');
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes('static async setPhotos') && svc.includes('photosCheckedAt: checked ? new Date() : null') && svc.includes('this.approve(userId, marked, undefined, true)'), 'ticking the photos records who and when, then passes the order if it has everything');
    assert.ok(svc.includes('!o.photosCheckedAt'), 'the recorded tick stands for the statement when the order is passed later');
    assert.ok(read('src/services/service-order/index.ts').includes('if (fresh?.photosCheckedAt) await SodApprovalService.approve'), 'entering the material on an order whose photos are checked passes it');
    const q = read('src/services/service-order/sod.query.service.ts');
    assert.ok(q.includes("check === 'waiting'") && q.includes("check === 'nocontractor'") && q.includes("check === 'ready'"), 'the list filters on the check');
    assert.ok(read('prisma/migrations/20261211000000_sod_photos_checked/migration.sql').includes('"photosCheckedAt"'), 'the migration adds the columns');
});

test('the QC step is one step for the QC Officer or the Area Coordinator and it needs the material entered and the photos checked', () => {
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes('SOD_MATERIAL_CHECK_MESSAGE') && svc.includes('photoCheck && (materialLines.get(o.id) ?? 0) === 0'), 'an order with no material lines is not passed at the QC step');
    assert.ok(svc.includes('materialLines: o._count.materialUsage'), 'the queue tells how many material lines each order has');
    const table = read('src/app/service-orders/work-order/components/SODSheetTable.tsx');
    assert.ok(table.includes('renderCheckCell') && table.includes('Material{material > 0'), 'the Completed SOD list shows whether the material is entered');
    assert.ok(read('src/lib/sod-approval-rules.ts').includes('SOD_MATERIAL_CHECK_MESSAGE'), 'the message is in the shared rules');
});

test('the finished-order check shows each PAT approval, and says a manual order has no PAT', () => {
    const table = read('src/app/service-orders/work-order/components/SODSheetTable.tsx');
    assert.ok(table.includes("['SLTS', order.sltsPatStatus], ['OPMC', order.opmcPatStatus], ['HO', order.hoPatStatus]") && table.includes("st === 'PAT_PASSED'"), 'SLTS, OPMC and HO, passed only when PAT_PASSED (the one value that counts for invoicing)');
    assert.ok(table.includes('No PAT (manual)'), 'a manual order is marked as having no PAT');
});

test('the engineer Invoicing page: one check by Coordinator or QC, a count of orders still waiting, and a return clears the photo tick', () => {
    const page = read('src/app/service-orders/invoicing/page.tsx');
    assert.ok(page.includes('Return to the check') && !page.includes('Return to Area Coordinator'), 'the return button names the Completed SOD check, not only the coordinator');
    assert.ok(page.includes('waitingCheck') && page.includes('/service-orders/work-order/completed?check=waiting'), 'the page tells how many orders still wait for the check, with a link');
    const svc = read('src/services/invoice/invoicing.service.ts');
    assert.ok(svc.includes('waitingCheck') && svc.includes('SOD_PAT_OK'), 'the count uses the same PAT rule as the check');
    assert.ok(read('src/services/service-order/sod-approval.service.ts').includes('photosCheckedAt: null, photosCheckedById: null'), 'an order the engineer returns must have its photos checked again');
});

test('the engineer follows the invoices of the area on the Invoicing page', () => {
    assert.ok(read('src/app/service-orders/invoicing/page.tsx').includes('Invoices of your area') && read('src/app/api/invoicing/route.ts').includes("view') === 'invoices'"), 'the page lists the invoices through the invoicing API');
    assert.ok(read('src/services/invoice/invoicing.service.ts').includes('recentInvoices') && read('src/services/invoice/invoicing.service.ts').includes('opmcId: { in: scope }'), 'the list is limited to the engineer area');
});

test('the contractor verifies the checked orders before the engineer invoices; problems go back to the check', () => {
    const svc = read('src/services/service-order/contractor-verification.service.ts');
    assert.ok(svc.includes('contractorVerifiedAt: new Date()') && svc.includes('contractorId,') && svc.includes("'contractor'"), 'verify and report are limited to the contractor own orders, and a report returns them to the check');
    assert.ok(read('src/app/api/contractor/verify-sods/route.ts').includes('RBAC_PERMISSIONS.CONTRACTOR_WRITE'), 'the contractor API needs the contractor capability');
    const inv = read('src/services/invoice/invoicing.service.ts');
    assert.equal((inv.match(/contractorVerifiedAt: \{ not: null \}/g) ?? []).length, 2, 'the engineer list and the invoice creation both need the contractor verification');
    assert.ok(inv.includes('waitingContractor'), 'the engineer is told how many orders wait for the contractor');
    const approval = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(approval.includes('contractorVerifiedAt: null, contractorVerifiedById: null, sodReturnNote'), 'a returned order loses its photo tick and its contractor verification and keeps the reason');
    const gate = read('src/services/invoice/invoice-gate.service.ts');
    assert.ok(gate.includes("SodApprovalService.returnReady(result.orderIds, userId") && !gate.includes('invoicingHoldReason: `Taken out of invoice'), 'orders taken out of an invoice go back to the check, not to the engineer hold list');
    assert.ok(read('prisma/migrations/20261212000000_sod_contractor_verification/migration.sql').includes('IF NOT EXISTS "contractorVerifiedAt"'), 'the migration adds the columns safely');
    assert.ok(read('src/config/sidebar-menu.ts').includes('/contractor/verify-sods'), 'the contractor portal has the page in its menu');
});

test('the engineer dashboard shows the month-end pipeline by RTOM and the team of each RTOM', () => {
    const svc = read('src/services/service-order/area-pipeline.service.ts');
    assert.ok(svc.includes('resolveOpmcScope') && svc.includes('SOD_PAT_OK') && svc.includes('contractorVerifiedAt') && svc.includes("action: 'CONFIRMED'"), 'the pipeline is limited to the area and reads the check, the contractor verification and who checked');
    assert.ok(svc.includes('AREA_COORDINATOR') && svc.includes('QC_OFFICER') && svc.includes('accessibleOpmcs'), 'the team of an RTOM is the Area Coordinators and QC Officers given that RTOM');
    assert.ok(read('src/app/api/service-orders/area-pipeline/route.ts').includes('RBAC_PERMISSIONS.SOD_INVOICE'), 'the pipeline API needs the invoicing capability');
    const page = read('src/app/dashboard/page.tsx');
    assert.ok(page.includes('isEngineerView') && page.includes('EngineerPipelineSection') && page.includes('!landedOnWork && !hasMyWork'), 'the engineer lands on the work tab with the pipeline');
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
