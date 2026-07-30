import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { InvoiceGeneratorService } from '@/services/invoice/invoice.generator.service';
import { z } from 'zod';

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

    const result = await InvoiceGeneratorService.generateContractorMonthlyInvoice(data, userId);

    return {
        success: true,
        message: `Successfully generated Contractor Monthly Invoice ${result.invoice.invoiceNumber}`,
        invoice: {
            id: result.invoice.id,
            invoiceNumber: result.invoice.invoiceNumber,
            totalAmount: result.totalGrossAmount,
            amountA: (result.invoice as Record<string, unknown>).amountA,
            amountB: (result.invoice as Record<string, unknown>).amountB,
            sodCount: result.sods.length,
            publicUrl: result.publicUrl
        }
    };
}, {
    audit: { action: 'GENERATE_CONTRACTOR_INVOICE', entity: 'Invoice' }
});
