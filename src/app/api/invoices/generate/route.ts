import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice.service';
import { z } from 'zod';

const generateSchema = z.object({
    contractorId: z.string().min(1, "contractorId is required"),
    month: z.union([z.string(), z.number()]).transform(val => Number(val)),
    year: z.union([z.string(), z.number()]).transform(val => Number(val))
});

export const POST = apiHandler(async (_req, _params, body) => {
    const data = generateSchema.parse(body);

    const result = await InvoiceService.generateMonthlyInvoice(data.contractorId, data.month, data.year);

    if (!result.success) {
        // According to our standard, non-success should throw AppError, but since the service returns {success: false}, we return 400
        return Response.json(result, { status: 400 });
    }

    return Response.json(result);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'REGIONAL_MANAGER'], // Excluded AREA_COORDINATOR, QC_OFFICER based on legacy logic
    audit: { action: 'GENERATE_MONTHLY_INVOICE', entity: 'Invoice' }
});
