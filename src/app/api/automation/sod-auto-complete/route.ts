import { NextRequest, NextResponse } from 'next/server';
import { SODAutoCompletionService } from '@/services/sod-auto-completion.service';

/**
 * GET /api/automation/sod-auto-complete
 * Get status of auto-completion background process
 */
export async function GET() {
    try {
        const status = SODAutoCompletionService.getStatus();
        return NextResponse.json(status);
    } catch (error) {
        console.error('Failed to get auto-completion status:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/automation/sod-auto-complete
 * Start or stop auto-completion background process
 */
export async function POST(request: NextRequest) {
    try {
        const role = request.headers.get('x-user-role');

        // Only admins can control automation
        if (!['ADMIN', 'SUPER_ADMIN'].includes(role || '')) {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { action } = body;

        if (action === 'start') {
            SODAutoCompletionService.startBackgroundProcess();
            return NextResponse.json({
                message: 'Auto-completion background process started',
                status: SODAutoCompletionService.getStatus()
            });
        } else if (action === 'stop') {
            SODAutoCompletionService.stopBackgroundProcess();
            return NextResponse.json({
                message: 'Auto-completion background process stopped',
                status: SODAutoCompletionService.getStatus()
            });
        } else if (action === 'run-now') {
            // Run immediately (manual trigger)
            const result = await SODAutoCompletionService.processCompletedSODs();
            return NextResponse.json({
                message: 'Auto-completion process executed',
                result
            });
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use: start, stop, or run-now' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Failed to control auto-completion:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
