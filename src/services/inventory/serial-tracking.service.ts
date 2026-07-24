import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export type SerialStatus = 'IN_STORE' | 'ISSUED' | 'INSTALLED' | 'FAULTY' | 'RETURNED' | 'DISPOSED';

export class SerialTrackingService {
    /**
     * Verify if a CPE Serial Number is valid for installation on a SOD
     */
    static async validateSerialForSOD(serialNumber: string, contractorId?: string | null) {
        const serialRecord = await prisma.inventoryItemSerial.findUnique({
            where: { serialNumber },
            include: { item: true, store: true }
        });

        if (!serialRecord) {
            throw AppError.notFound(`CPE Serial Number '${serialNumber}' is not registered in the system inventory.`);
        }

        if (serialRecord.status === 'INSTALLED') {
            throw AppError.badRequest(
                `CPE Serial Number '${serialNumber}' is already registered as INSTALLED on another completed SOD.`
            );
        }

        if (contractorId && serialRecord.contractorId && serialRecord.contractorId !== contractorId) {
            throw AppError.badRequest(
                `CPE Serial Number '${serialNumber}' is issued to another contractor team and cannot be used by this contractor.`
            );
        }

        return {
            isValid: true,
            serialRecord,
        };
    }

    /**
     * Mark CPE Serial as INSTALLED atomically upon SOD Completion
     */
    static async markSerialInstalled(serialNumber: string, sodId: string, performedById: string) {
        const serialRecord = await prisma.inventoryItemSerial.findUnique({
            where: { serialNumber }
        });

        if (!serialRecord) return null;

        return prisma.inventoryItemSerial.update({
            where: { id: serialRecord.id },
            data: {
                status: 'INSTALLED',
                sodId,
                updatedAt: new Date()
            }
        });
    }

    /**
     * Issue Serialized CPE Asset to Contractor Team
     */
    static async issueSerialToContractor(serialNumber: string, contractorId: string, performedById: string) {
        const serialRecord = await prisma.inventoryItemSerial.findUnique({
            where: { serialNumber }
        });

        if (!serialRecord) {
            throw AppError.notFound(`CPE Serial Number '${serialNumber}' not found in store.`);
        }

        if (serialRecord.status !== 'IN_STORE') {
            throw AppError.badRequest(
                `Cannot issue serial '${serialNumber}'. Current status is '${serialRecord.status}' (Must be IN_STORE).`
            );
        }

        return prisma.inventoryItemSerial.update({
            where: { id: serialRecord.id },
            data: {
                status: 'ISSUED',
                contractorId,
                updatedAt: new Date()
            }
        });
    }
}
