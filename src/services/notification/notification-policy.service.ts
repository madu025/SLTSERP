import { Role } from '@prisma/client';
import { ROLE_GROUPS } from '@/config/roles';
import { NotificationService, NotificationPriority } from '@/services/notification/notification.service';
import { EmailService } from './email.service';
import { NotificationTemplateEngineService } from './template-engine.service';
import { prisma } from '@/lib/prisma';
import { getSriLankaDayKey } from '@/lib/timezone';

/**
 * Roles that receive all stock/inventory alert emails.
 * Kept in sync with the in-app notification roles used in notifyLowStock.
 * Declared once here so in-app and email recipients never drift apart again (fixes Issue #8).
 */
const INVENTORY_ALERT_EMAIL_ROLES: Role[] = [
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.CEO,
    Role.HEAD_OF_OSP,
    Role.STORES_MANAGER,
    Role.OSP_MANAGER,
];

/**
 * Shared helper: fetch emails for a set of roles and send a single digest email.
 * Eliminates the duplicate admin-fetch + sendMail pattern (fixes Issues #2 & #7).
 * Errors are logged with structured context; a retry can be added via BullMQ if needed.
 */
async function sendAlertEmail({
    roles,
    subject,
    text,
    html,
    context,
    templateCode,
    templateVars,
}: {
    roles: Role[];
    subject: string;
    text: string;
    html: string;
    context: string;
    templateCode?: string;
    templateVars?: Record<string, string>;
}): Promise<void> {
    const admins = await prisma.user.findMany({
        where: { role: { in: roles } },
        select: { email: true }
    });

    const emails = admins.map(a => a.email).filter(Boolean) as string[];
    if (emails.length === 0) return;

    // Try DB template first, fallback to hardcoded HTML
    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;
    if (templateCode && templateVars) {
        const dbTemplate = await NotificationTemplateEngineService.renderEmailByCode(templateCode, templateVars);
        if (dbTemplate) {
            finalSubject = dbTemplate.subject;
            finalHtml = dbTemplate.html;
            finalText = dbTemplate.text;
        }
    }

    try {
        await EmailService.sendMail({ to: emails.join(','), subject: finalSubject, text: finalText, html: finalHtml });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[NotificationPolicy] Email send failure [${context}]:`, message);
    }
}

export class NotificationPolicyService {

    // --- CONTRACTOR POLICIES ---

    static async notifyContractorSubmission(contractor: { id: string; name: string; siteOfficeStaffId: string | null; opmcId: string | null }) {
        const message = `Contractor "${contractor.name}" has submitted their registration form and is waiting for ARM review.`;

        if (contractor.siteOfficeStaffId) {
            await NotificationService.send({
                userId: contractor.siteOfficeStaffId,
                title: "New Contractor Submission",
                message,
                type: 'CONTRACTOR',
                priority: 'HIGH',
                link: `/admin/contractors`,
                metadata: { contractorId: contractor.id, name: contractor.name }
            });
        }

        await NotificationService.notifyByRole({
            roles: ROLE_GROUPS.OFFICE_ADMINS,
            title: "Contractor Pending Review",
            message,
            type: 'CONTRACTOR',
            priority: 'HIGH',
            link: `/admin/contractors/approvals`,
            opmcId: contractor.opmcId || undefined,
            metadata: { contractorId: contractor.id, name: contractor.name, stage: 'ARM_REVIEW' }
        });
    }

    static async notifyContractorStatusChange(
        contractor: { id: string; name: string; siteOfficeStaffId: string | null; opmcId: string | null },
        status: string,
        rejectionReason?: string | null
    ) {
        const reporterId = contractor.siteOfficeStaffId;
        if (!reporterId) return;

        if (status === 'OSP_PENDING') {
            await NotificationService.send({
                userId: reporterId,
                title: "Contractor ARM Approved",
                message: `Contractor "${contractor.name}" has been approved by ARM and is waiting for OSP authorization.`,
                type: 'CONTRACTOR',
                priority: 'MEDIUM'
            });
            await NotificationService.notifyByRole({
                roles: ROLE_GROUPS.PROJECT_MANAGERS,
                title: "New Contractor Pending Authorization",
                message: `Contractor "${contractor.name}" is waiting for final authorization.`,
                type: 'CONTRACTOR',
                priority: 'HIGH',
                opmcId: contractor.opmcId || undefined,
                link: '/admin/contractors/approvals'
            });
        } else if (status === 'ACTIVE') {
            await NotificationService.send({
                userId: reporterId,
                title: "Contractor Fully Activated",
                message: `Contractor "${contractor.name}" is now ACTIVE.`,
                type: 'CONTRACTOR',
                priority: 'HIGH'
            });
        } else if (status === 'REJECTED') {
            await NotificationService.send({
                userId: reporterId,
                title: "Contractor Registration Rejected",
                message: `Registration for "${contractor.name}" was rejected. Reason: ${rejectionReason || 'No reason provided'}.`,
                type: 'CONTRACTOR',
                priority: 'CRITICAL'
            });
        }
    }

    // --- SOD POLICIES ---

    static async notifySODReturn(sod: { id: string; soNum: string; opmcId: string; returnReason: string | null }) {
        await NotificationService.notifyByRole({
            roles: ROLE_GROUPS.OPS,
            title: 'SOD Returned/Rejected',
            message: `Service Order ${sod.soNum} has been marked as RETURN. Reason: ${sod.returnReason || 'No reason provided'}.`,
            type: 'PROJECT',
            priority: 'HIGH',
            link: '/service-orders/work-order/return',
            opmcId: sod.opmcId,
            metadata: { soNum: sod.soNum, id: sod.id },
            // Same discipline as the completion alert: one row per SOD per Sri Lanka day, so a feed
            // that re-asserts the same RETURN bumps groupedCount instead of alerting OPS again.
            dedupKey: `sod-return:${sod.soNum}:${getSriLankaDayKey()}`
        });
    }

    // --- INVENTORY POLICIES ---

    static async notifyLowStock(storeName: string, itemName: string, currentQty: number, minLevel: number) {
        const inAppRoles = [...ROLE_GROUPS.STORES_MANAGERS, 'OSP_MANAGER', 'HEAD_OF_OSP'];
        const alertMessage = `Item "${itemName}" in ${storeName} is below minimum level. Current: ${currentQty}, Min: ${minLevel}`;

        // In-app notification
        await NotificationService.notifyByRole({
            roles: inAppRoles,
            title: 'Low Stock Alert',
            message: alertMessage,
            type: 'INVENTORY',
            priority: 'HIGH',
            link: '/inventory/stock'
        });

        // Email notification — same role set as in-app (Fix #8: aligned recipients)
        await sendAlertEmail({
            roles: INVENTORY_ALERT_EMAIL_ROLES,
            subject: `[SLTS NEXUS Alert] Critical Low Stock: ${itemName} in ${storeName}`,
            text: `Low stock detected for item: ${itemName} in ${storeName}.\nCurrent stock level: ${currentQty}\nMinimum safety stock level: ${minLevel}\n\nPlease take immediate replenishment action.`,
            html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
                <h2 style="color:#e11d48;margin-top:0;">Low Stock Replenishment Required</h2>
                <p><strong>Material Name:</strong> ${itemName}</p>
                <p><strong>Storage Store:</strong> ${storeName}</p>
                <p><strong>In Hand Quantity:</strong> <span style="color:#e11d48;font-weight:bold;">${currentQty}</span></p>
                <p><strong>Configured Min Level:</strong> ${minLevel}</p>
                <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0;" />
                <p style="font-size:12px;color:#64748b;">This is an automated production alert from SLTS Nexus ERP.</p>
            </div>`,
            context: `notifyLowStock:${itemName}:${storeName}`,
            templateCode: 'ALERT_GENERIC',
            templateVars: {
                user: 'Stores Manager',
                title: `Critical Low Stock: ${itemName} in ${storeName}`,
                message: `Low stock detected: ${itemName} in ${storeName}. Current: ${currentQty}, Min Level: ${minLevel}`,
                date: new Date().toLocaleString(),
                actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sltserp.vercel.app'}/inventory/stock`
            }
        });
    }

    static async notifyStockRequestCreated(
        req: { id: string; requestNr: string; fromStoreName: string; opmcId?: string; type: string },
        stage: string
    ) {
        // Fix #4: use ROLE_GROUPS constants instead of hardcoded strings
        const isArmStage = stage === 'ARM_APPROVAL';
        const roles = isArmStage
            ? [...ROLE_GROUPS.AREA_MANAGERS, ...ROLE_GROUPS.OFFICE_ADMINS]
            : ['OSP_MANAGER', 'HEAD_OF_OSP', 'PROCUREMENT_OFFICER', 'STORES_MANAGER', ...ROLE_GROUPS.ADMINS];

        const stageName = isArmStage ? 'ARM approval' : 'OSP Manager / Procurement approval';

        await NotificationService.notifyByRole({
            roles,
            title: isArmStage ? 'New Material Request' : 'New Procurement Requisition',
            message: `New Material Request ${req.requestNr} from ${req.fromStoreName} requires your ${stageName}.`,
            type: 'INVENTORY',
            priority: 'HIGH',
            link: '/inventory/requests',
            opmcId: req.opmcId,
            metadata: { requestId: req.id, type: req.type }
        });
    }

    static async notifyStockRequestStageChange(req: { id: string; requestNr: string }, stage: string, receiverRoles: string[]) {
        let title: string;
        let message: string;

        // Fix #5: default case guard — unknown stages log a warning and skip notification
        switch (stage) {
            case 'STORES_MANAGER_APPROVAL':
                title = 'Request Approved by ARM';
                message = `Material request ${req.requestNr} approved by ARM, requires Stores Manager approval.`;
                break;
            case 'OSP_MANAGER_APPROVAL':
                title = 'Request Approved by Store Manager';
                message = `Material request ${req.requestNr} approved by Store Manager, requires OSP Manager final approval.`;
                break;
            case 'PROCUREMENT':
                title = 'Local Purchase Approved';
                message = `Material request ${req.requestNr} approved for Local Purchase, requires PO creation.`;
                break;
            case 'MAIN_STORE_RELEASE':
                title = 'Material Release Required';
                message = `Request ${req.requestNr} approved, ready for release from Main Store.`;
                break;
            default:
                console.warn(`[NotificationPolicy] notifyStockRequestStageChange: unrecognized stage "${stage}" for request ${req.requestNr}. Skipping notification.`);
                return;
        }

        await NotificationService.notifyByRole({
            roles: receiverRoles,
            title,
            message,
            type: 'INVENTORY',
            priority: 'HIGH',
            link: '/inventory/requests'
        });
    }

    static async notifyStockRequestFinalAction(
        req: { id: string; requestNr: string; requestedById: string },
        action: string,
        remarks?: string | null
    ) {
        let title: string;
        let message: string;
        let priority: NotificationPriority;

        // Fix #5: default case guard — unknown actions log a warning and skip notification
        switch (action) {
            case 'RETURNED':
                title = 'Material Request Returned';
                message = `Your request ${req.requestNr} has been returned. Reason: ${remarks || 'N/A'}`;
                priority = 'HIGH';
                break;
            case 'REJECTED':
                title = 'Material Request Rejected';
                message = `Your material request ${req.requestNr} has been rejected.`;
                priority = 'CRITICAL';
                break;
            case 'RELEASED':
                title = 'Materials Released';
                message = `Materials for request ${req.requestNr} have been released. Please confirm receipt.`;
                priority = 'HIGH';
                break;
            case 'PROCUREMENT_COMPLETE':
                title = 'Procurement Completed';
                message = `Procurement for request ${req.requestNr} is complete. Waiting for GRN.`;
                priority = 'MEDIUM';
                break;
            default:
                console.warn(`[NotificationPolicy] notifyStockRequestFinalAction: unrecognized action "${action}" for request ${req.requestNr}. Skipping notification.`);
                return;
        }

        await NotificationService.send({
            userId: req.requestedById,
            title,
            message,
            type: 'INVENTORY',
            priority,
            link: '/inventory/requests'
        });
    }

    /**
     * Check expiring inventory batches and trigger alerts.
     *
     * Fix #1: uses the shared `prisma` client (not mixed primaryClient/prisma).
     * Fix #2: admin email list fetched ONCE before the loop (eliminates N+1 DB queries).
     * Fix #7: uses shared sendAlertEmail helper (DRY).
     */
    static async checkBatchExpirations() {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        // Fix #1: consistent `prisma` import (no mixed primaryClient usage)
        const expiringBatches = await prisma.inventoryBatch.findMany({
            where: {
                expiryDate: {
                    lte: thirtyDaysFromNow,
                    gt: new Date()
                }
            },
            include: {
                item: true,
                storeStocks: {
                    where: { quantity: { gt: 0 } },
                    include: { store: true }
                }
            }
        });

        if (expiringBatches.length === 0) return [];

        // Fix #2: fetch admin emails ONCE outside the loop
        const adminEmailRecords = await prisma.user.findMany({
            where: { role: { in: INVENTORY_ALERT_EMAIL_ROLES } },  // ✅ Fix #3: typed enum, no `as any`
            select: { email: true }
        });
        const adminEmails = adminEmailRecords.map(a => a.email).filter(Boolean) as string[];

        const results = [];
        for (const batch of expiringBatches) {
            for (const bs of batch.storeStocks) {
                const batchMessage = `Batch "${batch.batchNumber}" of item "${batch.item.name}" in store "${bs.store.name}" is expiring on ${batch.expiryDate?.toLocaleDateString()}! Quantity remaining: ${bs.quantity}.`;

                // In-app notifications per batch/store pair (deduplication handled inside NotificationService)
                await NotificationService.notifyByRole({
                    roles: ROLE_GROUPS.STORES_MANAGERS,
                    title: 'Batch Expiry Warning (FEFO)',
                    message: batchMessage,
                    type: 'INVENTORY',
                    priority: 'CRITICAL',
                    link: '/inventory/stock',
                    metadata: { batchId: batch.id, expiryDate: batch.expiryDate }
                });

                results.push({
                    batchNumber: batch.batchNumber,
                    itemName: batch.item.name,
                    storeName: bs.store.name,
                    quantity: Number(bs.quantity),
                    expiryDate: batch.expiryDate
                });
            }
        }

        // Fix #2: send ONE digest email per run (not one per batch×store combination)
        if (results.length > 0 && adminEmails.length > 0) {
            const digestRows = results.map(r =>
                `<tr>
                    <td style="padding:4px 8px;border-bottom:1px solid #fecaca;">${r.itemName}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid #fecaca;">${r.batchNumber ?? 'N/A'}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid #fecaca;">${r.storeName}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid #fecaca;font-weight:bold;">${r.quantity}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid #fecaca;color:#dc2626;font-weight:bold;">${r.expiryDate?.toLocaleDateString() ?? 'N/A'}</td>
                </tr>`
            ).join('');

            try {
                const fefoItemsHtml = results.map(r =>
                    `<li>${r.itemName} (Batch: ${r.batchNumber ?? 'N/A'}) @ ${r.storeName}: Qty ${r.quantity}, Expires ${r.expiryDate?.toLocaleDateString() ?? 'N/A'}</li>`
                ).join('');

                const fefoVars: Record<string, string> = {
                    user: 'Stores Manager',
                    itemCount: String(results.length),
                    items: fefoItemsHtml,
                    date: new Date().toLocaleString(),
                    storeName: results[0]?.storeName || 'Multiple Stores'
                };

                const dbTemplate = await NotificationTemplateEngineService.renderEmailByCode('ALERT_FEFO_EXPIRY', fefoVars);

                await EmailService.sendMail({
                    to: adminEmails.join(','),
                    subject: dbTemplate?.subject || `[SLTS NEXUS FEFO Alert] ${results.length} Batch(es) Expiring Within 30 Days`,
                    text: dbTemplate?.text || `The following ${results.length} batch(es) are expiring within 30 days:\n\n${results.map(r => `- ${r.itemName} (${r.batchNumber ?? 'N/A'}) @ ${r.storeName}: Qty ${r.quantity}, Expires ${r.expiryDate?.toLocaleDateString() ?? 'N/A'}`).join('\n')}`,
                    html: dbTemplate?.html || `<div style="font-family:sans-serif;padding:20px;border:1px solid #fecaca;border-radius:8px;background-color:#fff5f5;">
                        <h2 style="color:#dc2626;margin-top:0;">FEFO Compliance: Batch Expiry Digest</h2>
                        <p>${results.length} batch(es) will expire within the next 30 days. Please prioritize issuing these batches to avoid financial write-offs.</p>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                            <thead>
                                <tr style="background:#fee2e2;">
                                    <th style="padding:6px 8px;text-align:left;">Material</th>
                                    <th style="padding:6px 8px;text-align:left;">Batch #</th>
                                    <th style="padding:6px 8px;text-align:left;">Store</th>
                                    <th style="padding:6px 8px;text-align:left;">Qty</th>
                                    <th style="padding:6px 8px;text-align:left;">Expiry</th>
                                </tr>
                            </thead>
                            <tbody>${digestRows}</tbody>
                        </table>
                        <hr style="border:0;border-top:1px solid #fecaca;margin:20px 0;" />
                        <p style="font-size:11px;color:#7f1d1d;">Automated FEFO alert from SLTS Nexus ERP.</p>
                    </div>`
                });
            } catch (err: unknown) {
                // Fix #6: structured error log
                const message = err instanceof Error ? err.message : String(err);
                console.error('[NotificationPolicy] FEFO digest email failure:', message);
            }
        }

        return results;
    }
}
