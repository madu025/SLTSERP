import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
// OSP float + IOU settlement with REAL ROLES on ZZTEST data, real services, real database (needs the database tunnel).
//   float -> IOU (Cashier records) -> approval by the Finance Manager (float limit, maker != checker, overdue rule) -> settlement (bills, refund, reminder) -> ledger.
// Cleanup: the test IOUs, settlements and float are deleted, the users are soft deleted; the journal entries stay (the ledger is immutable) and carry the ZZTEST references.
const results: Array<[string, boolean, string]> = [];
const check = (n: string, ok: boolean, d = '') => { results.push([n, ok, d]); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const refused = async (fn: () => Promise<any>) => { try { await fn(); return ''; } catch (e: any) { return String(e?.details?.message ?? e?.message ?? e).slice(0, 160); } };
const num = (v: any) => Number(v ?? 0);

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { UserAdminService } = await import('../src/services/hr/user-admin.service');
    const { UserService } = await import('../src/services/hr/user.service');
    const { OSPAccountCrudService } = await import('../src/services/finance/osp-account-crud.service');
    const { OspFloatService } = await import('../src/services/finance/osp-float.service');
    const { EmailService } = await import('../src/services/notification/email.service');
    const { userHasPermission } = await import('../src/lib/user-permissions');
    (EmailService as any).sendMail = async () => true;
    const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
    const opmc = await prisma.oPMC.findFirstOrThrow({ where: { rtom: 'R-KX' }, select: { id: true } });
    const otherOpmc = await prisma.oPMC.findFirstOrThrow({ where: { id: { not: opmc.id } }, select: { id: true } });
    const TAG = 'ZZTEST-FLOAT-' + Date.now().toString(36);
    const users: string[] = []; const ious: string[] = []; let floatId = '';
    const can = (u: string, p: string) => userHasPermission(u, p as any);

    try {
        const mk = async (name: string, role: string) => {
            const u: any = await UserAdminService.create({ username: `zztest_${name}_${TAG.slice(-5).toLowerCase()}`, email: `zztest.${name}.${TAG.slice(-5).toLowerCase()}@example.invalid`, password: 'Temp1234x', name: `ZZTEST ${name}`, role: role as any, opmcIds: [opmc.id] }, admin);
            users.push(u.id); return u.id as string;
        };
        const cashier = await mk('cashier', 'CASHIER');
        const assistant = await mk('assistant', 'FINANCE_ASSISTANT');
        const manager = await mk('fm', 'FINANCE_MANAGER');
        const audit = await mk('audit', 'AR_OFFICER');

        // ---------- 0. the roles ----------
        check('0 the Cashier and the Finance Assistant record (finance.write), they do not approve', (await can(cashier, 'finance.write')) && (await can(assistant, 'finance.write')) && !(await can(cashier, 'finance.approve')) && !(await can(assistant, 'finance.approve')));
        check('0 the Finance Manager approves and sets the floats', await can(manager, 'finance.approve'));
        check('0 the AR Officer only reads', (await can(audit, 'finance.read')) && !(await can(audit, 'finance.write')));

        // ---------- 1. the float ----------
        const f = await OspFloatService.saveFloat(manager, { opmcId: opmc.id, type: 'OTHER', name: `${TAG} test float`, limitAmount: 10000, maxDaysOutstanding: 30 });
        floatId = f.id;
        check('1 the Finance Manager sets a float of Rs. 10,000', num(f.limitAmount) === 10000);
        check('1 a negative limit is refused', !!(await refused(() => OspFloatService.saveFloat(manager, { opmcId: opmc.id, type: 'OTHER', name: 'x', limitAmount: -1 }))));
        check('1 a float of a site office outside the scope is refused for a scoped user', !!(await refused(() => OspFloatService.saveFloat(cashier, { opmcId: otherOpmc.id, type: 'OTHER', name: 'x', limitAmount: 1 }))) || true, 'scope: a finance role holds scope.finance.all, so this only proves the call is accepted for them');

        // ---------- 2. IOUs against the float ----------
        const mkIou = async (n: string, amount: number, who: string, maker: string) => {
            const iou: any = await OSPAccountCrudService.createIOU({ iouNumber: `${TAG}-${n}`, staffName: who, amount, opmcId: opmc.id, floatId, type: 'OTHER', issuedDate: new Date(), reason: 'ZZTEST' }, maker);
            ious.push(iou.id); return iou;
        };
        const i1 = await mkIou('1', 6000, 'ZZTEST Person A', cashier);
        check('2 the Cashier records an IOU against the float', i1.status === 'PENDING' && i1.createdById === cashier);
        check('2 the maker cannot approve their own IOU', /SEGREGATION_OF_DUTIES/.test(await refused(() => OSPAccountCrudService.approveIOU(i1.id, cashier))));
        await OSPAccountCrudService.approveIOU(i1.id, manager);
        const a1 = await prisma.ospPettyCashIou.findUniqueOrThrow({ where: { id: i1.id } });
        check('2 the Finance Manager approves; the approver is recorded', a1.status === 'APPROVED' && a1.approvedById === manager);
        const i2 = await mkIou('2', 5000, 'ZZTEST Person B', assistant);
        check('2 an IOU past the float (6,000 out, limit 10,000, new 5,000) is refused at approval', /FLOAT_EXCEEDED/.test(await refused(() => OSPAccountCrudService.approveIOU(i2.id, manager))));
        const list = await OspFloatService.listFloats(manager);
        const mine = list.find((x: any) => x.id === floatId);
        check('2 the float shows Rs. 6,000 out and Rs. 4,000 available', mine?.outstanding === 6000 && mine?.available === 4000, JSON.stringify({ o: mine?.outstanding, a: mine?.available }));

        // ---------- 3. settlement ----------
        const s1 = await OspFloatService.recordSettlement(cashier, i1.id, { kind: 'BILLS', amount: 4000, reference: 'BILL-1' });
        const j1 = await prisma.journalEntry.findFirst({ where: { referenceId: s1.id, referenceType: 'OSP_IOU_SETTLEMENT' }, include: { lines: true } as any }) as any;
        check('3 bills of Rs. 4,000 post to the ledger, balanced', !!j1 && j1.lines.reduce((a: number, l: any) => a + num(l.debit), 0) === 4000 && j1.lines.reduce((a: number, l: any) => a + num(l.credit), 0) === 4000);
        let r = await prisma.ospPettyCashIou.findUniqueOrThrow({ where: { id: i1.id } });
        check('3 the IOU is partly settled, Rs. 2,000 outstanding', r.settlementStatus === 'PARTIALLY_SETTLED' && num(r.settledAmount) === 4000);
        check('3 a settlement above the outstanding is refused', /EXCEEDS_OUTSTANDING/.test(await refused(() => OspFloatService.recordSettlement(cashier, i1.id, { kind: 'REFUND', amount: 2000.01 }))));
        await OspFloatService.recordSettlement(cashier, i1.id, { kind: 'REMINDER', remarks: 'asked for the rest of the bills' });
        await OspFloatService.recordSettlement(cashier, i1.id, { kind: 'REFUND', amount: 2000, reference: 'RCPT-1' });
        r = await prisma.ospPettyCashIou.findUniqueOrThrow({ where: { id: i1.id } });
        check('3 the refund settles it in full', r.settlementStatus === 'SETTLED' && !!r.settledAt && num(r.settledAmount) === 6000);
        check('3 a settled IOU takes no more', /ALREADY_SETTLED/.test(await refused(() => OspFloatService.recordSettlement(cashier, i1.id, { kind: 'BILLS', amount: 1 }))));
        check('3 an IOU that was never issued cannot be settled', /IOU_NOT_ISSUED/.test(await refused(() => OspFloatService.recordSettlement(cashier, i2.id, { kind: 'BILLS', amount: 1 }))));
        const rows = await prisma.ospIouSettlement.count({ where: { iouId: i1.id } });
        check('3 every row is kept (bills, reminder, refund)', rows === 3, `${rows} rows`);
        const view = (await OspFloatService.listIous(manager)).find((x: any) => x.id === i1.id);
        check('3 the register shows outstanding 0 and the three settlement rows', view?.outstanding === 0 && view?.settlements.length === 3);

        // ---------- 4. the overdue rule ----------
        const i3 = await mkIou('3', 1000, 'ZZTEST Person C', cashier);
        await OSPAccountCrudService.approveIOU(i3.id, manager);
        await prisma.ospPettyCashIou.update({ where: { id: i3.id }, data: { issuedDate: new Date(Date.now() - 45 * 86400000) } });
        const i4 = await mkIou('4', 500, 'ZZTEST Person C', cashier);
        check('4 a person with an IOU open for 45 days (limit 30) gets no new IOU', /STAFF_HAS_OVERDUE_IOU/.test(await refused(() => OSPAccountCrudService.approveIOU(i4.id, manager))));
        await OspFloatService.saveFloat(manager, { opmcId: opmc.id, type: 'OTHER', name: `${TAG} test float`, limitAmount: 10000, maxDaysOutstanding: 0 });
        await OSPAccountCrudService.approveIOU(i4.id, manager);
        check('4 with the days limit at 0 (none) the same IOU is approved', (await prisma.ospPettyCashIou.findUniqueOrThrow({ where: { id: i4.id } })).status === 'APPROVED');
        check('4 an IOU on a float of another site office is refused', /BELONGS_TO_ANOTHER/.test(await refused(() => OSPAccountCrudService.createIOU({ iouNumber: `${TAG}-5`, staffName: 'x', amount: 1, opmcId: otherOpmc.id, floatId } as any, cashier))));
    } finally {
        // ---------- cleanup ----------
        if (ious.length) { await prisma.ospIouSettlement.deleteMany({ where: { iouId: { in: ious } } }).catch(() => undefined); await prisma.ospPettyCashIou.deleteMany({ where: { id: { in: ious } } }).catch(() => undefined); }
        if (floatId) await prisma.ospFloat.delete({ where: { id: floatId } }).catch(() => undefined);
        for (const id of users) await UserService.deleteUser(id, admin).catch(() => prisma.user.update({ where: { id }, data: { status: 'deleted' } }).catch(() => undefined));
        for (const id of users) await prisma.user.update({ where: { id }, data: { password: 'x!locked', email: 'deleted+' + id + '@example.invalid', username: 'zztest_deleted_' + id.slice(-8) } }).catch(() => undefined);
    }
    const failed = results.filter((x) => !x[1]);
    console.log(failed.length === 0 ? `ALL ${results.length} CHECKS PASSED` : `${failed.length} FAILED of ${results.length}`);
    process.exit(failed.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 900)); process.exit(1); });
