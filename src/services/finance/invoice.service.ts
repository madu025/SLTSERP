import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface GetInvoicesParams {
    page?: number;
    limit?: number;
    search?: string;
    approvalStatus?: string;
}

export class InvoiceService {
    static async getInvoices(params: GetInvoicesParams) {
        const { page = 1, limit = 10, search = '', approvalStatus = '' } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.InvoiceWhereInput = {};

        if (search) {
            where.invoiceNumber = { contains: search, mode: 'insensitive' };
        }

        if (approvalStatus) {
            where.approvalStatus = approvalStatus;
        }

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                skip,
                take: limit,
                include: {
                    contractor: { select: { id: true, name: true, type: true } },
                    project: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.invoice.count({ where })
        ]);

        return {
            invoices,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
}
