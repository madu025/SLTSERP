import { NextResponse } from 'next/server';
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
        if (result.entityType === 'MATERIAL_REQUEST' && (result.status === 'GATE_PASSED' || result.status === 'GATE_ADVANCED')) {
            const { StockRequestService } = await import('@/services/inventory/stock-request.service');
            await StockRequestService.processStockRequestAction({
                requestId: result.entityId,
                action: 'GATE_PASSED',
                userId: result.actionedById!,
                instanceId: result.instanceId
            }).catch(err => console.error(`[Webhook GET] Domain integration failed:`, err));
        } else if (result.entityType === 'MATERIAL_REQUEST' && result.status === 'GATE_REJECTED') {
            const { StockRequestService } = await import('@/services/inventory/stock-request.service');
            await StockRequestService.processStockRequestAction({
                requestId: result.entityId,
                action: 'REJECT',
                userId: result.actionedById!,
                instanceId: result.instanceId
            }).catch(err => console.error('[Webhook GET] Domain integration reject failed:', err));
        }

        const isApproved = result.status === 'GATE_PASSED' || result.status === 'GATE_ADVANCED';
        const title = isApproved
            ? (result.status === 'GATE_ADVANCED' ? 'Level Approved' : 'Approval Successful')
            : 'Request Rejected';
        const message = isApproved
            ? (result.status === 'GATE_ADVANCED'
                ? 'This level has been approved. The request has been forwarded to the next approver.'
                : 'The request has been successfully approved.')
            : 'The request has been rejected.';

        return new NextResponse(
            generateHtmlResponse(title, message, isApproved),
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
    } catch (error: unknown) {
        const message = error instanceof AppError ? error.message : 'An unexpected error occurred.';
        return new NextResponse(
            generateHtmlResponse('Action Failed', message, false),
            { status: 400, headers: { 'Content-Type': 'text/html' } }
        );
    }
}, { rawResponse: true });

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
    if (result.entityType === 'MATERIAL_REQUEST' && (result.status === 'GATE_PASSED' || result.status === 'GATE_ADVANCED')) {
        const { StockRequestService } = await import('@/services/inventory/stock-request.service');
        await StockRequestService.processStockRequestAction({
            requestId: result.entityId,
            action: 'GATE_PASSED',
            userId: result.actionedById!,
            instanceId: result.instanceId
        }).catch(err => console.error(`[Webhook POST] Domain integration failed:`, err));
    } else if (result.entityType === 'MATERIAL_REQUEST' && result.status === 'GATE_REJECTED') {
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
    const icon = isSuccess ? '&#10003;' : '&#10007;';
    
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="min-height:100vh;">
    <tr><td style="text-align:center;vertical-align:middle;padding:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:white;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);max-width:400px;width:90%;margin:0 auto;">
        <tr><td style="padding:40px 30px;text-align:center;">
          <div style="width:64px;height:64px;border-radius:50%;background:${color}15;color:${color};font-size:32px;line-height:64px;margin:0 auto 20px;font-weight:bold;">${icon}</div>
          <h1 style="margin:0 0 10px;color:#0f172a;font-size:24px;">${title}</h1>
          <p style="margin:0;color:#64748b;line-height:1.5;font-size:15px;">${message}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
