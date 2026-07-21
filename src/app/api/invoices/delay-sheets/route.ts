import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month'); // e.g., "2026-07"
    const rtomParam = searchParams.get('rtom');   // e.g., "R-AD"

    const data = await InvoiceService.getDelaySheets(monthParam, rtomParam);
    
    return Response.json({
        success: true,
        ...data
    });
});
