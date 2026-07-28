export const dynamic = 'force-dynamic';

import { apiHandler, castBody } from '@/lib/api-handler';
import { SODAutoCompletionService } from '@/services/sod-auto-completion.service';
import { AppError } from '@/lib/error';

/**
 * GET /api/automation/sod-auto-complete
 * Get status of auto-completion background process
 */
export const GET = apiHandler(async () => {
    return SODAutoCompletionService.getStatus();
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    rawResponse: true
});

/**
 * POST /api/automation/sod-auto-complete
 * Start or stop auto-completion background process
 */
export const POST = apiHandler(async (_request, _params, body) => {
    const { action } = castBody<{ action: string }>(body);

    if (action === 'start') {
        SODAutoCompletionService.startBackgroundProcess();
        return {
            message: 'Auto-completion background process started',
            status: SODAutoCompletionService.getStatus()
        };
    } else if (action === 'stop') {
        SODAutoCompletionService.stopBackgroundProcess();
        return {
            message: 'Auto-completion background process stopped',
            status: SODAutoCompletionService.getStatus()
        };
    } else if (action === 'run-now') {
        const result = await SODAutoCompletionService.processCompletedSODs();
        return {
            message: 'Auto-completion process executed',
            result
        };
    } else {
        throw AppError.badRequest('Invalid action. Use: start, stop, or run-now');
    }
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'EXECUTE', entity: 'AUTOMATION_SOD_AUTO_COMPLETE' },
    rawResponse: true
});
