export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';

const schema = z.object({
    question: z.string().min(1).max(500),
    answer: z.string().max(2000).optional(),
    evidence: z.string().max(1000).optional(),
});

/**
 * A user flags an assistant answer as wrong. The request body (question, the "searched" line, the answer text) is
 * written to the audit log by the handler (action NEXUS_FLAG_WRONG), so each flag can be replayed against the
 * database and turned into a regression case.
 */
export const POST = apiHandler(async (_req, _params, body) => {
    schema.parse(body);
    return Response.json({ success: true, message: 'Thanks, this answer was flagged for review.' });
}, {
    audit: { action: 'NEXUS_FLAG_WRONG', entity: 'NexusAgent' }
});
