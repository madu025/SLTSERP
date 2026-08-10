import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { EmailService } from '../notification/email.service';
import { NotificationTemplateEngineService } from '../notification/template-engine.service';
import { AppError } from '@/lib/error';
import { requireEnv } from '@/lib/env';

/** Fail-closed: approval tokens must never be signed with a hardcoded default */
function getJwtSecret(): string {
    return requireEnv('JWT_SECRET');
}

export class DynamicApprovalService {
    
    /**
     * Generates a 1-click action token for email approvals
     */
    static generateActionToken(instanceId: string, action: 'APPROVED' | 'REJECTED', userId: string) {
        return jwt.sign(
            { instanceId, action, userId },
            getJwtSecret(),
            { expiresIn: '48h' }
        );
    }

    /**
     * Generates a neutral VIEW token that opens the approval detail page
     * without taking any action. The page then issues fresh approve/reject
     * tokens so the approver can review details before deciding.
     */
    static generateViewToken(instanceId: string, userId: string) {
        return jwt.sign(
            { instanceId, userId, purpose: 'VIEW' },
            getJwtSecret(),
            { expiresIn: '48h' }
        );
    }

    /**
     * Dispatch an Office 365 Actionable Email
     */
    static async sendActionableEmail(
        instanceId: string, 
        entityType: string, 
        entityId: string, 
        approverEmail: string, 
        userId: string,
        amount?: number
    ) {
        const approveToken = this.generateActionToken(instanceId, 'APPROVED', userId);
        const rejectToken = this.generateActionToken(instanceId, 'REJECTED', userId);
        const viewToken = this.generateViewToken(instanceId, userId);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app';
        
        const approveUrl = `${baseUrl}/api/approvals/webhook?token=${approveToken}`;
        const rejectUrl = `${baseUrl}/api/approvals/webhook?token=${rejectToken}`;
        const viewUrl = `${baseUrl}/approvals/action?token=${viewToken}`;

        // Microsoft Actionable Message JSON Payload
        const actionableCard = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "0076D7",
            "summary": `Approval Required for ${entityType} #${entityId}`,
            "sections": [{
                "activityTitle": `Approval Required: ${entityType}`,
                "activitySubtitle": `ID: ${entityId}`,
                "facts": [
                    { "name": "Entity Type", "value": entityType },
                    { "name": "Entity ID", "value": entityId },
                    ...(amount ? [{ "name": "Amount (LKR)", "value": amount.toLocaleString() }] : [])
                ],
                "markdown": true
            }],
            "potentialAction": [
                {
                    "@type": "HttpPOST",
                    "name": "Approve",
                    "target": approveUrl
                },
                {
                    "@type": "HttpPOST",
                    "name": "Reject",
                    "target": rejectUrl
                }
            ]
        };

        const templateVars: Record<string, string> = {
            user: approverEmail,
            entityType,
            entityId,
            approveUrl,
            rejectUrl,
            viewUrl,
            expiryHours: '48',
            amount: amount ? amount.toLocaleString() : '',
            status: 'PENDING'
        };

        // Try DB template first, fallback to hardcoded
        const dbTemplate = await NotificationTemplateEngineService.renderEmailByCode('APPROVAL_GENERIC', templateVars);

        const html = dbTemplate?.html || `
            <html>
                <head>
                    <script type="application/ld+json">
                        ${JSON.stringify(actionableCard)}
                    </script>
                </head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Approval Required for ${entityType} #${entityId}</h2>
                    <p>You have been assigned to approve this request.</p>
                    ${amount ? `<p><strong>Amount:</strong> LKR ${amount.toLocaleString()}</p>` : ''}
                    <div style="margin-top: 20px;">
                        <a href="${viewUrl}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Review &amp; Take Action</a>
                    </div>
                    <div style="margin-top: 12px;">
                        <a href="${approveUrl}" style="background-color: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve</a>
                        <a href="${rejectUrl}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject</a>
                    </div>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">This action link expires in 48 hours.</p>
                </body>
            </html>
        `;

        const subject = dbTemplate?.subject || `Action Required: ${entityType} Approval`;
        const text = dbTemplate?.text || `Please approve or reject the ${entityType} request. Approve: ${approveUrl} | Reject: ${rejectUrl}`;

        await EmailService.sendMail({
            to: approverEmail,
            subject,
            text,
            html
        });
    }

    /**
     * Dispatch an Office 365 Actionable Email specifically for Material Requests
     */
    static async sendMaterialRequestEmail(
        instanceId: string,
        stockRequestId: string,
        approverEmail: string,
        userId: string,
        requiredRole: string
    ) {
        // Fetch the Stock Request with items and details
        const stockRequest = await prisma.stockRequest.findUnique({
            where: { id: stockRequestId },
            include: {
                items: {
                    include: { item: true }
                },
                fromStore: true,
                toStore: true
            }
        });

        if (!stockRequest) throw AppError.notFound('Stock Request not found for email hydration.');

        const approveToken = this.generateActionToken(instanceId, 'APPROVED', userId);
        const rejectToken = this.generateActionToken(instanceId, 'REJECTED', userId);
        const viewToken = this.generateViewToken(instanceId, userId);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app';
        const approveUrl = `${baseUrl}/api/approvals/webhook?token=${approveToken}`;
        const rejectUrl = `${baseUrl}/api/approvals/webhook?token=${rejectToken}`;
        const viewUrl = `${baseUrl}/approvals/action?token=${viewToken}`;

        // Map items to adaptive card facts
        const itemFacts = stockRequest.items.map(item => ({
            name: item.item.name || item.item.code,
            value: `Qty: ${item.requestedQty} ${item.item.unit}`
        }));

        const actionableCard = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "0076D7",
            "summary": `Approval Required for Material Request #${stockRequest.requestNr}`,
            "sections": [
                {
                    "activityTitle": `Approval Required: Material Request`,
                    "activitySubtitle": `Ref: ${stockRequest.requestNr} | Priority: ${stockRequest.priority}`,
                    "facts": [
                        { "name": "From Store", "value": stockRequest.fromStore?.name || 'External/Vendor' },
                        { "name": "To Store", "value": stockRequest.toStore?.name || 'N/A' },
                        { "name": "Purpose", "value": stockRequest.purpose || 'N/A' },
                        { "name": "Stage", "value": stockRequest.workflowStage }
                    ],
                    "markdown": true
                },
                {
                    "title": "Material Summary",
                    "facts": itemFacts.length > 0 ? itemFacts.slice(0, 10) : [{ name: "Items", value: "No items listed." }],
                    "text": itemFacts.length > 10 ? `*...and ${itemFacts.length - 10} more items.*` : undefined
                }
            ],
            "potentialAction": [
                {
                    "@type": "HttpPOST",
                    "name": "Approve",
                    "target": approveUrl
                },
                {
                    "@type": "HttpPOST",
                    "name": "Reject",
                    "target": rejectUrl
                }
            ]
        };

        const itemsHtml = stockRequest.items.map(i =>
            `<li>${i.item.name || i.item.code} - ${i.requestedQty} ${i.item.unit}</li>`
        ).join('');

        const templateVars: Record<string, string> = {
            user: approverEmail,
            entityType: 'Material Request',
            entityId: stockRequest.requestNr,
            entityName: stockRequest.purpose || 'N/A',
            approveUrl,
            rejectUrl,
            viewUrl,
            expiryHours: '48',
            status: stockRequest.workflowStage,
            userRole: requiredRole,
            items: itemsHtml,
            priority: stockRequest.priority,
            purpose: stockRequest.purpose || 'N/A',
            fromStore: stockRequest.fromStore?.name || 'External/Vendor',
            toStore: stockRequest.toStore?.name || 'N/A'
        };

        // Try DB template first, fallback to hardcoded
        const dbTemplate = await NotificationTemplateEngineService.renderEmailByCode('APPROVAL_MATERIAL_REQUEST', templateVars);

        const html = dbTemplate?.html || `
            <html>
                <head>
                    <script type="application/ld+json">
                        ${JSON.stringify(actionableCard)}
                    </script>
                </head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Approval Required: Material Request #${stockRequest.requestNr}</h2>
                    <p>You have been assigned to approve this request as <strong>${requiredRole}</strong>.</p>
                    <p><strong>Priority:</strong> ${stockRequest.priority}</p>
                    <p><strong>Purpose:</strong> ${stockRequest.purpose || 'N/A'}</p>
                    <h3>Material Summary</h3>
                    <ul>
                        ${itemsHtml}
                    </ul>
                    <div style="margin-top: 20px;">
                        <a href="${viewUrl}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Review &amp; Take Action</a>
                    </div>
                    <div style="margin-top: 12px;">
                        <a href="${approveUrl}" style="background-color: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve</a>
                        <a href="${rejectUrl}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject</a>
                    </div>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">This action link expires in 48 hours.</p>
                </body>
            </html>
        `;

        const subject = dbTemplate?.subject || `Action Required: Material Request ${stockRequest.requestNr}`;
        const text = dbTemplate?.text || `Please approve or reject Material Request ${stockRequest.requestNr}. Approve: ${approveUrl} | Reject: ${rejectUrl}`;

        // Fire and forget to avoid blocking API
        EmailService.sendMail({
            to: approverEmail,
            subject,
            text,
            html
        }).catch(err => console.error('[DynamicApprovalService] Async Email Dispatch Failed:', err));
    }

    /**
     * Returns approval instance details for the public view page.
     * Hydrates Material Request items when applicable.
     */
    static async getApprovalDetails(instanceId: string) {
        const instance = await prisma.universalApprovalInstance.findUnique({
            where: { id: instanceId },
            include: { assignedUser: { select: { name: true, email: true, role: true } } }
        });

        if (!instance) throw AppError.notFound('Approval instance not found.');

        const details: Record<string, unknown> = {
            id: instance.id,
            entityType: instance.entityType,
            entityId: instance.entityId,
            status: instance.status,
            requiredRole: instance.requiredRole,
            level: instance.level,
            createdAt: instance.createdAt,
            assignedUser: instance.assignedUser
                ? { name: instance.assignedUser.name, email: instance.assignedUser.email, role: instance.assignedUser.role }
                : null
        };

        // Hydrate Material Request items for a richer view (only when entityId is a valid UUID)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instance.entityId);
        if (isUuid && (instance.entityType === 'MATERIAL_REQUEST' || instance.entityType === 'TEST_APPROVAL')) {
            const stockRequest = await prisma.stockRequest.findUnique({
                where: { id: instance.entityId },
                include: {
                    items: { include: { item: true } },
                    fromStore: true,
                    toStore: true
                }
            });
            if (stockRequest) {
                details.requestNr = stockRequest.requestNr;
                details.priority = stockRequest.priority;
                details.purpose = stockRequest.purpose;
                details.fromStore = stockRequest.fromStore?.name || 'External/Vendor';
                details.toStore = stockRequest.toStore?.name || 'N/A';
                details.items = stockRequest.items.map(i => ({
                    name: i.item.name || i.item.code,
                    qty: i.requestedQty,
                    unit: i.item.unit
                }));
            }
        }

        return details;
    }

    /**
     * Process webhook click from email
     */
    static async processApprovalWebhook(token: string) {
        interface ApprovalTokenPayload {
            instanceId: string;
            action: string;
            userId: string;
        }

        let decoded: ApprovalTokenPayload;
        try {
            decoded = jwt.verify(token, getJwtSecret()) as ApprovalTokenPayload;
        } catch (error) {
            throw AppError.badRequest('Invalid or expired action token.');
        }

        const { instanceId, action, userId } = decoded;

        if (action !== 'APPROVED' && action !== 'REJECTED') {
            throw AppError.badRequest('Invalid action payload.');
        }

        const { ProcessGateEngine } = await import('./process-gate-engine');
        return await ProcessGateEngine.advanceGate({
            instanceId,
            action: action as 'APPROVED' | 'REJECTED',
            userId
        });
    }
}
