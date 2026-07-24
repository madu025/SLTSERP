import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { TransactionClient } from './types';

export class SerialTrackingService {
  /**
   * Register new serial numbers during GRN / Store receipt
   */
  static async registerSerials(
    data: {
      itemId: string;
      storeId: string;
      serials: string[];
    },
    tx?: TransactionClient
  ) {
    const client = tx || prisma;
    const { itemId, storeId, serials } = data;

    if (!serials || serials.length === 0) return [];

    const existingSerials = await client.inventoryItemSerial.findMany({
      where: { serialNumber: { in: serials } },
      select: { serialNumber: true }
    });

    if (existingSerials.length > 0) {
      const existingList = existingSerials.map((s) => s.serialNumber).join(', ');
      throw AppError.badRequest(`DUPLICATE_SERIAL_NUMBERS: ${existingList}`);
    }

    const records = serials.map((sn) => ({
      itemId,
      serialNumber: sn.trim().toUpperCase(),
      storeId,
      status: 'IN_STORE'
    }));

    return await client.inventoryItemSerial.createMany({
      data: records
    });
  }

  /**
   * Dispatch serial numbers from central store to contractor store
   */
  static async dispatchSerialsToContractor(
    data: {
      contractorId: string;
      storeId: string;
      serials: string[];
    },
    tx?: TransactionClient
  ) {
    const client = tx || prisma;
    const { contractorId, serials } = data;

    if (!serials || serials.length === 0) return;

    // Verify all serials are currently IN_STORE
    const found = await client.inventoryItemSerial.findMany({
      where: {
        serialNumber: { in: serials.map((s) => s.trim().toUpperCase()) }
      }
    });

    const unassigned = serials.filter(
      (sn) => !found.some((f) => f.serialNumber === sn.trim().toUpperCase() && f.status === 'IN_STORE')
    );

    if (unassigned.length > 0) {
      throw AppError.badRequest(
        `SERIALS_NOT_AVAILABLE_IN_STORE: ${unassigned.join(', ')}`
      );
    }

    await client.inventoryItemSerial.updateMany({
      where: { serialNumber: { in: serials.map((s) => s.trim().toUpperCase()) } },
      data: {
        contractorId,
        status: 'ISSUED'
      }
    });
  }

  /**
   * Complete SOD installation - transition serial number from ISSUED to INSTALLED
   */
  static async markSerialInstalled(
    data: {
      serialNumber: string;
      serviceOrderId: string;
      contractorId?: string;
    },
    tx?: TransactionClient
  ) {
    const client = tx || prisma;
    const cleanSerial = data.serialNumber.trim().toUpperCase();

    const existing = await client.inventoryItemSerial.findUnique({
      where: { serialNumber: cleanSerial }
    });

    if (!existing) {
      // Create auto-provisioned serial record if legacy/unregistered item, marked as INSTALLED
      const firstItem = await client.inventoryItem.findFirst({ select: { id: true } });
      if (!firstItem) return null;

      return await client.inventoryItemSerial.create({
        data: {
          itemId: firstItem.id,
          serialNumber: cleanSerial,
          contractorId: data.contractorId,
          sodId: data.serviceOrderId,
          status: 'INSTALLED'
        }
      });
    }

    if (existing.status === 'INSTALLED') {
      throw AppError.badRequest(
        `SERIAL_ALREADY_INSTALLED: Serial ${cleanSerial} was previously installed on SOD ${existing.sodId}`
      );
    }

    return await client.inventoryItemSerial.update({
      where: { serialNumber: cleanSerial },
      data: {
        status: 'INSTALLED',
        sodId: data.serviceOrderId
      }
    });
  }
}
