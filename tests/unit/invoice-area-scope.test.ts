/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma stubs verify the area scope of the contractor invoice pages. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { InvoiceService } from '../../src/services/invoice/invoice.service';
import { assertContractorInScope, assertInvoiceAccess, invoiceScopeWhere } from '../../src/lib/invoice-access';

const db = prisma as any;
const original = { user: db.user.findUnique, invoiceMany: db.invoice.findMany, invoiceOne: db.invoice.findUnique, contractor: db.contractor.findUnique };
afterEach(() => {
    db.user.findUnique = original.user; db.invoice.findMany = original.invoiceMany; db.invoice.findUnique = original.invoiceOne; db.contractor.findUnique = original.contractor;
});

const areaUser = () => { db.user.findUnique = async () => ({ permissions: JSON.stringify(['sod.invoice']), accessibleOpmcs: [{ id: 'opmc-1' }], systemRole: null, sectionAssignments: [] }); };
const companyWide = () => { db.user.findUnique = async () => ({ permissions: JSON.stringify(['sod.invoice', 'admin.rbac']), accessibleOpmcs: [], systemRole: null, sectionAssignments: [] }); };

test('a user limited to an area sees only the invoices of contractors in that area', async () => {
    areaUser();
    assert.deepEqual(await invoiceScopeWhere('u1'), { contractor: { opmcId: { in: ['opmc-1'] } } });
    let where: any;
    db.invoice.findMany = async (args: any) => { where = args.where; return []; };
    await InvoiceService.getInvoices({ status: 'PENDING' }, 'u1');
    assert.deepEqual(where.contractor, { opmcId: { in: ['opmc-1'] } });
    assert.equal(where.status, 'PENDING');
});

test('company-wide access sees all invoices, and no identity sees none', async () => {
    companyWide();
    assert.deepEqual(await invoiceScopeWhere('admin'), {});
    db.user.findUnique = async () => null;
    assert.deepEqual(await invoiceScopeWhere('ghost'), { contractor: { opmcId: { in: [] } } });
    assert.deepEqual(await invoiceScopeWhere(null), { contractor: { opmcId: { in: [] } } });
});

test('one invoice is reachable only when its contractor is inside the caller\'s area', async () => {
    areaUser();
    db.invoice.findUnique = async () => ({ contractor: { opmcId: 'opmc-1' } });
    await assertInvoiceAccess('inv-1', 'u1');
    db.invoice.findUnique = async () => ({ contractor: { opmcId: 'opmc-2' } });
    await assert.rejects(() => assertInvoiceAccess('inv-1', 'u1'), /outside your area/);
    db.invoice.findUnique = async () => ({ contractor: null });
    await assert.rejects(() => assertInvoiceAccess('inv-1', 'u1'), /outside your area/);
    db.invoice.findUnique = async () => null;
    await assert.rejects(() => assertInvoiceAccess('inv-1', 'u1'), /not found/i);
});

test('an invoice cannot be created for a contractor outside the caller\'s area', async () => {
    areaUser();
    db.contractor.findUnique = async () => ({ opmcId: 'opmc-1' });
    await assertContractorInScope('c1', 'u1');
    db.contractor.findUnique = async () => ({ opmcId: 'opmc-9' });
    await assert.rejects(() => assertContractorInScope('c1', 'u1'), /outside your area/);
});

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('wiring: every invoice page route hands the caller to the service, and the service checks the area first', () => {
    const svc = read('src/services/invoice/invoice.service.ts');
    for (const fn of ['getInvoiceDetails', 'updateInvoice', 'deleteInvoice', 'proposePenalty', 'deletePenalty', 'approveBySfAudit', 'createInvoice']) {
        const start = svc.indexOf(`static async ${fn}(`);
        assert.ok(start > 0, fn);
        assert.ok(/assert(Invoice|Contractor)(Access|InScope)\(/.test(svc.slice(start, start + 700)), `${fn} checks the area`);
    }
    assert.ok(svc.includes('invoiceScopeWhere(userId)'), 'the list is filtered');
    const list = read('src/app/api/invoices/route.ts');
    assert.ok(list.includes('params._userId'), 'the list route passes the caller');
    assert.ok(read('src/app/api/invoices/[id]/details/route.ts').includes('params._userId'));
    assert.ok(read('src/app/api/invoices/[id]/penalties/route.ts').includes('deletePenalty(id, penaltyId, params._userId)'));
    assert.ok(read('src/services/sf-audit/pricing-audit.service.ts').includes('await assertInvoiceAccess(invoiceId, userId)'));
});

test('wiring: contractor portal sign-in sets the cookies the middleware reads, and logout clears every copy', () => {
    const login = read('src/app/api/contractor-portal/auth/login/route.ts');
    assert.ok(login.includes("cookieStore.set('token', token"), 'sets the token cookie the middleware reads');
    assert.ok(login.includes("cookieStore.set('refresh_token', refreshToken"));
    assert.ok(read('src/middleware.ts').includes("request.cookies.get('token')"), 'the middleware still reads the token cookie');
    const logout = read('src/app/api/logout/route.ts');
    for (const name of ['token', 'refresh_token', 'contractor_token', 'contractor_refresh_token']) assert.ok(logout.includes(`'${name}'`), name);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
