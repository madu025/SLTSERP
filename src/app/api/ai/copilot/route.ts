export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { NexusAgentService } from '@/services/ai/nexus-agent.service';
import { SystemService } from '@/services/core/system.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

const copilotActionSchema = z.object({
    message: z.string().optional(),
    action: z.any().optional(),
    execute: z.boolean().optional(),
    clear: z.boolean().optional()
});

// GET /api/ai/copilot - Fetch chat history for user securely
export const GET = apiHandler(async (_req, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const { NexusMemoryService } = await import('@/services/ai/nexus-memory.service');
    const [history, suggestions] = await Promise.all([
        NexusMemoryService.getConversation(userId),
        NexusMemoryService.getFrequentSuggestions(userId)
    ]);

    return {
        history,
        userName: params._userName || "User",
        suggestions
    };
}, {
    // Auth required
});

// POST /api/ai/copilot - Ask questions or execute database actions securely
export const POST = apiHandler(async (_req, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    
    const { message, action, execute, clear } = copilotActionSchema.parse(body);

    // Handle clear chat history request
    if (clear) {
        const { NexusMemoryService } = await import('@/services/ai/nexus-memory.service');
        await NexusMemoryService.clearConversation(userId);
        return Response.json({ success: true, message: 'Chat history cleared' });
    }

    // If the user is executing a proactive action
    if (execute && action) {
        // Action-specific canonical permissions are required in addition to
        // the base authenticated AI route capability.
        let requiredPermission: string;
        if (action.type === 'ASSIGN_CUSTODY') {
            requiredPermission = RBAC_PERMISSIONS.AI_CUSTODY_EXECUTE;
        } else if (action.type === 'STOCK_TRANSFER' || action.type === 'STOCK_HEAL') {
            requiredPermission = RBAC_PERMISSIONS.AI_STOCK_EXECUTE;
        } else {
            throw AppError.badRequest('INVALID_ACTION_TYPE');
        }

        if (!params._permissions.includes(requiredPermission)) {
            // Log unauthorized attempt to Database Audit Logs
            await SystemService.logEvent({
                userId,
                action: 'UNAUTHORIZED_AI_TRANSACTION',
                entity: 'NexusAgent',
                entityId: action.type,
                newValue: {
                    actionType: action.type,
                    itemName: action.itemName || null,
                    itemCode: action.itemCode || null,
                    fromStoreName: action.fromStoreName || null,
                    toStoreName: action.toStoreName || null,
                    requiredPermission,
                    attemptedAt: new Date().toISOString()
                }
            });

            throw AppError.forbidden('Insufficient permission to execute this AI transaction');
        }

        const result = await NexusAgentService.executeAction(action, userId);
        return {
            success: true,
            message: 'Action executed successfully',
            result
        };
    }

    if (!message) {
        throw AppError.badRequest('MISSING_MESSAGE');
    }

    const reply = await NexusAgentService.ask(message, userId);
    return reply;
}, {
    // Auth required
});
