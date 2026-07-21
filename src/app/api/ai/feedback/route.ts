import { apiHandler } from '@/lib/api-handler';
import { NexusClassifierService } from '@/services/nexus-classifier.service';
import { z } from 'zod';

const feedbackSchema = z.object({
    query: z.string().min(3).max(150),
    intent: z.enum(['FINANCE', 'PROJECTS', 'INVENTORY_LOW', 'CONTRACTORS', 'STORES', 'INVENTORY_ITEMS', 'PROCUREMENT', 'VOUCHERS', 'UNKNOWN']),
    rating: z.enum(['UP', 'DOWN'])
});

export const POST = apiHandler(async (_req, _params, body) => {
    const { query, intent, rating } = feedbackSchema.parse(body);

    // Only add to training if user confirms it was accurate and intent is known
    if (rating === 'UP' && intent !== 'UNKNOWN') {
        await NexusClassifierService.addTrainingExample(intent, query.trim());
        return Response.json({ success: true, message: 'Thanks! Model retrained with feedback.' });
    }

    return Response.json({ success: true, message: 'Feedback recorded' });
}, {
    // Requires standard auth which apiHandler handles when used inside the app or we can omit roles.
    // However, since it requires auth, we can just omit roles to let any authenticated user do it, or add 'ALL'.
    // If roles is omitted, apiHandler does NOT enforce a specific role, but we still need the user. 
    // To enforce auth only, we could leave roles undefined or handle it in middleware. 
    // Usually middleware protects `/api/ai/*`.
    audit: { action: 'SUBMIT_AI_FEEDBACK', entity: 'AI' }
});
