import { NextResponse } from 'next/server';
import { NexusAgentService } from '@/services/nexus-agent.service';
import { handleApiError } from '@/lib/api-utils';
import { primaryClient as prisma } from '@/lib/prisma';

// GET /api/ai/copilot - Fetch chat history for user
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let userId = searchParams.get("userId");

        if (!userId) {
            const admin = await prisma.user.findFirst({
                where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }
            });
            userId = admin?.id || null;
        }

        if (!userId) {
            return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 400 });
        }

        const { NexusMemoryService } = await import('@/services/nexus-memory.service');
        const history = await NexusMemoryService.getConversation(userId);
        return NextResponse.json(history);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message, action, execute, clear } = body;

        let userId = body.userId;
        if (!userId) {
            const admin = await prisma.user.findFirst({
                where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }
            });
            userId = admin?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 400 });
        }

        // Handle clear chat history request
        if (clear) {
            const { NexusMemoryService } = await import('@/services/nexus-memory.service');
            await NexusMemoryService.clearConversation(userId);
            return NextResponse.json({ success: true, message: 'Chat history cleared' });
        }

        // If the user is executing a proactive action
        if (execute && action) {
            const result = await NexusAgentService.executeAction(action, userId);
            return NextResponse.json({
                success: true,
                message: 'Action executed successfully',
                result
            });
        }

        if (!message) {
            return NextResponse.json({ error: 'MISSING_MESSAGE' }, { status: 400 });
        }

        const reply = await NexusAgentService.ask(message, userId);
        return NextResponse.json(reply);
    } catch (error) {
        return handleApiError(error);
    }
}
