import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';

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

    static async approveBySfAudit(invoiceId: string, userId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { contractor: { select: { name: true } } }
        });

        if (!invoice) {
            throw AppError.notFound('Invoice not found');
        }

        const updatedInvoice = await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'SF_AUDIT_APPROVED' as import('@prisma/client').InvoiceStatus as import('@prisma/client').InvoiceStatus,
                statusA: 'SF_AUDIT_APPROVED'
            }
        });

        await AuditService.log({
            userId,
            action: 'SF_AUDIT_INVOICE_CLEARANCE',
            entity: 'Invoice',
            entityId: invoice.id,
            newValue: {
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: parseFloat(invoice.totalAmount.toString()),
                contractorName: invoice.contractor?.name,
                approvedBy: userId,
                approvedAt: new Date().toISOString()
            }
        });

        return {
            invoice: updatedInvoice,
            invoiceNumber: invoice.invoiceNumber
        };
    }
}
