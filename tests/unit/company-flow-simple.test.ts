import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RBAC_PERMISSION_DEFINITIONS, RETIRED_PERMISSION_CODES } from '../../src/config/rbac-permissions';

/**
 * The simpler company flow (owner, 26 Nov 2026). Approvals signed on paper or given in the HO ERP are recorded, not repeated, in Nexus:
 *   request: Stores Officer -> Stores Manager -> OSP Manager -> Stores Manager "Documents submitted to Procurement" -> PO (ready for GRN by itself) -> GRN;
 *   voucher: Account Officer raises it -> "Signed by all three" with the scan -> documents sent -> HO Account Executive receives them -> HO payments.
 */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATION = 'prisma/migrations/20261228000000_simple_company_flow/migration.sql';

test('request: no Head of Section step; the gate is switched off, not deleted; waiting requests move on', () => {
    const sql = read(MIGRATION);
    assert.match(sql, /SET "toStatus" = 'PROCUREMENT', "label" = '3\. OSP Manager Approval', "notificationAudience" = 'STORES_MANAGERS'/);
    assert.match(sql, /SET "isEnabled" = false[\s\S]*"fromStatus" = 'HOS_APPROVAL'/);
    assert.match(sql, /WHERE "workflowStage" = 'HOS_APPROVAL' AND "status" = 'PENDING'/);
    assert.doesNotMatch(sql, /DELETE|DROP/);
    const seed = read('src/services/admin/process-gate.service.ts');
    assert.match(seed, /fromStatus: 'OSP_MANAGER_APPROVAL',[\s\S]{0,200}toStatus: 'PROCUREMENT'/, 'a fresh database gets the same chain');
});

test('request: the Stores Manager submits the documents before the PO; a fully ordered request is ready for GRN by itself', () => {
    const svc = read('src/services/inventory/stock-request.service.ts');
    assert.match(svc, /where: \{ id: requestId, workflowStage: 'PROCUREMENT', procurementDocsSubmittedAt: null \}/);
    assert.match(svc, /audience: 'PROCESS_GATE_PROCUREMENT'[\s\S]{0,200}Material request documents submitted: record the PO/, 'Procurement is told');
    assert.match(svc, /if \(fullyOrdered\) return this\.handleProcurementComplete/);
    assert.match(svc, /audience: 'STORES_MANAGERS'[\s\S]{0,200}ready for GRN/, 'the Stores Manager is told to receive');
    assert.match(read('src/lib/inventory-stock-request-permissions.ts'), /DOCS_SUBMITTED: RBAC_PERMISSIONS\.INVENTORY_APPROVE/);
    assert.match(read('src/services/procurement/purchase-order.service.ts'), /PROCUREMENT_DOCUMENTS_NOT_SUBMITTED/, 'no PO before the documents');
    const orders = read('src/app/procurement/orders/page.tsx');
    assert.doesNotMatch(orders, /newStatus: "PO_SENT"|newStatus: "PO_CONFIRMED"/, 'no Sent / Confirm clicks');
    assert.match(orders, /data-testid="po-wait-docs"/);
    assert.match(read('src/app/inventory/requests/page.tsx'), /data-testid="req-docs-submitted"/);
});

test('voucher: signed on paper and recorded with the scan by the Account Officer; the invoice is posted with it', () => {
    const chain = read('src/services/finance/pv-chain.service.ts');
    assert.match(chain, /export type PvChainAction = 'SIGNED' \| 'NOT_SIGNED' \| 'DOCS_SENT' \| 'DOCS_RECEIVED' \| 'DOCS_NOT_RECEIVED';/);
    assert.match(chain, /SIGNED_VOUCHER_SCAN_REQUIRED/);
    assert.match(chain, /data: \{ status: 'APPROVED', approvalStage: null, approvedById: userId, approvedAt: new Date\(\), docsStatus: 'TO_SEND', signedVoucherUrl: url/);
    assert.match(chain, /status: 'DRAFT', approvalStage: null, approvalTrail: \[\.\.\.trail, entry\('SIGNATURES', 'NOT_SIGNED'/, 'not signed: back to draft');
    assert.doesNotMatch(chain, /accountManagerStep|PV_STAGES|FINANCE_PV_APPROVE/);
    const pv = read('src/services/finance/payment-voucher.service.ts');
    assert.match(pv, /updateData\.approvalStage = 'SIGNATURES';/);
    assert.match(pv, /VENDOR_VOUCHER_SIGNATURES_STEP/, 'a company voucher is not approved on Payment requests to HO');
    assert.match(read(MIGRATION), /SET "approvalStage" = 'SIGNATURES'/, 'vouchers waiting in the former steps wait for the signatures');
});

test('voucher: the HO Account Executive receives the documents (HO Invoice Section); the maker cannot', () => {
    const chain = read('src/services/finance/pv-chain.service.ts');
    assert.match(chain, /can\(RBAC_PERMISSIONS\.PROCUREMENT_HO_PAYMENT_RECORD\)/);
    assert.match(chain, /pv\.createdById === userId\) throw AppError\.badRequest\('SEGREGATION_OF_DUTIES_VIOLATION/);
    assert.match(chain, /status: 'SUBMITTED_TO_HO', submittedToHoById: userId, submittedToHoAt: new Date\(\), docsStatus: 'RECEIVED'/);
    assert.match(read('src/app/api/procurement/payment-approvals/route.ts'), /const STEP_HOLDERS = \[RBAC_PERMISSIONS\.FINANCE_WRITE, RBAC_PERMISSIONS\.PROCUREMENT_HO_PAYMENT_RECORD\];/);
});

test('retired capabilities are never in the catalog, and the deploy seed switches them off and removes their grants (found after the deploy)', () => {
    const codes = new Set(RBAC_PERMISSION_DEFINITIONS.map((p) => p.code as string));
    for (const c of RETIRED_PERMISSION_CODES) assert.ok(!codes.has(c), `${c} is retired, so it is not in the catalog`);
    const seed = read('scripts/seed-rbac-capabilities.ts');
    assert.match(seed, /prisma\.rolePermission\.deleteMany\(\{ where: \{ permission: \{ in: \[\.\.\.RETIRED_PERMISSION_CODES\] \} \} \}\)/);
    assert.match(seed, /prisma\.permissionDefinition\.updateMany\(\{ where: \{ code: \{ in: \[\.\.\.RETIRED_PERMISSION_CODES\] \}, isActive: true \}, data: \{ isActive: false \} \}\)/);
});

test('a GRN of a PO recorded with its payment terms needs the Oracle GRN number and the vendor invoice, and creates the invoice (found by the browser QA)', () => {
    const grn = read('src/services/inventory/grn.service.ts');
    assert.ok(grn.includes('if (po.hoApprovalRef || po.paymentBasis) {'), 'the HO reference was removed from the PO form, so the payment terms mark an HO order');
    assert.ok(grn.includes('OR: [{ hoApprovalRef: { not: null } }, { paymentBasis: { not: null } }]'));
});

test('the capabilities of the removed steps are gone', () => {
    const codes = RBAC_PERMISSION_DEFINITIONS.map((p) => p.code as string);
    for (const c of ['finance.pv.approve.account', 'finance.pv.approve.osp', 'finance.pv.approve.hos', 'procurement.pv.documents', 'notification.audience.pv-account-managers']) {
        assert.ok(!codes.includes(c), `${c} is gone`);
    }
});

test('signatures: only a stored scan is accepted, and a mismatched invoice is approved by a finance approver, not by the voucher maker (security review)', () => {
    const chain = read('src/services/finance/pv-chain.service.ts');
    assert.ok(chain.includes('if (!/^\\/api\\/(storage|files)\\/[^/]/.test(url))'), 'no outside or protocol-relative link');
    assert.match(chain, /INVOICE_VARIANCE_NEEDS_FINANCE_APPROVAL/);
    assert.match(chain, /if \(si\.status === 'MATCHED'\) await SupplierInvoiceService\.approve\(si\.id, userId, null, \{ viaVoucherChain: true \}\)/, 'no override reason through the signatures step');
    assert.doesNotMatch(read('src/app/api/procurement/payment-approvals/route.ts'), /matchOverrideReason/);
    // found by the browser QA: the upload API refused the bucket the page asked for
    const bucket = /fd\.append\("bucket", "([^"]+)"\)/.exec(read('src/app/procurement/payment-approvals/page.tsx'))?.[1];
    assert.ok(bucket && read('src/app/api/upload/route.ts').includes(`'${bucket}'`), `the signed voucher goes to an allowed upload bucket (${bucket})`);
});
