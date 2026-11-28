import crypto from 'node:crypto';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

type Tx = TransactionClient;

export interface CpeEventInput {
    serialId: string;
    serialNumber: string;
    eventType: 'RECEIVED' | 'REISSUED_BY_SLT' | 'ISSUED' | 'INSTALLED' | 'RELEASED' | 'REUSED_ON_UPGRADE' | 'RECOVERED' | 'FAULTY' | 'RETURNED_TO_SLT' | 'CORRECTED';
    fromStatus: string | null;
    toStatus: string;
    issueCycle: number;
    opmcId?: string | null;
    storeId?: string | null;
    contractorId?: string | null;
    serviceOrderId?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    sltReference?: string | null;
    reason?: string | null;
    performedById?: string | null;
}

/**
 * Append one entry to the CPE serial history (CpeSerialEvent). The table is append-only (database trigger) and every entry carries a SHA-256
 * checksum over its content and the previous entry's checksum, so a changed or removed entry breaks the chain (same idea as InventoryLedger).
 * Must run inside the transaction that changes the serial. One writer at a time (transaction-level advisory lock) keeps the chain linear.
 */
export async function recordCpeEvent(tx: Tx, e: CpeEventInput): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cpe_serial_event_chain'))`;
    const last = await tx.cpeSerialEvent.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { checksum: true } });
    const previousChecksum = last?.checksum ?? 'GENESIS';
    const createdAt = new Date();
    const payload = [
        e.serialId, e.serialNumber, e.eventType, e.fromStatus ?? '', e.toStatus, e.issueCycle, e.opmcId ?? '', e.storeId ?? '', e.contractorId ?? '',
        e.serviceOrderId ?? '', e.documentType ?? '', e.documentNumber ?? '', e.performedById ?? '', createdAt.toISOString(), previousChecksum,
    ].join('|');
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');
    await tx.cpeSerialEvent.create({
        data: {
            serialId: e.serialId, serialNumber: e.serialNumber, eventType: e.eventType, fromStatus: e.fromStatus, toStatus: e.toStatus, issueCycle: e.issueCycle,
            opmcId: e.opmcId ?? null, storeId: e.storeId ?? null, contractorId: e.contractorId ?? null, serviceOrderId: e.serviceOrderId ?? null,
            documentType: e.documentType ?? null, documentNumber: e.documentNumber ?? null, sltReference: e.sltReference ?? null, reason: e.reason ?? null,
            performedById: e.performedById ?? null, createdAt, previousChecksum, checksum,
        },
    });
}
