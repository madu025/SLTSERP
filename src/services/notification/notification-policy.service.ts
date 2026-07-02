import { NotificationService, NotificationPriority } from '../notification.service';
import { EmailService } from './email.service';

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
            roles: ['SUPER_ADMIN', 'ADMIN', 'AREA_MANAGER', 'OSP_MANAGER', 'MANAGER', 'OFFICE_ADMIN', 'ENGINEER'],
            title: "Contractor Pending Review",
            message,
            type: 'CONTRACTOR',
            priority: 'HIGH',
            link: `/admin/contractors/approvals`,
            opmcId: contractor.opmcId || undefined,
            metadata: { contractorId: contractor.id, name: contractor.name, stage: 'ARM_REVIEW' }
        });
    }

    static async notifyContractorStatusChange(contractor: { id: string; name: string; siteOfficeStaffId: string | null; opmcId: string | null }, status: string, rejectionReason?: string | null) {
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
                roles: ['OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
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
            roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER'],
            title: 'SOD Returned/Rejected',
            message: `Service Order ${sod.soNum} has been marked as RETURN. Reason: ${sod.returnReason || 'No reason provided'}.`,
            type: 'PROJECT',
            priority: 'HIGH',
            link: '/service-orders/return',
            opmcId: sod.opmcId,
            metadata: { soNum: sod.soNum, id: sod.id }
        });
    }

    // --- INVENTORY POLICIES ---

    static async notifyLowStock(storeName: string, itemName: string, currentQty: number, minLevel: number) {
        await NotificationService.notifyByRole({
            roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
            title: 'Low Stock Alert',
            message: `Item "${itemName}" in ${storeName} is below minimum level. Current: ${currentQty}, Min: ${minLevel}`,
            type: 'INVENTORY',
            priority: 'HIGH',
            link: '/admin/inventory/stock'
        });

        // Trigger real email alerts to active admins/managers
        try {
            const prisma = (await import('@/lib/prisma')).primaryClient;
            const admins = await prisma.user.findMany({
                where: {
                    role: { in: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'] as any }
                },
                select: { email: true }
            });

            const emails = admins.map(a => a.email).filter(Boolean) as string[];
            if (emails.length > 0) {
                await EmailService.sendMail({
                    to: emails.join(','),
                    subject: `[SLTS NEXUS Alert] Critical Low Stock: ${itemName} in ${storeName}`,
                    text: `Low stock detected for item: ${itemName} in ${storeName}.\nCurrent stock level: ${currentQty}\nMinimum safety stock level: ${minLevel}\n\nPlease take immediate replenishment action.`,
                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
                        <h2 style="color:#e11d48;margin-top:0;">⚠️ Low Stock Replenishment Required</h2>
                        <p><strong>Material Name:</strong> ${itemName}</p>
                        <p><strong>Storage Store:</strong> ${storeName}</p>
                        <p><strong>In Hand Quantity:</strong> <span style="color:#e11d48;font-weight:bold;">${currentQty}</span></p>
                        <p><strong>Configured Min Level:</strong> ${minLevel}</p>
                        <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0;" />
                        <p style="font-size:12px;color:#64748b;">This is an automated production alert from SLTS Nexus ERP.</p>
                    </div>`
                });
            }
        } catch (err) {
            console.error("Failed to send low stock emails:", err);
        }
    }

    static async notifyStockRequestCreated(req: { id: string; requestNr: string; fromStoreName: string; opmcId?: string; type: string }, stage: string) {
        let roles: string[] = [];
        let stageName = '';

        if (stage === 'ARM_APPROVAL') {
            roles = ['AREA_MANAGER', 'OFFICE_ADMIN'];
            stageName = 'ARM approval';
        } else {
            roles = ['OSP_MANAGER', 'ADMIN'];
            stageName = 'OSP Manager approval';
        }

        await NotificationService.notifyByRole({
            roles,
            title: 'New Material Request',
            message: `New material request ${req.requestNr} from ${req.fromStoreName} requires your ${stageName}.`,
            type: 'INVENTORY',
            priority: 'MEDIUM',
            link: '/inventory/approvals',
            opmcId: req.opmcId,
            metadata: { requestId: req.id, type: req.type }
        });
    }

    static async notifyStockRequestStageChange(req: { id: string; requestNr: string }, stage: string, receiverRoles: string[]) {
        let title = '';
        let message = '';

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
        }

        await NotificationService.notifyByRole({
            roles: receiverRoles,
            title,
            message,
            type: 'INVENTORY',
            priority: 'HIGH',
            link: '/inventory/approvals'
        });
    }

    static async notifyStockRequestFinalAction(req: { id: string; requestNr: string; requestedById: string }, action: string, remarks?: string | null) {
        let title = '';
        let message = '';
        let priority: NotificationPriority = 'MEDIUM';

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
                break;
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
     * Check expiring inventory batches and trigger alerts
     */
    static async checkBatchExpirations() {
        const prisma = (await import('@/lib/prisma')).prisma;
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

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
                    include: {
                        store: true
                    }
                }
            }
        });

        const results = [];
        for (const batch of expiringBatches) {
            for (const bs of batch.storeStocks) {
                const message = `Batch "${batch.batchNumber}" of item "${batch.item.name}" in store "${bs.store.name}" is expiring on ${batch.expiryDate?.toLocaleDateString()}! Quantity remaining: ${bs.quantity}.`;
                
                await NotificationService.notifyByRole({
                    roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'],
                    title: 'Batch Expiry Warning (FEFO)',
                    message,
                    type: 'INVENTORY',
                    priority: 'CRITICAL',
                    link: '/inventory/assets',
                    metadata: { batchId: batch.id, expiryDate: batch.expiryDate }
                });

                // Send email alert for expiring batch
                try {
                    const admins = await (await import('@/lib/prisma')).primaryClient.user.findMany({
                        where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'] as any } },
                        select: { email: true }
                    });
                    const emails = admins.map(a => a.email).filter(Boolean) as string[];
                    if (emails.length > 0) {
                        await EmailService.sendMail({
                            to: emails.join(','),
                            subject: `[SLTS NEXUS FEFO Alert] Batch Expiration: ${batch.item.name}`,
                            text: message,
                            html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #fecaca;border-radius:8px;background-color:#fff5f5;">
                                <h2 style="color:#dc2626;margin-top:0;">⏳ FEFO Compliance: Batch Expiry Warning</h2>
                                <p><strong>Material:</strong> ${batch.item.name} (${batch.item.code})</p>
                                <p><strong>Batch Number:</strong> ${batch.batchNumber || 'N/A'}</p>
                                <p><strong>Store Location:</strong> ${bs.store.name}</p>
                                <p><strong>Remaining Qty:</strong> <span style="font-weight:bold;">${bs.quantity}</span></p>
                                <p><strong>Expiry Date:</strong> <span style="color:#dc2626;font-weight:bold;">${batch.expiryDate?.toLocaleDateString()}</span></p>
                                <hr style="border:0;border-top:1px solid #fecaca;margin:20px 0;" />
                                <p style="font-size:11px;color:#7f1d1d;">Please prioritize issuing this batch to avoid financial write-offs.</p>
                            </div>`
                        });
                    }
                } catch (e) {
                    console.error("Failed to send batch expiry email:", e);
                }

                results.push({
                    batchNumber: batch.batchNumber,
                    itemName: batch.item.name,
                    storeName: bs.store.name,
                    quantity: Number(bs.quantity),
                    expiryDate: batch.expiryDate
                });
            }
        }
        return results;
    }
}
