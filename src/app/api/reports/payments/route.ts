import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/core/report.service';
import { z } from 'zod';
import { PaymentTypeEnum, PaymentStatusEnum } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PAYMENT_TYPE_VALUES = Object.values(PaymentTypeEnum) as [string, ...string[]];
const PAYMENT_STATUS_VALUES = Object.values(PaymentStatusEnum) as [string, ...string[]];

const querySchema = z.object({
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    payment_type: z.enum(PAYMENT_TYPE_VALUES).optional().nullable(),
    status: z.enum(PAYMENT_STATUS_VALUES).optional().nullable(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
        from_date: searchParams.get('from_date'),
        to_date: searchParams.get('to_date'),
        payment_type: searchParams.get('payment_type'),
        status: searchParams.get('status'),
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
    });

    if (!parsed.success) {
        return { success: false, error: 'Invalid query parameters', details: parsed.error.format() };
    }

    const { from_date, to_date, payment_type, status, page, limit } = parsed.data;

    const { payments, total, summary, by_type } = await ReportService.getPaymentsReport({
        from_date,
        to_date,
        payment_type,
        status,
        page,
        limit
    });

    return {
        success: true,
        data: {
            summary,
            by_type,
            payments,
        },
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
}, { rawResponse: true, menuPath: '/reports/fleet' });
