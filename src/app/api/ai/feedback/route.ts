import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-utils';
import { NexusClassifierService } from '@/services/nexus-classifier.service';

export async function POST(request: Request) {
    try {
        const user = await requireAuth();
        if (!user) {
            return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        }

        const body = await request.json();
        const { query, intent, rating } = body;

        // Input Validation (Mitigate Model Poisoning & Replay payload abuse)
        if (!query || typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 150) {
            return NextResponse.json({ error: 'INVALID_QUERY_LENGTH' }, { status: 400 });
        }

        const validIntents = ['FINANCE', 'PROJECTS', 'INVENTORY_LOW', 'CONTRACTORS', 'STORES', 'INVENTORY_ITEMS', 'PROCUREMENT', 'VOUCHERS'];
        if (!intent || !validIntents.includes(intent)) {
            return NextResponse.json({ error: 'INVALID_INTENT' }, { status: 400 });
        }

        if (rating !== 'UP' && rating !== 'DOWN') {
            return NextResponse.json({ error: 'INVALID_RATING' }, { status: 400 });
        }

        // Only add to training if user confirms it was accurate and intent is known
        if (rating === 'UP' && intent !== 'UNKNOWN') {
            await NexusClassifierService.addTrainingExample(intent, query.trim());
            return NextResponse.json({ success: true, message: 'Thanks! Model retrained with feedback.' });
        }

        return NextResponse.json({ success: true, message: 'Feedback recorded' });
    } catch (error) {
        console.error("AI Feedback Error:", error);
        const errMsg = error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR';
        return NextResponse.json({ error: errMsg }, { status: 500 });
    }
}
