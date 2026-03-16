import { NotificationService, NotificationPriority } from '../notification.service';

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
            link: '/admin/inventory/approvals',
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
            link: '/admin/inventory/approvals'
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
            link: '/admin/inventory/requests'
        });
    }
}
