import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { getQueueProvider } from '@/lib/queue';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

const schema = z.object({
    contractorId: z.string(),
    month: z.number().min(1).max(12),
    year: z.number().min(2020)
});

export const POST = apiHandler(
    async (_req: Request, params, body) => {
        const { contractorId, month, year } = schema.parse(body);
        const userId = params._userId;
        if (!userId) throw AppError.unauthorized('Authentication required');

        const job = await getQueueProvider().addJob('invoice-generation', 'generate', {
            contractorId,
            month,
            year,
            userId
        });

        return {
            success: true,
            message: `Bulk Invoice Generation Enqueued. Job ID: ${job.id}`,
            jobId: job.id
        };
    },
    {
    }
);
