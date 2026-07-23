import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { AuditService } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(
    async (req: Request, params: any) => {
        const invoiceId = params?.id;
        const userId = req.headers.get('x-user-id') || 'system';

        if (!invoiceId) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { contractor: { select: { name: true } } }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Action: Update Invoice Status to SF_AUDIT_APPROVED
        const updatedInvoice = await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'SF_AUDIT_APPROVED',
                statusA: 'SF_AUDIT_APPROVED'
            }
        });

        // Log Immutable Forensic Audit Trail Record
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
            success: true,
            message: `Invoice ${invoice.invoiceNumber} successfully cleared and APPROVED by SF Audit Section.`,
            invoice: updatedInvoice
        };
    },
    {
        roles: ['SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER']
    }
);
