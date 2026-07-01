import { NextResponse } from 'next/server';
import { NexusAgentService } from '@/services/nexus-agent.service';
import { handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/server-utils';
import { prisma } from '@/lib/prisma';

// GET /api/ai/copilot - Fetch chat history for user securely
export async function GET(_request: Request) {
    try {
        // Enforce session check
        const user = await requireAuth();

        const { NexusMemoryService } = await import('@/services/nexus-memory.service');
        const history = await NexusMemoryService.getConversation(user.id);
        return NextResponse.json(history);
    } catch (error) {
        return handleApiError(error);
    }
}

// POST /api/ai/copilot - Ask questions or execute database actions securely
export async function POST(request: Request) {
    try {
        // Enforce session check
        const user = await requireAuth();
        
        const body = await request.json();
        const { message, action, execute, clear } = body;

        // Handle clear chat history request
        if (clear) {
            const { NexusMemoryService } = await import('@/services/nexus-memory.service');
            await NexusMemoryService.clearConversation(user.id);
            return NextResponse.json({ success: true, message: 'Chat history cleared' });
        }

        // If the user is executing a proactive action
        if (execute && action) {
            // Enforce Strict Role-Based Access Control (RBAC) for AI transactions
            let isAuthorized = true;
            if (action.type === 'ASSIGN_CUSTODY') {
                if (!['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER'].includes(user.role)) {
                    isAuthorized = false;
                }
            } else if (action.type === 'STOCK_TRANSFER' || action.type === 'STOCK_HEAL') {
                if (!['ADMIN', 'SUPER_ADMIN', 'STORES_MANAGER', 'STORES_ASSISTANT', 'OSP_MANAGER'].includes(user.role)) {
                    isAuthorized = false;
                }
            } else {
                return NextResponse.json({ error: 'INVALID_ACTION_TYPE' }, { status: 400 });
            }

            if (!isAuthorized) {
                // Log unauthorized attempt to Database Audit Logs
                await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        action: 'UNAUTHORIZED_AI_TRANSACTION',
                        entity: 'NexusAgent',
                        entityId: action.type,
                        newValue: {
                            actionType: action.type,
                            itemName: action.itemName || null,
                            itemCode: action.itemCode || null,
                            fromStoreName: action.fromStoreName || null,
                            toStoreName: action.toStoreName || null,
                            userRole: user.role,
                            attemptedAt: new Date().toISOString()
                        }
                    }
                });

                return NextResponse.json({ 
                    error: 'FORBIDDEN_ROLE', 
                    message: `⚠️ Unauthorized: Your role (${user.role}) is not authorized to execute this AI transaction. This attempt has been logged.` 
                }, { status: 403 });
            }

            const result = await NexusAgentService.executeAction(action, user.id);
            return NextResponse.json({
                success: true,
                message: 'Action executed successfully',
                result
            });
        }

        if (!message) {
            return NextResponse.json({ error: 'MISSING_MESSAGE' }, { status: 400 });
        }

        const reply = await NexusAgentService.ask(message, user.id);
        return NextResponse.json(reply);
    } catch (error) {
        return handleApiError(error);
    }
}
