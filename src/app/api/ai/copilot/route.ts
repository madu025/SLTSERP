import { NextResponse } from 'next/server';
import { NexusAgentService } from '@/services/nexus-agent.service';
import { handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message } = body;

        if (!message) {
            return NextResponse.json({ error: 'MISSING_MESSAGE' }, { status: 400 });
        }

        const reply = await NexusAgentService.ask(message);
        return NextResponse.json({ response: reply });
    } catch (error) {
        return handleApiError(error);
    }
}
