import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
