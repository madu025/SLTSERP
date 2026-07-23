import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { SODInvoicingService } from '@/services/sod/sod.invoicing.service';
import { InvoiceGeneratorService } from '@/services/invoice/invoice.generator.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

const generateSchema = z.object({
    contractorId: z.string().min(1, 'contractorId is required'),
    month: z.union([z.string(), z.number()]).optional(),
    year: z.union([z.string(), z.number()]).optional(),
    sodIds: z.array(z.string()).optional()
});

export const POST = apiHandler(async (req: Request) => {
    const json = await req.json();
    const data = generateSchema.parse(json);
    const userId = req.headers.get('x-user-id') || 'system-billing-officer';

    const now = new Date();
    const currentYear = data.year ? Number(data.year) : now.getFullYear();
    const currentMonth = data.month ? Number(data.month) : now.getMonth() + 1;

    // 1. Fetch Invoicable SODs for this Contractor
    let sodWhere: any = {
        contractorId: data.contractorId,
        status: 'COMPLETED',
        isInvoicable: true,
        invoiced: false
    };

    if (data.sodIds && data.sodIds.length > 0) {
        sodWhere = {
            id: { in: data.sodIds },
            contractorId: data.contractorId,
            status: 'COMPLETED',
            isInvoicable: true,
            invoiced: false
        };
    }

    const sods = await prisma.serviceOrder.findMany({
        where: sodWhere,
        include: {
            materialUsage: { include: { item: true } }
        }
    });

    if (sods.length === 0) {
        throw AppError.badRequest('No verified invoicable SODs found for this contractor. Ensure SODs are completed and marked Invoicable by an Engineer first.');
    }

    // 2. Fetch Contractor & OPMC details
    const contractor = await prisma.contractor.findUnique({
        where: { id: data.contractorId },
        include: { opmc: true }
    });

    if (!contractor) {
        throw AppError.notFound('Contractor not found');
    }

    const regionName = contractor.opmc?.rtom || 'METRO';
    const contractorPrefix = contractor.registrationNumber ? contractor.registrationNumber.slice(-4) : 'LOTS';

    // 3. Generate Sequential Invoice Number
    const invoiceNumber = await InvoiceGeneratorService.generateUniqueNumber(
        contractorPrefix,
        regionName,
        currentYear,
        currentMonth
    );

    // 4. Calculate SOD Total Contractor Amount
    let totalGrossAmount = 0;
    for (const sod of sods) {
        const dwUsage = sod.materialUsage.find(m => {
            const itemCode = (m.item?.code || '').toUpperCase();
            const itemName = (m.item?.name || '').toUpperCase();
            return itemCode === 'OSP-HC-CBL-DW' || itemName.includes('DROP CABLE') || itemName.includes('DROP WIRE');
        });
        const dwLength = dwUsage ? parseFloat(dwUsage.quantity.toString()) : 150;
        const calc = await SODInvoicingService.calculateAmounts(sod.rtom, dwLength, { serviceType: sod.serviceType });
        totalGrossAmount += calc.contractorAmount;
    }

    // 5. Create Regional Invoice Record
    const sodIdsList = sods.map(s => s.id);
    const invoice = await InvoiceGeneratorService.createRegionalInvoice({
        invoiceNumber,
        contractorId: contractor.id,
        year: currentYear,
        month: currentMonth,
        totalAmount: totalGrossAmount,
        regionName,
        sodIds: sodIdsList,
        rtomArea: regionName,
        description: `Contractor Monthly Invoice for ${contractor.name} - ${regionName} (${currentMonth}/${currentYear})`
    });

    // 6. Write AuditLog
    await prisma.auditLog.create({
        data: {
            action: 'CONTRACTOR_INVOICE_GENERATED',
            entity: 'Invoice',
            entityId: invoice.id,
            userId: userId,
            newValue: {
                invoiceNumber: invoice.invoiceNumber,
                contractorName: contractor.name,
                sodCount: sods.length,
                totalAmount: totalGrossAmount,
                generatedBy: userId
            }
        }
    });

    const publicUrl = `/public/invoices/${invoice.id}`;

    return {
        success: true,
        message: `Successfully generated Contractor Monthly Invoice ${invoice.invoiceNumber}`,
        invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: totalGrossAmount,
            amountA: (invoice as any).amountA,
            amountB: (invoice as any).amountB,
            sodCount: sods.length,
            publicUrl
        }
    };
}, {
    audit: { action: 'GENERATE_CONTRACTOR_INVOICE', entity: 'Invoice' }
});
