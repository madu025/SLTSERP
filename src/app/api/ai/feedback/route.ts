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

        if (!query || !intent || !rating) {
            return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
        }

        // Only add to training if user confirms it was accurate and intent is known
        if (rating === 'UP' && intent !== 'UNKNOWN') {
            await NexusClassifierService.addTrainingExample(intent, query);
            return NextResponse.json({ success: true, message: 'Thanks! Model retrained with feedback.' });
        }

        return NextResponse.json({ success: true, message: 'Feedback recorded' });
    } catch (error: any) {
        console.error("AI Feedback Error:", error);
        return NextResponse.json({ error: error.message || 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
