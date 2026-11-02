export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { NexusClassifierService } from '@/services/ai/nexus-classifier.service';
import { z } from 'zod';

const feedbackSchema = z.object({
    query: z.string().min(3).max(150),
    intent: z.enum(['FINANCE', 'PROJECTS', 'INVENTORY_LOW', 'CONTRACTORS', 'STORES', 'INVENTORY_ITEMS', 'PROCUREMENT', 'VOUCHERS', 'JOB_COSTING', 'SERVICE_ORDER_PROGRESS', 'BOM_INVOICES', 'UNKNOWN']),
    rating: z.enum(['UP', 'DOWN']),
    correctedIntent: z.enum(['FINANCE', 'PROJECTS', 'INVENTORY_LOW', 'CONTRACTORS', 'STORES', 'INVENTORY_ITEMS', 'PROCUREMENT', 'VOUCHERS', 'JOB_COSTING', 'SERVICE_ORDER_PROGRESS', 'BOM_INVOICES']).optional()
});

export const POST = apiHandler(async (_req, _params, body) => {
    const { query, intent, rating, correctedIntent } = feedbackSchema.parse(body);

    // Only add to training if user confirms it was accurate and intent is known
    if (rating === 'UP' && intent !== 'UNKNOWN') {
        await NexusClassifierService.addTrainingExample(intent, query.trim());
        return Response.json({ success: true, message: 'Thanks! Model retrained with feedback.' });
    }
    
    // Manual Correction: If rating is DOWN and user provides correctedIntent
    if (rating === 'DOWN' && correctedIntent) {
        await NexusClassifierService.addTrainingExample(correctedIntent, query.trim());
        return Response.json({ success: true, message: `Model manually retrained for intent: ${correctedIntent}` });
    }

    return Response.json({ success: true, message: 'Feedback recorded' });
}, {
    audit: { action: 'SUBMIT_AI_FEEDBACK', entity: 'AI' }
});
