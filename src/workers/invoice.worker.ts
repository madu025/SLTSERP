import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { InvoiceService } from '@/services/invoice/invoice.service';
import { prisma } from '@/lib/prisma';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const invoiceWorker = new Worker(
    'invoice-generation',
    async (job: Job) => {
        const { contractorId, month, year, userId } = job.data;
        console.log(`[InvoiceWorker] Processing batch generation for Contractor ${contractorId} (Month: ${month}, Year: ${year})`);
        
        try {
            await job.updateProgress(10);
            const result = await InvoiceService.generateMonthlyInvoice(contractorId, month, year);
            await job.updateProgress(100);
            
            return {
                success: result.success,
                message: result.message,
                invoiceIds: result.invoices?.map(i => i.id) || []
            };
        } catch (error: unknown) {
            console.error(`[InvoiceWorker] Error:`, error);
            throw error;
        }
    },
    { connection: connection as any }
);

invoiceWorker.on('completed', async (job: Job) => {
    console.log(`[InvoiceWorker] Job ${job.id} completed!`);
});

invoiceWorker.on('failed', async (job: Job | undefined, err: Error) => {
    console.error(`[InvoiceWorker] Job ${job?.id} failed with ${err.message}`);
});
