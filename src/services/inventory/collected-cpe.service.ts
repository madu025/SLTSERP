import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { colomboMonth, SERIAL_NOT_CLEAR } from '@/lib/cpe-serial-rules';
import { AuditLedgerService } from './audit-ledger.service';
import { CpeSerialService } from './cpe-serial.service';
import { recordCpeEvent } from './cpe-serial-events';

const monthRange = (m: string) => {
    if (!/^\d{4}-\d{2}$/.test(m)) throw AppError.badRequest('Month must be YYYY-MM');
    const [y, mo] = m.split('-').map(Number);
    // Colombo month boundaries
    const from = new Date(Date.UTC(y, mo - 1, 1) - 5.5 * 3600_000);
    const to = new Date(Date.UTC(mo === 12 ? y + 1 : y, mo === 12 ? 0 : mo, 1) - 5.5 * 3600_000);
    return { from, to };
};

/**
 * Collected CPE (docs/plans/cpe-serial-locator.md section 7a): the old devices taken from customers (faulty, or replaced on an upgrade), listed
 * per RTOM, contractor and collection month for the Collected CPE Handing Over Form, and marked as handed over (CCF-YYYY-MM-NNNN). A service
 * order job: the Area Coordinator and the QC Officer (owner, 28 Nov 2026).
 */
export class CollectedCpeService {
    static async list(userId: string, f: { opmcId?: string; contractorId?: string; month?: string; status?: string }) {
        const scope = await CpeSerialService.scope(userId);
        if (f.opmcId) await CpeSerialService.assertRtom(userId, f.opmcId);
        const range = f.month ? monthRange(f.month) : null;
        const rows = await prisma.collectedCPE.findMany({
            where: {
                serviceOrder: { opmcId: f.opmcId ? f.opmcId : scope === undefined ? undefined : { in: scope } },
                ...(f.contractorId ? { contractorId: f.contractorId } : {}),
                ...(range ? { collectedDate: { gte: range.from, lt: range.to } } : {}),
                ...(f.status ? { status: f.status } : {}),
            },
            orderBy: [{ collectedDate: 'asc' }, { id: 'asc' }],
            take: 1000,
            select: {
                id: true, deviceType: true, serialNumber: true, serialUnreadable: true, condition: true, model: true, pstnNumber: true, status: true, collectedDate: true,
                handbackDate: true, handbackReference: true,
                contractor: { select: { id: true, name: true } },
                serviceOrder: { select: { soNum: true, voiceNumber: true, rtom: true, opmcId: true } },
                handoverForm: { select: { formNumber: true, handedOverDate: true } },
            },
        });
        return rows.map((r) => ({
            id: r.id, deviceType: r.deviceType, serialNumber: r.serialUnreadable ? SERIAL_NOT_CLEAR : r.serialNumber, serialUnreadable: r.serialUnreadable, condition: r.condition,
            model: r.model, pstnNumber: r.pstnNumber, status: r.status, collectedDate: r.collectedDate, month: colomboMonth(r.collectedDate),
            contractorId: r.contractor.id, contractor: r.contractor.name, soNum: r.serviceOrder.soNum, voiceNumber: r.serviceOrder.voiceNumber, rtom: r.serviceOrder.rtom,
            opmcId: r.serviceOrder.opmcId, formNumber: r.handoverForm?.formNumber ?? null, handedOverDate: r.handoverForm?.handedOverDate ?? r.handbackDate ?? null,
        }));
    }

    /**
     * Mark the devices of one contractor, one RTOM and one collection month as handed over on a Collected CPE Handing Over Form. Readable
     * serials that are in the CPE register become RETURNED_TO_SLT (SLT may issue them again later: a new cycle).
     */
    static async handover(input: { userId: string; opmcId: string; contractorId: string; month: string; ids: string[]; handedOverDate: string; reference?: string | null; scanUrl?: string | null }) {
        await CpeSerialService.assertRtom(input.userId, input.opmcId);
        const range = monthRange(input.month);
        const handedOverDate = new Date(`${input.handedOverDate.slice(0, 10)}T00:00:00+05:30`);
        if (Number.isNaN(handedOverDate.getTime())) throw AppError.badRequest('Enter the date the devices were handed over');
        if (handedOverDate.getTime() > Date.now() + 24 * 3600_000) throw AppError.badRequest('The handed-over date cannot be in the future');
        const ids = [...new Set(input.ids)];
        if (ids.length === 0) throw AppError.badRequest('Choose at least one device');
        const opmc = await prisma.oPMC.findUnique({ where: { id: input.opmcId }, select: { rtom: true } });
        if (!opmc) throw AppError.notFound('RTOM not found');

        const result = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "CollectedCPE" WHERE "id" = ANY(${ids}::uuid[]) FOR UPDATE`;
            const rows = await tx.collectedCPE.findMany({
                where: { id: { in: ids } },
                select: { id: true, serialNumber: true, serialUnreadable: true, status: true, handoverFormId: true, contractorId: true, collectedDate: true, serviceOrder: { select: { opmcId: true } } },
            });
            const wrong = rows.find((r) => r.status !== 'PENDING_HANDBACK' || r.handoverFormId || r.contractorId !== input.contractorId || r.serviceOrder.opmcId !== input.opmcId
                || r.collectedDate < range.from || r.collectedDate >= range.to);
            if (rows.length !== ids.length || wrong) throw AppError.conflict('A device was already handed over, or is not of this contractor, RTOM and month; reload');
            const formNumber = await AuditLedgerService.getNextDocumentNumber('CCF', tx);
            const form = await tx.cpeHandoverForm.create({
                data: {
                    formNumber, opmcId: input.opmcId, contractorId: input.contractorId, periodMonth: input.month, handedOverDate, reference: input.reference?.trim().slice(0, 120) || null,
                    scanUrl: input.scanUrl?.trim() || null, itemCount: rows.length, createdById: input.userId,
                },
            });
            await tx.collectedCPE.updateMany({ where: { id: { in: ids } }, data: { status: 'HANDED_BACK', handbackDate: handedOverDate, handbackReference: formNumber, handoverFormId: form.id } });
            for (const r of rows) {
                if (r.serialUnreadable) continue;
                const s = await tx.inventoryItemSerial.findUnique({ where: { serialNumber: r.serialNumber }, select: { id: true, status: true, cpeType: true, issueCycle: true, opmcId: true } });
                if (!s?.cpeType || s.status === 'RETURNED_TO_SLT') continue;
                await tx.inventoryItemSerial.update({ where: { id: s.id }, data: { status: 'RETURNED_TO_SLT', contractorId: null, storeId: null, sodId: null } });
                await recordCpeEvent(tx, {
                    serialId: s.id, serialNumber: r.serialNumber, eventType: 'RETURNED_TO_SLT', fromStatus: s.status, toStatus: 'RETURNED_TO_SLT', issueCycle: s.issueCycle,
                    opmcId: s.opmcId, contractorId: input.contractorId, documentType: 'CCF', documentNumber: formNumber, sltReference: input.reference?.trim() || null, performedById: input.userId,
                });
            }
            return { id: form.id, formNumber, itemCount: rows.length, rtom: opmc.rtom };
        }, { maxWait: 10_000, timeout: 60_000 });
        AuditService.log({ userId: input.userId, action: 'CPE_HANDOVER_FORM', entity: 'CPE_HANDOVER_FORM', entityId: result.id, newValue: { ...result, contractorId: input.contractorId, month: input.month } }).catch(() => undefined);
        return result;
    }
}
