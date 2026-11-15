import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAYMENT_CATEGORIES, categoryOfSupplierInvoice, defaultWhtFor, isServiceCategory, requestBlocker } from '../../src/config/payment-categories';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('categories: services are rent, vehicle hire and other services; goods and contractors are not', () => {
  assert.equal(isServiceCategory('SITE_OFFICE_RENT'), true);
  assert.equal(isServiceCategory('VEHICLE_RENTAL'), true);
  assert.equal(isServiceCategory('OTHER_SERVICE'), true);
  assert.equal(isServiceCategory('VENDOR_GOODS'), false);
  assert.equal(categoryOfSupplierInvoice('PO_GOODS'), 'VENDOR_GOODS');
  assert.equal(categoryOfSupplierInvoice(null), 'VENDOR_GOODS');
  assert.equal(categoryOfSupplierInvoice('SITE_OFFICE_RENT'), 'SITE_OFFICE_RENT');
  assert.ok(PAYMENT_CATEGORIES.SITE_OFFICE_RENT.expenseAccount && PAYMENT_CATEGORIES.VEHICLE_RENTAL.expenseAccount);
});

test('withholding default follows the category and rounds to cents', () => {
  assert.equal(defaultWhtFor('SITE_OFFICE_RENT', 100000), 10000);
  assert.equal(defaultWhtFor('VEHICLE_RENTAL', 33333.33), 1666.67);
  assert.equal(defaultWhtFor('PROJECT_CONTRACTOR', 100000), 0);
});

test('request conditions: partial allowed, never above what is payable, retention only for project contractors', () => {
  assert.equal(requestBlocker('SITE_OFFICE_RENT', { amount: 40000, payable: 100000 }), null, 'part of a rent invoice');
  assert.equal(requestBlocker('SITE_OFFICE_RENT', { amount: 100000.01, payable: 100000 }), 'AMOUNT_EXCEEDS_WHAT_IS_STILL_PAYABLE');
  assert.equal(requestBlocker('VEHICLE_RENTAL', { amount: 0, payable: 100 }), 'AMOUNT_MUST_BE_POSITIVE');
  assert.equal(requestBlocker('VEHICLE_RENTAL', { amount: 10.005, payable: 100 }), 'AMOUNT_MUST_HAVE_AT_MOST_TWO_DECIMALS');
  assert.equal(requestBlocker('VEHICLE_RENTAL', { amount: 100, payable: 1000, retention: 10 }), 'RETENTION_NOT_ALLOWED_FOR_THIS_CATEGORY');
  assert.equal(requestBlocker('PROJECT_CONTRACTOR', { amount: 100, payable: 1000, retention: 10 }), null);
  assert.equal(requestBlocker('SOD_CONTRACTOR', { amount: 100, payable: 1000, retention: 10 }), 'RETENTION_NOT_ALLOWED_FOR_THIS_CATEGORY');
  assert.equal(requestBlocker('VENDOR_GOODS', { amount: 100, payable: 1000, taxWithheld: 100 }), 'DEDUCTIONS_MUST_BE_BELOW_THE_AMOUNT');
});

test('wiring: service invoices, bulk run, approval limit, migration and menu', () => {
  const si = read('src/services/procurement/supplier-invoice.service.ts');
  assert.match(si, /static async createService/);
  assert.match(si, /matchStatus: 'NOT_APPLICABLE'/);
  assert.match(si, /invoice\.category !== 'PO_GOODS'\) return this\.approveService/);
  assert.match(si, /SEGREGATION_OF_DUTIES_VIOLATION/);
  assert.match(si, /ApprovalLimitService\.assertCanApprove/);
  assert.match(si, /accountCode: ACCOUNTS\.AP_VENDOR, debit: 0, credit: total/);
  const run = read('src/services/finance/ho-run.service.ts');
  assert.match(run, /requestBlocker\(/);
  assert.match(run, /results\.push\(\{ kind: item\.kind, id: item\.id, label, ok: false/);
  const route = read('src/app/api/finance/ho/run/route.ts');
  assert.match(route, /FINANCE_HO_SUBMIT/);
  assert.match(route, /FINANCE_APPROVE/);
  assert.match(read('src/services/finance/payment-voucher.service.ts'), /ApprovalLimitService\.assertCanApprove\(userId, Number\(existing\.netAmount\), 'PAYMENT_VOUCHER'/);
  const mig = read('prisma/migrations/20261202000000_service_payables/migration.sql');
  assert.match(mig, /"sourceType", "sourceId", "periodMonth"/);
  assert.match(mig, /"poItemId" DROP NOT NULL/);
  assert.match(read('src/config/sidebar-menu.ts'), /\/finance\/ho-run/);
  assert.match(read('src/services/finance/service-payable-generator.service.ts'), /LINK_THE_LANDLORD_TO_A_VENDOR_FIRST/);
});
