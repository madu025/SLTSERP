import { apiHandler } from '@/lib/api-handler';
import { NexusAgentService } from '@/services/nexus-agent.service';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { requireAuth } from '@/lib/server-utils';

const copilotActionSchema = z.object({
    message: z.string().optional(),
    action: z.any().optional(),
    execute: z.boolean().optional(),
    clear: z.boolean().optional()
});

// GET /api/ai/copilot - Fetch chat history for user securely
export const GET = apiHandler(async () => {
    // Enforce session check
    const user = await requireAuth();

    const { NexusMemoryService } = await import('@/services/nexus-memory.service');
    const [history, suggestions] = await Promise.all([
        NexusMemoryService.getConversation(user.id),
        NexusMemoryService.getFrequentSuggestions(user.id)
    ]);

    return Response.json({
        history,
        userName: user.name || "User",
        suggestions
    });
}, {
    // Auth required
});

// POST /api/ai/copilot - Ask questions or execute database actions securely
export const POST = apiHandler(async (_req, _params, body) => {
    // Enforce session check
    const user = await requireAuth();
    
    const { message, action, execute, clear } = copilotActionSchema.parse(body);

    // Handle clear chat history request
    if (clear) {
        const { NexusMemoryService } = await import('@/services/nexus-memory.service');
        await NexusMemoryService.clearConversation(user.id);
        return Response.json({ success: true, message: 'Chat history cleared' });
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
            throw AppError.badRequest('INVALID_ACTION_TYPE');
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

            throw AppError.forbidden(`⚠️ Unauthorized: Your role (${user.role}) is not authorized to execute this AI transaction. This attempt has been logged.`);
        }

        const result = await NexusAgentService.executeAction(action, user.id);
        return Response.json({
            success: true,
            message: 'Action executed successfully',
            result
        });
    }

    if (!message) {
        throw AppError.badRequest('MISSING_MESSAGE');
    }

    const reply = await NexusAgentService.ask(message, user.id);
    return Response.json(reply);
}, {
    // Auth required
});
