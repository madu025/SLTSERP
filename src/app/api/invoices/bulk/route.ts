import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';
import { getQueueProvider } from '@/lib/queue';

export const dynamic = 'force-dynamic';

const schema = z.object({
    contractorId: z.string(),
    month: z.number().min(1).max(12),
    year: z.number().min(2020)
});

export const POST = apiHandler(
    async (req: Request) => {
        const body = await req.json();
        const { contractorId, month, year } = schema.parse(body);
        const userId = req.headers.get('x-user-id') || 'system';

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
        roles: ROLE_GROUPS.SF_INVOICING
    }
);
