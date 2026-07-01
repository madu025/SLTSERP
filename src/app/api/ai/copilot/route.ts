import { NextResponse } from 'next/server';
import { NexusAgentService } from '@/services/nexus-agent.service';
import { handleApiError } from '@/lib/api-utils';
import { primaryClient as prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message, action, execute } = body;

        // If the user is executing a proactive action
        if (execute && action) {
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

        const reply = await NexusAgentService.ask(message);
        return NextResponse.json(reply);
    } catch (error) {
        return handleApiError(error);
    }
}
