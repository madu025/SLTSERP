import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { DynamicApprovalService } from '@/services/approval/dynamic-approval.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

/**
 * Handle HTTP GET from regular email links
 */
export const GET = apiHandler(async (req: Request) => {
    const token = new URL(req.url).searchParams.get('token');
    
    if (!token) {
        return new NextResponse(
            generateHtmlResponse('Error', 'Missing action token.', false),
            { status: 400, headers: { 'Content-Type': 'text/html' } }
        );
    }

    try {
        const result = await DynamicApprovalService.processApprovalWebhook(token);
        
        // --- INTEGRATION: TRIGGER NEXT DOMAIN STAGE ---
        if (result.entityType === 'MATERIAL_REQUEST' && result.status === 'APPROVED') {
            const { StockRequestService } = await import('@/services/inventory/stock-request.service');
            await StockRequestService.processStockRequestAction({
                requestId: result.entityId,
                action: 'GATE_PASSED',
                userId: result.actionedById!,
                instanceId: result.instanceId
            }).catch(err => console.error(`[Webhook GET] Domain integration failed:`, err));
        } else if (result.entityType === 'MATERIAL_REQUEST' && result.status === 'REJECTED') {
            const { StockRequestService } = await import('@/services/inventory/stock-request.service');
            await StockRequestService.processStockRequestAction({
                requestId: result.entityId,
                action: 'REJECT',
                userId: result.actionedById!,
                instanceId: result.instanceId
            }).catch(err => console.error('[Webhook GET] Domain integration reject failed:', err));
        }

        return new NextResponse(
            generateHtmlResponse(
                'Approval Successful', 
                `The request has been successfully ${result.status.toLowerCase()}.`, 
                true
            ),
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
    } catch (error: unknown) {
        const message = error instanceof AppError ? error.message : 'An unexpected error occurred.';
        return new NextResponse(
            generateHtmlResponse('Action Failed', message, false),
            { status: 400, headers: { 'Content-Type': 'text/html' } }
        );
    }
});

/**
 * Handle HTTP POST from Microsoft Actionable Messages
 */
export const POST = apiHandler(async (req: Request) => {
    const token = new URL(req.url).searchParams.get('token');
    
    if (!token) {
        throw AppError.badRequest('Missing action token.');
    }

    const result = await DynamicApprovalService.processApprovalWebhook(token);
    
    // --- INTEGRATION: TRIGGER NEXT DOMAIN STAGE ---
    if (result.entityType === 'MATERIAL_REQUEST' && result.status === 'APPROVED') {
        const { StockRequestService } = await import('@/services/inventory/stock-request.service');
        await StockRequestService.processStockRequestAction({
            requestId: result.entityId,
            action: 'GATE_PASSED',
            userId: result.actionedById!,
            instanceId: result.instanceId
        }).catch(err => console.error(`[Webhook POST] Domain integration failed:`, err));
    } else if (result.entityType === 'MATERIAL_REQUEST' && result.status === 'REJECTED') {
        const { StockRequestService } = await import('@/services/inventory/stock-request.service');
        await StockRequestService.processStockRequestAction({
            requestId: result.entityId,
            action: 'REJECT',
            userId: result.actionedById!,
            instanceId: result.instanceId
        }).catch(err => console.error('[Webhook POST] Domain integration reject failed:', err));
    }
    
    // Outlook requires a 200 OK and optionally a CARD-ACTION-STATUS header
    const response = NextResponse.json({
        success: true,
        message: `Successfully ${result.status.toLowerCase()}`
    });
    
    response.headers.set('CARD-ACTION-STATUS', `Successfully ${result.status.toLowerCase()}`);
    return response;
});

function generateHtmlResponse(title: string, message: string, isSuccess: boolean) {
    const color = isSuccess ? '#22c55e' : '#ef4444';
    const icon = isSuccess ? '✓' : '✕';
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #f8fafc;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
            }
            .card {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                text-align: center;
                max-width: 400px;
                width: 90%;
            }
            .icon {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background-color: ${color}20;
                color: ${color};
                font-size: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
            }
            h1 { margin: 0 0 10px; color: #0f172a; font-size: 24px; }
            p { margin: 0; color: #64748b; line-height: 1.5; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">${icon}</div>
            <h1>${title}</h1>
            <p>${message}</p>
        </div>
    </body>
    </html>
    `;
}
