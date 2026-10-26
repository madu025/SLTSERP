import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

interface CreateRetentionInput {
    projectId: string;
    invoiceId?: string | null;
    title: string;
    description?: string | null;
    retentionPercent?: number;
    retentionAmount: number;
    releaseCondition?: string | null;
    defectLiabilityPeriod?: number | null;
}

interface UpdateRetentionInput {
    retentionPercent?: number;
    retentionAmount?: number;
    releaseCondition?: string | null;
    defectLiabilityPeriod?: number | null;
}

function assertPositiveAmount(value: number, code: string) {
    if (!Number.isFinite(value) || value <= 0) throw AppError.badRequest(code);
}

function assertRetentionPercent(value: number) {
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
        throw AppError.badRequest('INVALID_RETENTION_PERCENT');
    }
}

export class ProjectRetentionService {
    static async getRetentions(projectId: string) {
        return prisma.projectRetention.findMany({
            where: { projectId },
            include: {
                releases: { orderBy: { releaseDate: 'desc' } },
                invoice: { select: { invoiceNumber: true, title: true, totalAmount: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async createRetention(data: CreateRetentionInput) {
        assertPositiveAmount(data.retentionAmount, 'INVALID_RETENTION_AMOUNT');
        if (data.retentionPercent !== undefined) assertRetentionPercent(data.retentionPercent);
        if (data.defectLiabilityPeriod !== undefined && data.defectLiabilityPeriod !== null
            && (!Number.isInteger(data.defectLiabilityPeriod) || data.defectLiabilityPeriod < 0)) {
            throw AppError.badRequest('INVALID_DEFECT_LIABILITY_PERIOD');
        }

        const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
        if (!project) throw AppError.badRequest('PROJECT_NOT_FOUND');

        if (data.invoiceId) {
            const invoice = await prisma.projectInvoice.findUnique({
                where: { id: data.invoiceId },
                select: { projectId: true, status: true },
            });
            if (!invoice || invoice.projectId !== data.projectId) throw AppError.badRequest('INVOICE_PROJECT_MISMATCH');
            if (invoice.status === 'CANCELLED') throw AppError.badRequest('CANNOT_RETAIN_CANCELLED_INVOICE');
        }

        return prisma.projectRetention.create({
            data: {
                projectId: data.projectId,
                invoiceId: data.invoiceId || null,
                title: data.title,
                description: data.description || null,
                retentionPercent: data.retentionPercent ?? 10,
                retentionAmount: data.retentionAmount,
                releasedAmount: 0,
                balanceAmount: data.retentionAmount,
                releaseCondition: data.releaseCondition || null,
                defectLiabilityPeriod: data.defectLiabilityPeriod ?? null,
                defectLiabilityEnd: data.defectLiabilityPeriod !== undefined && data.defectLiabilityPeriod !== null
                    ? new Date(Date.now() + (data.defectLiabilityPeriod * 24 * 60 * 60 * 1000))
                    : null,
                status: 'HELD',
            },
            include: { releases: true },
        });
    }

    static async releaseRetention(
        id: string,
        releaseAmount: number,
        releaseDate?: string | Date,
        approvedById?: string | null,
        remarks?: string | null,
    ) {
        assertPositiveAmount(releaseAmount, 'RELEASE_AMOUNT_MUST_BE_POSITIVE');
        if (!approvedById) throw AppError.badRequest('APPROVED_BY_ID_REQUIRED');

        return prisma.$transaction(async (tx) => {
            const existing = await tx.projectRetention.findUnique({ where: { id } });
            if (!existing) throw AppError.badRequest('RETENTION_NOT_FOUND');
            if (!['HELD', 'PARTIALLY_RELEASED'].includes(existing.status)) {
                throw AppError.badRequest('RETENTION_NOT_RELEASABLE');
            }
            if (existing.defectLiabilityEnd && existing.defectLiabilityEnd > new Date()) {
                throw AppError.badRequest('DEFECT_LIABILITY_PERIOD_NOT_ENDED');
            }

            const updated = await tx.projectRetention.updateMany({
                where: {
                    id,
                    status: { in: ['HELD', 'PARTIALLY_RELEASED'] },
                    balanceAmount: { gte: releaseAmount },
                },
                data: {
                    releasedAmount: { increment: releaseAmount },
                    balanceAmount: { decrement: releaseAmount },
                },
            });
            if (updated.count !== 1) throw AppError.badRequest('RELEASE_AMOUNT_EXCEEDS_BALANCE');

            const current = await tx.projectRetention.findUniqueOrThrow({ where: { id } });
            const newStatus = Number(current.balanceAmount) <= 0 ? 'FULLY_RELEASED' : 'PARTIALLY_RELEASED';
            await tx.retentionRelease.create({
                data: {
                    retentionId: id,
                    releaseAmount,
                    releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
                    approvedById,
                    approvedAt: new Date(),
                    remarks: remarks || null,
                },
            });
            return tx.projectRetention.update({
                where: { id },
                data: { status: newStatus },
                include: { releases: { orderBy: { releaseDate: 'desc' } } },
            });
        });
    }

    static async updateRetention(id: string, updateData: UpdateRetentionInput) {
        const existing = await prisma.projectRetention.findUnique({ where: { id } });
        if (!existing) throw AppError.badRequest('RETENTION_NOT_FOUND');
        if (existing.status !== 'HELD' || Number(existing.releasedAmount) !== 0) {
            throw AppError.badRequest('ONLY_UNRELEASED_RETENTIONS_CAN_BE_UPDATED');
        }

        const data: Record<string, unknown> = {};
        if (updateData.retentionPercent !== undefined) {
            assertRetentionPercent(updateData.retentionPercent);
            data.retentionPercent = updateData.retentionPercent;
        }
        if (updateData.retentionAmount !== undefined) {
            assertPositiveAmount(updateData.retentionAmount, 'INVALID_RETENTION_AMOUNT');
            data.retentionAmount = updateData.retentionAmount;
            data.balanceAmount = updateData.retentionAmount;
        }
        if (updateData.releaseCondition !== undefined) data.releaseCondition = updateData.releaseCondition;
        if (updateData.defectLiabilityPeriod !== undefined) {
            if (updateData.defectLiabilityPeriod !== null
                && (!Number.isInteger(updateData.defectLiabilityPeriod) || updateData.defectLiabilityPeriod < 0)) {
                throw AppError.badRequest('INVALID_DEFECT_LIABILITY_PERIOD');
            }
            data.defectLiabilityPeriod = updateData.defectLiabilityPeriod;
            data.defectLiabilityEnd = updateData.defectLiabilityPeriod === null
                ? null
                : new Date(Date.now() + (updateData.defectLiabilityPeriod * 24 * 60 * 60 * 1000));
        }

        return prisma.projectRetention.update({
            where: { id }, data,
            include: { releases: { orderBy: { releaseDate: 'desc' } } },
        });
    }

    static async deleteRetention(id: string) {
        const existing = await prisma.projectRetention.findUnique({ where: { id } });
        if (!existing) throw AppError.badRequest('RETENTION_NOT_FOUND');
        if (Number(existing.releasedAmount) > 0) throw AppError.badRequest('HAS_RELEASES');
        await prisma.projectRetention.delete({ where: { id } });
        return { success: true };
    }
}
