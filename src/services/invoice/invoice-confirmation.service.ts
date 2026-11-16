import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { userHasPermission } from '@/lib/user-permissions';
import {
    CONFIRM_STAGES, CONFIRM_START_STAGE, STAGE_LABEL, STAGE_PERMISSION,
    canConfirm, isConfirmStage, nextStage, type ConfirmStage,
} from '@/lib/invoice-confirm-rules';

/** Does the area (OPMC) have anybody who can confirm as Area Engineer / Officer? When not, that stage is skipped. */
async function areaHasEngineer(opmcId: string | null): Promise<boolean> {
    if (!opmcId) return false;
    const code = STAGE_PERMISSION.AREA_ENGINEER;
    const count = await prisma.user.count({
        where: {
            status: 'active',
            accessibleOpmcs: { some: { id: opmcId } },
            systemRole: { isActive: true, rolePermissions: { some: { OR: [{ permission: code }, { permissionDefinition: { code } }] } } },
        },
    });
    return count > 0;
}

export class InvoiceConfirmationService {
    /** Invoices waiting at a stage the user may act on, inside the user's OPMC scope. */
    static async queue(userId: string) {
        const stages: ConfirmStage[] = [];
        for (const stage of CONFIRM_STAGES) if (await userHasPermission(userId, STAGE_PERMISSION[stage])) stages.push(stage);
        if (stages.length === 0) return { stages: [], invoices: [] };
        const scope = await resolveOpmcScope(userId);
        const invoices = await prisma.invoice.findMany({
            where: {
                confirmStage: { in: stages },
                ...(scope !== undefined ? { contractor: { opmcId: { in: scope } } } : {}),
            },
            orderBy: { createdAt: 'asc' },
            take: 200,
            select: {
                id: true, invoiceNumber: true, totalAmount: true, amountA: true, amountB: true, month: true, year: true, rtomArea: true, confirmStage: true,
                contractor: { select: { name: true } },
                confirmations: { orderBy: { createdAt: 'asc' }, select: { stage: true, action: true, note: true, createdAt: true, user: { select: { name: true } } } },
            },
        });
        return { stages, invoices };
    }

    static async history(invoiceId: string) {
        return prisma.invoiceConfirmation.findMany({
            where: { invoiceId }, orderBy: { createdAt: 'asc' },
            select: { stage: true, action: true, note: true, createdAt: true, user: { select: { name: true } } },
        });
    }

    /** Confirm the stage the invoice is waiting at, or return it to the start with a reason. */
    static async act(userId: string, invoiceId: string, action: 'CONFIRM' | 'RETURN', note?: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { id: true, invoiceNumber: true, confirmStage: true, contractor: { select: { opmcId: true } }, confirmations: { select: { userId: true, stage: true, action: true } } },
        });
        if (!invoice) throw AppError.notFound('Invoice not found');
        const stage = invoice.confirmStage;
        if (!isConfirmStage(stage)) throw AppError.badRequest('This invoice has no confirmation pending');

        if (!(await userHasPermission(userId, STAGE_PERMISSION[stage]))) {
            throw AppError.forbidden(`${STAGE_PERMISSION[stage]} is required to act as ${STAGE_LABEL[stage]}`);
        }
        const scope = await resolveOpmcScope(userId);
        const opmcId = invoice.contractor.opmcId;
        if (scope !== undefined && (!opmcId || !scope.includes(opmcId))) throw AppError.forbidden('Invoice is outside your area');

        if (action === 'RETURN') {
            if (!note || note.trim().length < 3) throw AppError.badRequest('A reason is required to return an invoice');
            await prisma.$transaction([
                prisma.invoiceConfirmation.create({ data: { invoiceId, stage, action: 'RETURNED', userId, note: note.trim() } }),
                prisma.invoice.update({ where: { id: invoiceId }, data: { confirmStage: CONFIRM_START_STAGE } }),
            ]);
            return { invoiceNumber: invoice.invoiceNumber, stage: CONFIRM_START_STAGE as string };
        }

        // Only confirmations since the last return count towards separation of duties
        const confirmed = invoice.confirmations.filter((c) => c.action === 'CONFIRMED');
        const lastReturn = invoice.confirmations.map((c, i) => (c.action === 'RETURNED' ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
        const sinceReturn = lastReturn >= 0 ? invoice.confirmations.slice(lastReturn + 1).filter((c) => c.action === 'CONFIRMED') : confirmed;
        if (!canConfirm(userId, sinceReturn, stage)) {
            throw AppError.badRequest('You already confirmed another stage of this invoice; a different person must confirm this stage');
        }

        const next = nextStage(stage, await areaHasEngineer(opmcId));
        await prisma.$transaction([
            prisma.invoiceConfirmation.create({ data: { invoiceId, stage, action: 'CONFIRMED', userId, note: note?.trim() || null } }),
            prisma.invoice.update({ where: { id: invoiceId }, data: { confirmStage: next } }),
        ]);
        return { invoiceNumber: invoice.invoiceNumber, stage: next as string };
    }
}
