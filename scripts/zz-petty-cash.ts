import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
// The petty cash box of a site office with REAL ROLES on ZZTEST data (needs the database tunnel):
//   box with no cash -> Head Office funds the float -> IOU draws cash from the box -> settlement (bills + refund) -> bills of the box -> cancel -> replenishment -> imprest adds up.
// Cleanup: the test box, floats, IOUs, bills, claims and funding requests are deleted, users soft deleted; the journal entries stay (immutable ledger).
const results: Array<[string, boolean, string]> = [];
const check = (n: string, ok: boolean, d = '') => { results.push([n, ok, d]); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const refused = async (fn: () => Promise<any>) => { try { await fn(); return ''; } catch (e: any) { return String(e?.details?.message ?? e?.message ?? e).slice(0, 170); } };
const num = (v: any) => Number(v ?? 0);

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { PettyCashService } = await import('../src/services/finance/petty-cash.service');
    const { OspFloatService } = await import('../src/services/finance/osp-float.service');
    const { OSPAccountCrudService } = await import('../src/services/finance/osp-account-crud.service');
    const { HoFundingService } = await import('../src/services/finance/ho-funding.service');
    const { EmailService } = await import('../src/services/notification/email.service');
    const { userHasPermission } = await import('../src/lib/user-permissions');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true, rtom: true } });
    const TAG = 'ZZTEST-PC-' + Date.now().toString(36);
    // the site office is a store; it covers more than one RTOM
    const other = await prisma.oPMC.findFirstOrThrow({ where: { id: { not: opmc.id } }, select: { id: true } });
    const office = await prisma.inventoryStore.create({ data: { name: `${TAG} Store`, type: 'SUB', location: 'ZZTEST', opmcs: { connect: [{ id: opmc.id }, { id: other.id }] } } });
    const users: string[] = []; let boxId = ''; let floatId = '';
    const iouIds: string[] = []; const fundingIds: string[] = []; let transitId = '';

    try {
        const mk = async (name: string, role: string, extra: Record<string, unknown> = {}) => {
            const u: any = await UserAdminService.create({ username: `zztest_${name}_${TAG.slice(-5).toLowerCase()}`, email: `zztest.${name}.${TAG.slice(-5).toLowerCase()}@example.invalid`, password: 'Temp1234x', name: `ZZTEST ${name}`, role: role as any, opmcIds: [opmc.id], ...extra } as any, admin);
            users.push(u.id); return u.id as string;
        };
        const cashier = await mk('cashier', 'CASHIER');
        const assistant = await mk('assistant', 'FINANCE_ASSISTANT');
        const fm = await mk('fm', 'FINANCE_MANAGER');
        // the Area Manager is registered with the site offices they cover; the site office then knows its ARM
        const arm = await mk('arm', 'AREA_MANAGER', { siteOfficeIds: [office.id] });
        const custodian = await mk('custodian', 'SITE_OFFICE_STAFF', { assignedStoreId: office.id });
        const outsider = await mk('outsider', 'SITE_OFFICE_STAFF');
        const noAccess = await mk('noaccess', 'STORES_ASSISTANT', { assignedStoreId: office.id });
        check('0 registering the Area Manager with a site office makes them its ARM', (await prisma.inventoryStore.findUniqueOrThrow({ where: { id: office.id } })).areaManagerId === arm);
        check('0 a second Area Manager cannot take a site office that has one', /SITE_OFFICE_HAS_ANOTHER_AREA_MANAGER/.test(await refused(() => mk('arm2', 'AREA_MANAGER', { siteOfficeIds: [office.id] }))));
        check('0 the capability petty-cash.site is held by the custodian role and the Area Manager, not by a stores assistant', (await userHasPermission(custodian, 'petty-cash.site' as any)) && (await userHasPermission(arm, 'petty-cash.site' as any)) && !(await userHasPermission(noAccess, 'petty-cash.site' as any)));
        const summary = async () => (await PettyCashService.getSummaries(fm)).find((s: any) => s.id === boxId)!;

        // ---------- 1. the box ----------
        check('1 an opening balance above the limit is refused', /INVALID_OPENING_BALANCE/.test(await refused(() => PettyCashService.createPettyCashAccount({ name: `${TAG} box`, siteOfficeId: office.id, imprestLimit: 100000, openingBalance: 100001, createdById: fm }))));
        const box = await PettyCashService.createPettyCashAccount({ name: `${TAG} box`, siteOfficeId: office.id, imprestLimit: 100000, createdById: fm });
        boxId = box.id;
        check('1 a new box starts empty (the float comes from Head Office, not from nowhere)', num(box.currentBalance) === 0);

        check('1 one box for each site office: a second box for the same site office is refused', /ALREADY_EXISTS_FOR_SITE_OFFICE/.test(await refused(() => PettyCashService.createPettyCashAccount({ name: `${TAG} box 2`, siteOfficeId: office.id, imprestLimit: 5000, createdById: fm }))));
        check('1 a transit store is not a site office', /SITE_OFFICE_NOT_FOUND/.test(await refused(async () => { const t = await prisma.inventoryStore.create({ data: { name: `${TAG} Transit`, type: 'TRANSIT', location: 'ZZTEST' } }); transitId = t.id; await PettyCashService.createPettyCashAccount({ name: 'x', siteOfficeId: t.id, imprestLimit: 5000, createdById: fm }); })));
        check('1 the box is shown under its site office name', (await PettyCashService.getSummaries(fm)).find((x: any) => x.id === boxId)?.site === `${TAG} Store`);

        // custodians
        check('1 a role without petty cash access cannot be made a custodian', /USER_HAS_NO_PETTY_CASH_ACCESS/.test(await refused(() => PettyCashService.setCustodians(boxId, [noAccess], fm))));
        const set = await PettyCashService.setCustodians(boxId, [custodian], fm);
        check('1 the finance approver names the custodian; the people of the site office are offered', set.custodians.length === 1 && set.candidates.some((c: any) => c.id === custodian && c.hasAccess) && set.candidates.some((c: any) => c.id === noAccess && !c.hasAccess));
        const mine = async (u: string) => (await PettyCashService.getSummaries(u)).find((x: any) => x.id === boxId);
        check('1 the custodian and the Area Manager see the box and know their part; an outsider does not see it', !!(await mine(custodian))?.me.isCustodian && !!(await mine(arm))?.me.isAreaManager && !(await mine(outsider)));
        check('1 the box shows its Area Manager and its custodian', (await mine(fm))?.areaManager?.id === arm && (await mine(fm))?.custodians[0]?.id === custodian);

        // ---------- 2. Head Office funds the float ----------
        const req = await HoFundingService.create(assistant, { purpose: 'PETTY_CASH_FLOAT', requestedAmount: 100000, pettyCashAccountId: boxId, remarks: TAG });
        fundingIds.push(req.id);
        check('2 a float for more than the limit is refused', !!(await refused(() => HoFundingService.create(assistant, { purpose: 'PETTY_CASH_FLOAT', requestedAmount: 100001, pettyCashAccountId: boxId }))));
        await HoFundingService.submit(req.id, assistant);
        await HoFundingService.approve(req.id, fm, 100000);
        check('2 the requester cannot confirm their own funding', /REQUESTER_CANNOT_CONFIRM/.test(await refused(() => HoFundingService.fund(req.id, assistant, { hoReference: 'HO-REF-1', fundedDate: '2026-11-24' }))));
        await HoFundingService.fund(req.id, fm, { hoReference: `${TAG}-HO-1`, fundedDate: '2026-11-24' });
        let s = await summary();
        check('2 after Head Office funds it the box holds Rs. 100,000', s.cashInHand === 100000 && s.unaccounted === 0, JSON.stringify({ c: s.cashInHand, u: s.unaccounted }));

        // ---------- 3. an IOU draws cash from the box ----------
        const fl = await OspFloatService.saveFloat(fm, { siteOfficeId: office.id, type: 'PETTY_CASH', name: `${TAG} petty cash`, limitAmount: 100000, maxDaysOutstanding: 0 });
        floatId = fl.id;
        const mkIou = async (n: string, amount: number, who: string, maker: string) => { const i: any = await OSPAccountCrudService.createIOU({ iouNumber: `${TAG}-${n}`, staffName: who, amount, siteOfficeId: office.id, floatId, issuedDate: new Date(), reason: 'ZZTEST' }, maker); iouIds.push(i.id); return i; };
        const i1 = await mkIou('1', 30000, 'ZZTEST Person A', cashier);
        check('3 the Finance Manager has no step in releasing the cash of a site office box', /NOT_THE_AREA_MANAGER/.test(await refused(() => OSPAccountCrudService.approveIOU(i1.id, fm))));
        await OSPAccountCrudService.approveIOU(i1.id, arm);
        const a1 = await prisma.ospPettyCashIou.findUniqueOrThrow({ where: { id: i1.id } });
        s = await summary();
        check('3 the IOU is drawn from the box: Rs. 70,000 in hand, Rs. 30,000 out on the IOU', a1.pettyCashAccountId === boxId && s.cashInHand === 70000 && s.iouOut === 30000 && s.unaccounted === 0, JSON.stringify({ c: s.cashInHand, o: s.iouOut, u: s.unaccounted }));
        const issue = await prisma.journalEntry.findFirst({ where: { referenceId: i1.id, referenceType: 'OSP_IOU' }, include: { lines: true } as any }) as any;
        check('3 the issue is booked Dr Advances / Cr Petty cash, balanced', !!issue && issue.lines.length === 2 && issue.lines.some((l: any) => l.accountCode === 'PETTY-1020' && num(l.credit) === 30000));
        await OspFloatService.saveFloat(fm, { siteOfficeId: office.id, type: 'PETTY_CASH', name: `${TAG} petty cash`, limitAmount: 500000, maxDaysOutstanding: 0 });
        const i2 = await mkIou('2', 80000, 'ZZTEST Person B', cashier);
        check('3 an IOU for more cash than the box holds is refused', /INSUFFICIENT_PETTY_CASH_BALANCE/.test(await refused(() => OSPAccountCrudService.approveIOU(i2.id, arm))));
        check('3 a refused IOU is still pending and takes nothing', (await summary()).cashInHand === 70000 && (await prisma.ospPettyCashIou.findUniqueOrThrow({ where: { id: i2.id } })).status === 'PENDING');
        check('3 only the Area Manager rejects a release', /NOT_THE_AREA_MANAGER/.test(await refused(() => OSPAccountCrudService.rejectIOU(i2.id, 'ZZTEST', fm))));
        await OSPAccountCrudService.rejectIOU(i2.id, 'ZZTEST', arm);
        check('3 a rejected IOU cannot be approved later', /INVALID_STATE/.test(await refused(() => OSPAccountCrudService.approveIOU(i2.id, arm))));

        // ---------- 4. settlement through the box ----------
        await OspFloatService.recordSettlement(cashier, i1.id, { kind: 'BILLS', amount: 18000, reference: 'BILL-1' });
        const voucher = await prisma.pettyCashVoucher.findFirst({ where: { iouId: i1.id } });
        s = await summary();
        check('4 bills of Rs. 18,000 become an approved bill of the box, linked to the IOU', voucher?.status === 'APPROVED' && num(voucher?.amount) === 18000);
        check('4 the box does not pay twice: cash in hand stays Rs. 70,000, bills waiting Rs. 18,000, IOU out Rs. 12,000, adds up', s.cashInHand === 70000 && s.billsWaiting === 18000 && s.iouOut === 12000 && s.unaccounted === 0, JSON.stringify({ c: s.cashInHand, b: s.billsWaiting, o: s.iouOut, u: s.unaccounted }));
        await OspFloatService.recordSettlement(cashier, i1.id, { kind: 'REFUND', amount: 12000, reference: 'RCPT-1' });
        s = await summary();
        check('4 the refund puts Rs. 12,000 back: Rs. 82,000 in hand, nothing out on IOUs, adds up', s.cashInHand === 82000 && s.iouOut === 0 && s.unaccounted === 0, JSON.stringify({ c: s.cashInHand, o: s.iouOut, u: s.unaccounted }));
        const refundJe = await prisma.journalEntry.findFirst({ where: { referenceType: 'OSP_IOU_SETTLEMENT', description: { contains: `${TAG}-1` }, AND: [{ description: { contains: 'Cash returned' } }] }, include: { lines: true } as any }) as any;
        check('4 the refund is booked Dr Petty cash (not the bank)', !!refundJe && refundJe.lines.some((l: any) => l.accountCode === 'PETTY-1020' && num(l.debit) === 12000));

        // ---------- 5. a bill of the box, cancel ----------
        check('5 a person who is not the custodian of the box cannot record a bill', !!(await refused(() => PettyCashService.createVoucher({ accountId: boxId, title: 'x', amount: 1, category: 'Other', createdById: outsider }))));
        check('5 the Area Manager does not record bills either', /NOT_A_CUSTODIAN/.test(await refused(() => PettyCashService.createVoucher({ accountId: boxId, title: 'x', amount: 1, category: 'Other', createdById: arm }))));
        const b1 = await PettyCashService.createVoucher({ accountId: boxId, title: `${TAG} bill 1`, amount: 5000, category: 'Stationery', createdById: custodian });
        check('5 a cancel needs a reason', /CANCEL_REASON_REQUIRED/.test(await refused(() => PettyCashService.cancelVoucher(b1.id, '', null, custodian))));
        const b2 = await PettyCashService.createVoucher({ accountId: boxId, title: `${TAG} bill 2`, amount: 4000, category: 'Stationery', createdById: custodian, receiptUrl: '/api/storage/documents/zztest-receipt.jpg' } as any);
        check('5 the receipt link is kept with the bill', b2.receiptUrl === '/api/storage/documents/zztest-receipt.jpg');
        const c1 = await PettyCashService.cancelVoucher(b1.id, 'The float was short that day', b2.voucherNumber, custodian);
        check('5 a draft bill is cancelled with the reason and the number it was carried to', c1.status === 'CANCELLED' && c1.carriedToNumber === b2.voucherNumber && !!c1.cancelledReason);
        check('5 a cancelled bill cannot be cancelled again', /VOUCHER_CANNOT_BE_CANCELLED/.test(await refused(() => PettyCashService.cancelVoucher(b1.id, 'again', null, custodian))));
        check('5 the person who recorded the bill cannot approve it', /NOT_THE_AREA_MANAGER|MAKER_CANNOT/.test(await refused(() => PettyCashService.approveVoucher(b2.id, custodian))));
        check('5 the Finance Manager does not approve the bills of a site office box', /NOT_THE_AREA_MANAGER/.test(await refused(() => PettyCashService.approveVoucher(b2.id, fm))));
        await PettyCashService.approveVoucher(b2.id, arm);
        check('5 an approved bill cannot be cancelled (it is in the books)', /VOUCHER_CANNOT_BE_CANCELLED/.test(await refused(() => PettyCashService.cancelVoucher(b2.id, 'too late', null, custodian))));
        s = await summary();
        check('5 after the bill: Rs. 78,000 in hand, Rs. 22,000 of bills waiting, adds up', s.cashInHand === 78000 && s.billsWaiting === 22000 && s.unaccounted === 0, JSON.stringify({ c: s.cashInHand, b: s.billsWaiting, u: s.unaccounted }));

        // ---------- 6. replenishment ----------
        check('6 a person outside the box cannot ask for the replenishment', !!(await refused(() => PettyCashService.requestReimbursement(boxId, outsider))));
        const claim = await PettyCashService.requestReimbursement(boxId, custodian);
        check('6 the claim asks for the bills waiting: Rs. 22,000', num(claim.totalAmount) === 22000);
        check('6 a second claim while one is pending is refused', /PENDING_REIMBURSEMENT_EXISTS/.test(await refused(() => PettyCashService.requestReimbursement(boxId, custodian))));
        const hf = await prisma.hoFundingRequest.findFirstOrThrow({ where: { reimbursementId: claim.id } });
        fundingIds.push(hf.id);
        await HoFundingService.approve(hf.id, fm, 22000);
        await HoFundingService.fund(hf.id, fm, { hoReference: `${TAG}-HO-2`, fundedDate: '2026-11-24' });
        s = await summary();
        check('6 Head Office replenishes: the box is whole again, no bills waiting, adds up', s.cashInHand === 100000 && s.billsWaiting === 0 && s.unaccounted === 0, JSON.stringify({ c: s.cashInHand, b: s.billsWaiting, u: s.unaccounted }));
        check('6 the bills are marked reimbursed', (await prisma.pettyCashVoucher.count({ where: { accountId: boxId, status: 'REIMBURSED' } })) === 2);
        check('6 a new claim with nothing waiting is refused', /NO_APPROVED_VOUCHERS/.test(await refused(() => PettyCashService.requestReimbursement(boxId, custodian))));

        // ---------- 7. a site office without an Area Manager releases nothing ----------
        const office2 = await prisma.inventoryStore.create({ data: { name: `${TAG} Store 2`, type: 'SUB', location: 'ZZTEST' } });
        const box2 = await PettyCashService.createPettyCashAccount({ name: `${TAG} box 2`, siteOfficeId: office2.id, imprestLimit: 10000, openingBalance: 10000, createdById: fm });
        const cust2 = await mk('cust2', 'SITE_OFFICE_STAFF', { assignedStoreId: office2.id });
        await PettyCashService.setCustodians(box2.id, [cust2], fm);
        const orphan = await PettyCashService.createVoucher({ accountId: box2.id, title: `${TAG} orphan`, amount: 100, category: 'Other', createdById: cust2 });
        check('7 a site office with no Area Manager releases nothing: the bill cannot be approved', /NO_AREA_MANAGER/.test(await refused(() => PettyCashService.approveVoucher(orphan.id, fm))));
        check('7 the custodian of one box cannot work another site office\'s box', !!(await refused(() => PettyCashService.createVoucher({ accountId: boxId, title: 'x', amount: 1, category: 'Other', createdById: cust2 }))));
        await prisma.pettyCashVoucher.deleteMany({ where: { accountId: box2.id } }).catch(() => undefined);
        await prisma.pettyCashCustodian.deleteMany({ where: { accountId: box2.id } }).catch(() => undefined);
        await prisma.pettyCashAccount.delete({ where: { id: box2.id } }).catch(() => undefined);
        await prisma.inventoryStore.delete({ where: { id: office2.id } }).catch(() => undefined);
    } finally {
        // ---------- cleanup ----------
        if (boxId) {
            await prisma.pettyCashCustodian.deleteMany({ where: { accountId: boxId } }).catch(() => undefined);
            await prisma.pettyCashVoucher.deleteMany({ where: { accountId: boxId } }).catch(() => undefined);
            await prisma.hoFundingRequest.deleteMany({ where: { OR: [{ id: { in: fundingIds } }, { pettyCashAccountId: boxId }] } }).catch(() => undefined);
            await prisma.pettyCashReimbursement.deleteMany({ where: { accountId: boxId } }).catch(() => undefined);
        }
        if (iouIds.length) { await prisma.ospIouSettlement.deleteMany({ where: { iouId: { in: iouIds } } }).catch(() => undefined); await prisma.ospPettyCashIou.deleteMany({ where: { id: { in: iouIds } } }).catch(() => undefined); }
        if (floatId) await prisma.ospFloat.delete({ where: { id: floatId } }).catch(() => undefined);
        if (boxId) await prisma.pettyCashAccount.delete({ where: { id: boxId } }).catch((e) => console.log('box not deleted:', String(e).slice(0, 120)));
        for (const sid of [office.id, transitId].filter(Boolean)) await prisma.inventoryStore.delete({ where: { id: sid } }).catch(() => prisma.inventoryStore.update({ where: { id: sid }, data: { type: 'SUB', name: `ZZTEST (closed) ${sid.slice(-6)}` } }).catch(() => undefined));
        for (const id of users) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of users) await prisma.user.update({ where: { id }, data: { password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
    }
    const failed = results.filter((x) => !x[1]);
    console.log(failed.length === 0 ? `ALL ${results.length} CHECKS PASSED` : `${failed.length} FAILED of ${results.length}`);
    process.exit(failed.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 900)); process.exit(1); });
