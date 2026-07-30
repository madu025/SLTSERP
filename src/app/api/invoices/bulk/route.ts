import { z } from 'zod';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const invoiceQueue = new Queue('invoice-generation', { connection: connection as any });

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

        const job = await invoiceQueue.add('generate', {
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
