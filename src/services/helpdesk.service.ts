import { AppError } from '@/lib/error';

import { HelpdeskRepository } from '@/repositories/helpdesk.repository';
import { AuditService } from '@/services/audit.service';
import { NotificationService } from '@/services/notification.service';
import { prisma } from '@/lib/prisma';
import { Prisma, TicketStatus, TicketPriority, IssueCategory, ITDeviceType, ITAssetStatus } from '@prisma/client';
const prismaDb = prisma as unknown as { iTAssetUnit: Prisma.ITAssetUnitDelegate };
type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
import bcrypt from 'bcryptjs';

const REPAIR_CATEGORIES = [
  'PHYSICAL_DAMAGE',
  'BROKEN_DISPLAY',
  'PRINTER_ISSUE',
  'HARDWARE_REPLACEMENT',
  'AUDIO_SPEAKER_ISSUE',
  'HOUSING_BODY_DAMAGE'
];

export class HelpdeskService {
  // ==========================================
  // IT ASSETS BUSINESS LOGIC
  // ==========================================

  static async getAssetById(id: string) {
    return HelpdeskRepository.findAssetById(id);
  }

  static async ensureUserAccountForStaff(
    staffId: string,
    tx?: TxClient
  ) {
    const db = tx || prisma;

    // Fetch Staff details
    const staff = await db.staff.findUnique({
      where: { id: staffId }
    });
    if (!staff) return;

    // Check if a User account is already linked
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { staffId: staff.id },
          { username: staff.employeeId.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      const updates: Prisma.UserUncheckedUpdateInput = {};
      if (!existingUser.staffId) {
        updates.staffId = staff.id;
      }
      if (existingUser.name !== staff.name) {
        updates.name = staff.name;
      }
      if (Object.keys(updates).length > 0) {
        await db.user.update({
          where: { id: existingUser.id },
          data: updates
        });
      }
      return;
    }

    // Auto-provision new User profile
    const defaultUsername = staff.employeeId.toLowerCase();
    const defaultEmail = `${defaultUsername}@slt.lk`;
    const hashedPassword = await bcrypt.hash(staff.employeeId, 10);

    await db.user.create({
      data: {
        username: defaultUsername,
        email: defaultEmail,
        password: hashedPassword,
        name: staff.name,
        role: 'ENGINEER',
        mustChangePassword: true,
        staffId: staff.id
      }
    });
  }

  static async getAssets(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ITAssetStatus;
    deviceType?: ITDeviceType;
    assignedStaffId?: string;
  }) {
    return HelpdeskRepository.findAllAssets(params);
  }

  static async createAsset(
    userId: string,
    data: {
      assetNumber: string;
      serialNumber: string;
      deviceType: ITDeviceType;
      brand: string;
      model: string;
      assignedStaffId?: string | null;
      department?: string | null;
      siteOfficeId?: string | null;
      location?: string | null;
      status?: ITAssetStatus;
      purchaseDate?: string | Date | null;
      warrantyExpiry?: string | Date | null;
      purchaseCost?: number | null;
      newCustodianName?: string | null;
      newCustodianEmpNo?: string | null;
      imei2?: string | null;
      simNumber?: string | null;
      mdmEnrolled?: boolean | null;
      physicallyInStores?: boolean | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    // Check if asset number is already taken
    const existingAssetNo = await HelpdeskRepository.findAssetByAssetNumber(data.assetNumber);
    if (existingAssetNo) {
      throw AppError.badRequest('ASSET_NUMBER_TAKEN');
    }

    // Check if serial number is already taken
    const existingSerial = await HelpdeskRepository.findAssetBySerialNumber(data.serialNumber);
    if (existingSerial) {
      throw AppError.badRequest('SERIAL_NUMBER_TAKEN');
    }

    const asset = await prisma.$transaction(async (tx) => {
      let finalAssignedStaffId = data.assignedStaffId;

      // Handle on-the-fly unregistered custodian creation
      if (data.newCustodianName && data.newCustodianEmpNo) {
        const cleanEmpNo = data.newCustodianEmpNo.trim();
        const cleanName = data.newCustodianName.trim();
        
        let staff = await tx.staff.findUnique({
          where: { employeeId: cleanEmpNo }
        });

        if (!staff) {
          staff = await tx.staff.create({
            data: {
              name: cleanName,
              employeeId: cleanEmpNo,
              designation: "ENGINEER"
            }
          });
        } else if (staff.name.trim() !== cleanName) {
          staff = await tx.staff.update({
            where: { id: staff.id },
            data: { name: cleanName }
          });
        }
        finalAssignedStaffId = staff.id;
      }

      const created = await HelpdeskRepository.createAsset({
        assetNumber: data.assetNumber,
        serialNumber: data.serialNumber,
        deviceType: data.deviceType,
        brand: data.brand,
        model: data.model,
        assignedStaffId: finalAssignedStaffId === null ? null : (finalAssignedStaffId || undefined),
        department: data.department || undefined,
        siteOfficeId: data.siteOfficeId || undefined,
        location: data.location || undefined,
        status: data.status || 'ACTIVE',
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined,
        purchaseCost: data.purchaseCost ?? undefined,
        imei2: data.imei2 || undefined,
        simNumber: data.simNumber || undefined,
        mdmEnrolled: data.mdmEnrolled ?? undefined,
        physicallyInStores: data.physicallyInStores ?? undefined
      }, tx);

      if (finalAssignedStaffId) {
        await HelpdeskService.ensureUserAccountForStaff(finalAssignedStaffId, tx);
      }

      return created;
    }, {
      timeout: 15000
    });

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'ITAsset',
      entityId: asset.id,
      newValue: asset,
      ipAddress,
      userAgent
    });

    return asset;
  }

  static async updateAsset(
    userId: string,
    id: string,
    data: {
      assetNumber?: string;
      serialNumber?: string;
      deviceType?: ITDeviceType;
      brand?: string;
      model?: string;
      assignedStaffId?: string | null;
      department?: string | null;
      siteOfficeId?: string | null;
      location?: string | null;
      status?: ITAssetStatus;
      purchaseDate?: string | Date | null;
      warrantyExpiry?: string | Date | null;
      purchaseCost?: number | null;
      agreementReceived?: boolean | null;
      newCustodianName?: string | null;
      newCustodianEmpNo?: string | null;
      isExchange?: boolean | null;
      oldLaptopSerial?: string | null;
      oldLaptopStatus?: string | null;
      repairRemarks?: string | null;
      imei2?: string | null;
      simNumber?: string | null;
      mdmEnrolled?: boolean | null;
      physicallyInStores?: boolean | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const oldAsset = await HelpdeskRepository.findAssetById(id);
    if (!oldAsset) {
      throw AppError.badRequest('ASSET_NOT_FOUND');
    }

    // If updating assetNumber/serialNumber, check uniqueness
    if (data.assetNumber && data.assetNumber !== oldAsset.assetNumber) {
      const existing = await HelpdeskRepository.findAssetByAssetNumber(data.assetNumber);
      if (existing) throw AppError.badRequest('ASSET_NUMBER_TAKEN');
    }
    if (data.serialNumber && data.serialNumber !== oldAsset.serialNumber) {
      const existing = await HelpdeskRepository.findAssetBySerialNumber(data.serialNumber);
      if (existing) throw AppError.badRequest('SERIAL_NUMBER_TAKEN');
    }

    const updated = await prisma.$transaction(async (tx) => {
      let finalAssignedStaffId = data.assignedStaffId;

      // Handle Laptop Exchange logic
      if (data.isExchange && data.oldLaptopSerial) {
        const cleanOldSerial = data.oldLaptopSerial.trim();
        const oldCustodianId = oldAsset.assignedStaffId;

        if (oldCustodianId) {
          // Check if old laptop already exists
          let oldLaptop = await tx.iTAsset.findUnique({
            where: { serialNumber: cleanOldSerial }
          });

          if (!oldLaptop) {
            // Create the old laptop in database for history preservation
            oldLaptop = await tx.iTAsset.create({
              data: {
                assetNumber: `OLD-LAP-${cleanOldSerial}`,
                serialNumber: cleanOldSerial,
                deviceType: 'LAPTOP',
                brand: oldAsset.brand || 'HP',
                model: oldAsset.model || 'Notebook',
                assignedStaffId: oldCustodianId,
                department: oldAsset.department,
                siteOfficeId: oldAsset.siteOfficeId,
                location: oldAsset.location,
                status: (data.oldLaptopStatus as any) || 'DECOMMISSIONED',
                purchaseCost: null,
                agreementReceived: true
              }
            });

            // Write initial issue log to user for history
            await tx.assetHandoverLog.create({
              data: {
                assetId: oldLaptop.id,
                transactionType: 'ISSUED_TO_USER',
                performedById: userId,
                targetStaffId: oldCustodianId,
                condition: 'Used',
                remarks: 'Historical registry during exchange'
              }
            });
          }

          // Return old laptop to store (update assignedStaffId to null and status to oldLaptopStatus)
          await tx.iTAsset.update({
            where: { id: oldLaptop.id },
            data: {
              assignedStaffId: null,
              status: (data.oldLaptopStatus as any) || 'DECOMMISSIONED'
            }
          });

          // Write handover log for return
          await tx.assetHandoverLog.create({
            data: {
              assetId: oldLaptop.id,
              transactionType: 'RETURNED_TO_STORE',
              performedById: userId,
              targetStaffId: oldCustodianId,
              condition: 'Returned during exchange',
              remarks: `Exchanged for new laptop: ${data.assetNumber || oldAsset.assetNumber}`
            }
          });
        }
      }

      // Handle on-the-fly unregistered custodian creation
      if (data.newCustodianName && data.newCustodianEmpNo) {
        const cleanEmpNo = data.newCustodianEmpNo.trim();
        const cleanName = data.newCustodianName.trim();
        
        let staff = await tx.staff.findUnique({
          where: { employeeId: cleanEmpNo }
        });

        if (!staff) {
          staff = await tx.staff.create({
            data: {
              name: cleanName,
              employeeId: cleanEmpNo,
              designation: "ENGINEER"
            }
          });
        } else if (staff.name.trim() !== cleanName) {
          staff = await tx.staff.update({
            where: { id: staff.id },
            data: { name: cleanName }
          });
        }
        finalAssignedStaffId = staff.id;
      }

      const updatedAsset = await HelpdeskRepository.updateAsset(id, {
        assetNumber: data.assetNumber,
        serialNumber: data.serialNumber,
        deviceType: data.deviceType,
        brand: data.brand,
        model: data.model,
        assignedStaffId: finalAssignedStaffId === null ? null : (finalAssignedStaffId || undefined),
        department: data.department === null ? null : (data.department || undefined),
        siteOfficeId: data.siteOfficeId === null ? null : (data.siteOfficeId || undefined),
        location: data.location === null ? null : (data.location || undefined),
        status: data.status,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : (data.purchaseDate === null ? null : undefined),
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : (data.warrantyExpiry === null ? null : undefined),
        purchaseCost: data.purchaseCost === null ? null : data.purchaseCost,
        agreementReceived: data.agreementReceived === null ? null : (data.agreementReceived ?? undefined),
        repairRemarks: data.status === 'UNDER_REPAIR' ? (data.repairRemarks === null ? null : (data.repairRemarks || undefined)) : null,
        imei2: data.imei2 === null ? null : (data.imei2 || undefined),
        simNumber: data.simNumber === null ? null : (data.simNumber || undefined),
        mdmEnrolled: data.mdmEnrolled === null ? null : (data.mdmEnrolled ?? undefined),
        physicallyInStores: data.physicallyInStores === null ? null : (data.physicallyInStores ?? undefined)
      } as unknown as Parameters<typeof HelpdeskRepository.updateAsset>[1], tx);

      // Process Laptop Exchange Logic (Old Device Return)
      if (data.isExchange && data.oldLaptopSerial) {
        const oldLaptop = await tx.iTAsset.findFirst({
          where: {
            serialNumber: {
              equals: data.oldLaptopSerial,
              mode: 'insensitive'
            }
          }
        });

        if (oldLaptop) {
          const finalOldStatus = (data.oldLaptopStatus || 'DECOMMISSIONED') as import('@prisma/client').ITAssetStatus;
          
          // 1. Update the old laptop custodian & status
          await tx.iTAsset.update({
            where: { id: oldLaptop.id },
            data: {
              assignedStaffId: null,
              status: finalOldStatus,
              physicallyInStores: true
            }
          });

          // 2. Create handover log for the old laptop (Return to Store)
          await tx.assetHandoverLog.create({
            data: {
              assetId: oldLaptop.id,
              transactionType: 'RETURNED_TO_STORE',
              performedById: userId,
              targetStaffId: oldAsset.assignedStaffId || null,
              condition: data.oldLaptopStatus || 'DECOMMISSIONED',
              remarks: `Returned via device exchange for S/N: ${data.serialNumber || oldAsset.serialNumber}`
            }
          });
        }

        // 3. Create handover log for the current (new) asset to record exchange
        if (oldAsset.assignedStaffId || finalAssignedStaffId) {
          await tx.assetHandoverLog.create({
            data: {
              assetId: id,
              transactionType: 'EXCHANGED',
              performedById: userId,
              targetStaffId: finalAssignedStaffId || oldAsset.assignedStaffId || '',
              condition: 'Good',
              remarks: `Exchanged with old laptop S/N: ${data.oldLaptopSerial}`
            }
          });
        }
      }

      if (finalAssignedStaffId) {
        await HelpdeskService.ensureUserAccountForStaff(finalAssignedStaffId, tx);
      }

      return updatedAsset;
    }, {
      timeout: 15000
    });

    // Audit Log
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'ITAsset',
      entityId: id,
      oldValue: oldAsset,
      newValue: updated,
      ipAddress,
      userAgent
    });

    return updated;
  }

  static async deleteAsset(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const oldAsset = await HelpdeskRepository.findAssetById(id);
    if (!oldAsset) {
      throw AppError.badRequest('ASSET_NOT_FOUND');
    }

    const result = await HelpdeskRepository.deleteAsset(id);

    // Audit Log
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'ITAsset',
      entityId: id,
      oldValue: oldAsset,
      ipAddress,
      userAgent
    });

    return result;
  }

  // ==========================================
  // IT ASSET UNITS BUSINESS LOGIC
  // ==========================================

  static async createAssetUnit(
    userId: string,
    assetId: string,
    data: {
      serialNumber: string;
      unitNumber?: string | null;
      status?: string;
      assignedStaffId?: string | null;
      remarks?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prismaDb.iTAssetUnit.findUnique({
      where: { serialNumber: data.serialNumber }
    });
    if (existing) {
      throw AppError.badRequest('SERIAL_NUMBER_TAKEN');
    }

    if (data.unitNumber) {
      const existingUnitNo = await prismaDb.iTAssetUnit.findUnique({
        where: { unitNumber: data.unitNumber }
      });
      if (existingUnitNo) {
        throw AppError.badRequest('UNIT_NUMBER_TAKEN');
      }
    }

    const unit = await prismaDb.iTAssetUnit.create({
      data: {
        assetId,
        serialNumber: data.serialNumber,
        unitNumber: data.unitNumber || null,
        status: data.status || 'IN_HAND_STORES',
        assignedStaffId: data.assignedStaffId || null,
        remarks: data.remarks || null
      },
      include: {
        assignedStaff: {
          select: { id: true, name: true, employeeId: true }
        }
      }
    });

    if (data.assignedStaffId) {
      await HelpdeskService.ensureUserAccountForStaff(data.assignedStaffId);
    }

    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'ITAssetUnit' as unknown as 'ITAsset',
      entityId: unit.id,
      newValue: unit,
      ipAddress,
      userAgent
    });

    return unit;
  }

  static async updateAssetUnit(
    userId: string,
    unitId: string,
    data: {
      serialNumber?: string;
      unitNumber?: string | null;
      status?: string;
      assignedStaffId?: string | null;
      remarks?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const old = await prismaDb.iTAssetUnit.findUnique({
      where: { id: unitId }
    });
    if (!old) {
      throw AppError.badRequest('UNIT_NOT_FOUND');
    }

    if (data.serialNumber && data.serialNumber !== old.serialNumber) {
      const existing = await prismaDb.iTAssetUnit.findUnique({
        where: { serialNumber: data.serialNumber }
      });
      if (existing) {
        throw AppError.badRequest('SERIAL_NUMBER_TAKEN');
      }
    }

    if (data.unitNumber && data.unitNumber !== old.unitNumber) {
      const existing = await prismaDb.iTAssetUnit.findUnique({
        where: { unitNumber: data.unitNumber }
      });
      if (existing) {
        throw AppError.badRequest('UNIT_NUMBER_TAKEN');
      }
    }

    const unit = await prismaDb.iTAssetUnit.update({
      where: { id: unitId },
      data: {
        serialNumber: data.serialNumber,
        unitNumber: data.unitNumber,
        status: data.status,
        assignedStaffId: data.assignedStaffId,
        remarks: data.remarks
      },
      include: {
        assignedStaff: {
          select: { id: true, name: true, employeeId: true }
        }
      }
    });

    if (data.assignedStaffId && data.assignedStaffId !== old.assignedStaffId) {
      await HelpdeskService.ensureUserAccountForStaff(data.assignedStaffId);
    }

    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'ITAssetUnit' as unknown as 'ITAsset',
      entityId: unit.id,
      oldValue: old,
      newValue: unit,
      ipAddress,
      userAgent
    });

    return unit;
  }

  static async deleteAssetUnit(
    userId: string,
    unitId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const old = await prismaDb.iTAssetUnit.findUnique({
      where: { id: unitId }
    });
    if (!old) {
      throw AppError.badRequest('UNIT_NOT_FOUND');
    }

    await prismaDb.iTAssetUnit.delete({
      where: { id: unitId }
    });

    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'ITAssetUnit' as unknown as 'ITAsset',
      entityId: unitId,
      oldValue: old,
      ipAddress,
      userAgent
    });

    return { id: unitId };
  }

  // ==========================================
  // ASSET HANDOVER / TAKEOVER LOGIC
  // ==========================================

  static async logAssetHandover(
    userId: string,
    assetId: string,
    data: {
      transactionType: 'ISSUED_TO_USER' | 'RETURNED_TO_STORE' | 'EXCHANGED';
      targetStaffId?: string | null;
      condition?: string | null;
      remarks?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const asset = await HelpdeskRepository.findAssetById(assetId);
    if (!asset) throw AppError.badRequest('ASSET_NOT_FOUND');

    const log = await prisma.$transaction(async (tx) => {
      // Create handover log
      const createdLog = await tx.assetHandoverLog.create({
        data: {
          assetId,
          transactionType: data.transactionType,
          performedById: userId,
          targetStaffId: data.targetStaffId || null,
          condition: data.condition || null,
          remarks: data.remarks || null
        }
      });

      // Update asset assignment dynamically based on transaction
      if ((data.transactionType === 'ISSUED_TO_USER' || data.transactionType === 'EXCHANGED') && data.targetStaffId) {
        await tx.iTAsset.update({
          where: { id: assetId },
          data: { assignedStaffId: data.targetStaffId }
        });
        await HelpdeskService.ensureUserAccountForStaff(data.targetStaffId, tx);
      } else if (data.transactionType === 'RETURNED_TO_STORE') {
        await tx.iTAsset.update({
          where: { id: assetId },
          data: { assignedStaffId: null }
        });
      }

      return createdLog;
    }, {
      timeout: 15000
    });

    // Audit Log (executed outside the transaction transaction to prevent pool starvation deadlock)
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'AssetHandoverLog' as unknown as 'ITAsset',
      entityId: log.id,
      newValue: log,
      ipAddress,
      userAgent
    });

    return log;
  }

  // ==========================================

  // HELP DESK TICKETS BUSINESS LOGIC
  // ==========================================

  static async getTicketById(id: string) {
    return HelpdeskRepository.findTicketById(id);
  }

  static async getTickets(params: {
    page?: number;
    limit?: number;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: IssueCategory;
    userId?: string;
    assignedToId?: string;
    search?: string;
  }) {
    return HelpdeskRepository.findAllTickets(params);
  }

  static async createTicket(
    userId: string,
    data: {
      assetId?: string | null;
      category?: IssueCategory;
      description?: string | null;
      priority?: TicketPriority;
      anydeskId?: string | null;
      photoUrls?: string[];
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    // Generate Ticket Number: IT-YYYYMMDD-XXXX
    const countToday = await HelpdeskRepository.countTicketsToday();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(countToday + 1).padStart(4, '0');
    const ticketNumber = `IT-${dateStr}-${seq}`;

    // Calculate SLA Targets based on Ticket Priority
    const now = new Date();
    let responseHours = 4; // default MEDIUM
    let resolutionHours = 24; // default MEDIUM
    const priority = data.priority || 'MEDIUM';

    if (priority === 'CRITICAL') {
      responseHours = 1;
      resolutionHours = 4;
    } else if (priority === 'HIGH') {
      responseHours = 2;
      resolutionHours = 8;
    } else if (priority === 'MEDIUM') {
      responseHours = 4;
      resolutionHours = 24;
    } else if (priority === 'LOW') {
      responseHours = 8;
      resolutionHours = 72;
    }

    const slaResponseDeadline = new Date(now.getTime() + responseHours * 60 * 60 * 1000);
    const slaResolutionDeadline = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);

    // Create the ticket inside transaction
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await HelpdeskRepository.createTicket(
        {
          ticketNumber,
          assetId: data.assetId || undefined,
          userId,
          category: data.category || 'OTHER',
          description: data.description || 'No description provided.',
          priority,
          anydeskId: data.anydeskId || undefined,
          photoUrls: data.photoUrls || [],
          slaResponseDeadline,
          slaResolutionDeadline
        } as any,
        tx
      );

      // If the ticket has a linked asset and the category is hardware-related, auto-transition the asset to UNDER_REPAIR
      if (data.assetId && REPAIR_CATEGORIES.includes(data.category || 'OTHER')) {
        await tx.iTAsset.update({
          where: { id: data.assetId },
          data: {
            status: 'UNDER_REPAIR',
            repairRemarks: `[Ticket ${ticketNumber}] ${data.description || 'Under Repair'}`
          }
        });
      }

      // Create initial timeline entry
      await HelpdeskRepository.createTicketUpdate(
        {
          ticketId: created.id,
          userId,
          message: 'Ticket successfully created and opened.',
          statusFrom: 'OPEN',
          statusTo: 'OPEN'
        },
        tx
      );

      return created;
    }, {
      timeout: 15000
    });

    // Notify User
    await NotificationService.send({
      userId,
      title: 'Ticket Submitted',
      message: `Your IT support ticket ${ticket.ticketNumber} has been successfully created.`,
      type: 'HELPDESK',
      priority: 'LOW',
      link: `/helpdesk`
    });

    // Notify IT Staff / Engineers (Role ENGINEER, ADMIN)
    await NotificationService.notifyByRole({
      roles: ['ENGINEER', 'ADMIN', 'SUPER_ADMIN'],
      title: 'New Help Desk Ticket',
      message: `A new ${ticket.priority} priority ticket (${ticket.ticketNumber}) has been submitted: "${ticket.description.substring(0, 50)}..."`,
      type: 'HELPDESK',
      priority: ticket.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      link: `/helpdesk/admin`
    });

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'Ticket',
      entityId: ticket.id,
      newValue: ticket,
      ipAddress,
      userAgent
    });

    return ticket;
  }

  static async updateTicket(
    userId: string,
    id: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedToId?: string | null;
      anydeskId?: string | null;
      anydeskSession?: string | null;
      satisfactionRating?: number | null;
      satisfactionNote?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const oldTicket = await HelpdeskRepository.findTicketById(id);
    if (!oldTicket) {
      throw AppError.badRequest('TICKET_NOT_FOUND');
    }

    // Determine status log message
    const updates: string[] = [];
    const statusFrom = oldTicket.status as TicketStatus;
    const statusTo = data.status || statusFrom;

    if (data.status && data.status !== oldTicket.status) {
      updates.push(`Status changed from ${oldTicket.status} to ${data.status}`);
    }
    if (data.priority && data.priority !== oldTicket.priority) {
      updates.push(`Priority changed from ${oldTicket.priority} to ${data.priority}`);
    }
    if (data.assignedToId !== undefined && data.assignedToId !== oldTicket.assignedToId) {
      if (data.assignedToId) {
        // Fetch assignee details for notification
        const assignee = await prisma.user.findUnique({
          where: { id: data.assignedToId },
          select: { name: true }
        });
        updates.push(`Assigned to ${assignee?.name || 'Engineer'}`);
      } else {
        updates.push(`Unassigned`);
      }
    }
    if (data.anydeskId && data.anydeskId !== oldTicket.anydeskId) {
      updates.push(`AnyDesk ID set to ${data.anydeskId}`);
    }
    if (data.satisfactionRating !== undefined) {
      updates.push(`User submitted rating: ${data.satisfactionRating}/5`);
    }

    const message = updates.length > 0 ? updates.join(', ') : 'Ticket details updated';

    // Calculate SLA timestamps
    let firstResponseAt: Date | undefined = undefined;
    let resolvedAt: Date | null | undefined = undefined;

    // First Response: when changing from OPEN to IN_PROGRESS or ASSIGNED for the first time
    let slaResponseBreached: boolean | undefined = undefined;
    if (
      !oldTicket.firstResponseAt &&
      oldTicket.status === 'OPEN' &&
      (statusTo === 'IN_PROGRESS' || statusTo === 'ASSIGNED')
    ) {
      firstResponseAt = new Date();
      if (oldTicket.slaResponseDeadline) {
        slaResponseBreached = firstResponseAt.getTime() > new Date(oldTicket.slaResponseDeadline).getTime();
      }
    }

    // Resolution time: when status changes to RESOLVED or CLOSED for the first time
    let slaResolutionBreached: boolean | undefined = undefined;
    if (
      !oldTicket.resolvedAt &&
      (statusTo === 'RESOLVED' || statusTo === 'CLOSED')
    ) {
      resolvedAt = new Date();
      if (oldTicket.slaResolutionDeadline) {
        slaResolutionBreached = resolvedAt.getTime() > new Date(oldTicket.slaResolutionDeadline).getTime();
      }
    } else if (
      oldTicket.resolvedAt &&
      (statusTo === 'OPEN' || statusTo === 'IN_PROGRESS')
    ) {
      resolvedAt = null; // Reopened, clear resolvedAt
      slaResolutionBreached = false;
    }

    // Dynamic SLA Deadlines update on priority change (only if not already met)
    let slaResponseDeadline: Date | undefined = undefined;
    let slaResolutionDeadline: Date | undefined = undefined;

    if (data.priority && data.priority !== oldTicket.priority) {
      const priority = data.priority;
      let responseHours = 4;
      let resolutionHours = 24;
      if (priority === 'CRITICAL') {
        responseHours = 1;
        resolutionHours = 4;
      } else if (priority === 'HIGH') {
        responseHours = 2;
        resolutionHours = 8;
      } else if (priority === 'MEDIUM') {
        responseHours = 4;
        resolutionHours = 24;
      } else if (priority === 'LOW') {
        responseHours = 8;
        resolutionHours = 72;
      }

      const created = new Date(oldTicket.createdAt);
      if (!oldTicket.firstResponseAt) {
        slaResponseDeadline = new Date(created.getTime() + responseHours * 60 * 60 * 1000);
      }
      if (!oldTicket.resolvedAt) {
        slaResolutionDeadline = new Date(created.getTime() + resolutionHours * 60 * 60 * 1000);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ticketRes = await HelpdeskRepository.updateTicket(
        id,
        {
          status: data.status,
          priority: data.priority,
          assignedToId: data.assignedToId === null ? null : (data.assignedToId || undefined),
          anydeskId: data.anydeskId === null ? null : (data.anydeskId || undefined),
          anydeskSession: data.anydeskSession === null ? null : (data.anydeskSession || undefined),
          satisfactionRating: data.satisfactionRating === null ? null : data.satisfactionRating,
          satisfactionNote: data.satisfactionNote === null ? null : data.satisfactionNote,
          firstResponseAt: firstResponseAt || undefined,
          resolvedAt: resolvedAt !== undefined ? resolvedAt : undefined,
          slaResponseBreached,
          slaResolutionBreached,
          slaResponseDeadline,
          slaResolutionDeadline
        } as unknown as Parameters<typeof HelpdeskRepository.updateTicket>[1],
        tx
      );

      // Create update timeline entry
      await HelpdeskRepository.createTicketUpdate(
        {
          ticketId: id,
          userId,
          message,
          statusFrom,
          statusTo
        },
        tx
      );

      // Handle asset status transition on ticket status changes
      if (oldTicket.assetId) {
        const isResolvedOrClosed = statusTo === 'RESOLVED' || statusTo === 'CLOSED';
        const isReopened = (statusTo === 'OPEN' || statusTo === 'IN_PROGRESS') && (statusFrom === 'RESOLVED' || statusFrom === 'CLOSED');

        if (isResolvedOrClosed) {
          const asset = await tx.iTAsset.findUnique({ where: { id: oldTicket.assetId } });
          if (asset && asset.status === 'UNDER_REPAIR') {
            const nextStatus = asset.assignedStaffId ? 'ACTIVE' : 'SPARE';
            await tx.iTAsset.update({
              where: { id: oldTicket.assetId },
              data: {
                status: nextStatus,
                repairRemarks: `Repaired & resolved via ticket ${oldTicket.ticketNumber}.`
              }
            });
          }
        } else if (isReopened) {
          await tx.iTAsset.update({
            where: { id: oldTicket.assetId },
            data: {
              status: 'UNDER_REPAIR',
              repairRemarks: `Reopened via ticket ${oldTicket.ticketNumber}.`
            }
          });
        }
      }

      return ticketRes;
    }, {
      timeout: 15000
    });

    // Notify user if status changed or engineer was assigned
    if (data.status && data.status !== oldTicket.status) {
      await NotificationService.send({
        userId: oldTicket.userId,
        title: 'Ticket Status Updated',
        message: `Your ticket ${oldTicket.ticketNumber} is now "${data.status}".`,
        type: 'HELPDESK',
        priority: 'MEDIUM',
        link: `/helpdesk`
      });
    }

    if (data.assignedToId && data.assignedToId !== oldTicket.assignedToId) {
      // Notify Assigned Engineer
      await NotificationService.send({
        userId: data.assignedToId,
        title: 'New Helpdesk Assignment',
        message: `You have been assigned ticket ${oldTicket.ticketNumber}.`,
        type: 'HELPDESK',
        priority: 'MEDIUM',
        link: `/helpdesk/admin`
      });
    }

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Ticket',
      entityId: id,
      oldValue: oldTicket,
      newValue: updated,
      ipAddress,
      userAgent
    });

    return updated;
  }

  static async addTicketComment(
    userId: string,
    ticketId: string,
    data: {
      message: string;
      statusTo?: TicketStatus;
      photoUrls?: string[];
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const ticket = await HelpdeskRepository.findTicketById(ticketId);
    if (!ticket) {
      throw AppError.badRequest('TICKET_NOT_FOUND');
    }

    const statusFrom = ticket.status as TicketStatus;
    let statusTo = data.statusTo || statusFrom;

    // Auto-reopen ticket if the ticket creator posts a comment on a resolved/closed/waiting ticket
    if (
      userId === ticket.userId &&
      (statusFrom === 'RESOLVED' || statusFrom === 'CLOSED' || statusFrom === 'WAITING_FOR_USER') &&
      !data.statusTo
    ) {
      statusTo = ticket.assignedToId ? 'IN_PROGRESS' : 'OPEN';
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create comment update
      const update = await HelpdeskRepository.createTicketUpdate(
        {
          ticketId,
          userId,
          message: data.message,
          statusFrom,
          statusTo,
          photoUrls: data.photoUrls || []
        },
        tx
      );

      // Determine update payload
      const updatePayload: Record<string, unknown> = {};
      let needsUpdate = false;

      if (statusTo !== statusFrom) {
        updatePayload.status = statusTo;
        needsUpdate = true;
      }

      // Check for first response by staff (commenter is not ticket owner)
      if (!ticket.firstResponseAt && userId !== ticket.userId) {
        const responseTime = new Date();
        updatePayload.firstResponseAt = responseTime;
        needsUpdate = true;
        if (ticket.slaResponseDeadline) {
          updatePayload.slaResponseBreached = responseTime.getTime() > new Date(ticket.slaResponseDeadline).getTime();
        }
      } else if (
        !ticket.firstResponseAt &&
        statusFrom === 'OPEN' &&
        (statusTo === 'IN_PROGRESS' || statusTo === 'ASSIGNED')
      ) {
        // Also capture first response if status transitions out of OPEN
        const responseTime = new Date();
        updatePayload.firstResponseAt = responseTime;
        needsUpdate = true;
        if (ticket.slaResponseDeadline) {
          updatePayload.slaResponseBreached = responseTime.getTime() > new Date(ticket.slaResponseDeadline).getTime();
        }
      }

      // Calculate resolvedAt and check resolution breach
      if (statusTo !== statusFrom) {
        if (
          !ticket.resolvedAt &&
          (statusTo === 'RESOLVED' || statusTo === 'CLOSED')
        ) {
          const resolveTime = new Date();
          updatePayload.resolvedAt = resolveTime;
          if (ticket.slaResolutionDeadline) {
            updatePayload.slaResolutionBreached = resolveTime.getTime() > new Date(ticket.slaResolutionDeadline).getTime();
          }
          needsUpdate = true;
        } else if (
          ticket.resolvedAt &&
          (statusTo === 'OPEN' || statusTo === 'IN_PROGRESS')
        ) {
          updatePayload.resolvedAt = null; // Reopened, clear resolvedAt
          updatePayload.slaResolutionBreached = false;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await HelpdeskRepository.updateTicket(ticketId, updatePayload, tx);
      }

      return update;
    });

    // Notify appropriate person
    // If commenter is the customer (ticket creator), notify the assigned engineer or IT team
    if (userId === ticket.userId) {
      if (ticket.assignedToId) {
        await NotificationService.send({
          userId: ticket.assignedToId,
          title: 'New Customer Response',
          message: `User commented on ticket ${ticket.ticketNumber}: "${data.message.substring(0, 30)}..."`,
          type: 'HELPDESK',
          priority: 'MEDIUM',
          link: `/helpdesk/admin`
        });
      }
    } else {
      // Commenter is IT Staff, notify the customer
      await NotificationService.send({
        userId: ticket.userId,
        title: 'New Message from Support',
        message: `Support replied to your ticket ${ticket.ticketNumber}: "${data.message.substring(0, 30)}..."`,
        type: 'HELPDESK',
        priority: 'MEDIUM',
        link: `/helpdesk`
      });
    }

    // Write audit trail
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'TicketUpdate',
      entityId: result.id,
      newValue: result,
      ipAddress,
      userAgent
    });

    return result;
  }

  // ==========================================
  // KNOWLEDGE BASE BUSINESS LOGIC
  // ==========================================

  static async getKBArticles(params: { search?: string; category?: string }) {
    return HelpdeskRepository.findAllKBArticles(params);
  }

  static async getKBArticle(id: string) {
    const article = await HelpdeskRepository.findKBArticleById(id);
    if (!article) return null;

    // Increment view count asynchronously
    HelpdeskRepository.incrementKBArticleViews(id).catch(err => console.error('[KB-VIEW-INC-FAIL]', err));

    return article;
  }

  static async createKBArticle(
    userId: string,
    data: { title: string; content: string; category: string },
    ipAddress?: string,
    userAgent?: string
  ) {
    const article = await HelpdeskRepository.createKBArticle(data);

    // Audit log
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'KnowledgeBaseArticle',
      entityId: article.id,
      newValue: article,
      ipAddress,
      userAgent
    });

    return article;
  }

  static async updateKBArticle(
    userId: string,
    id: string,
    data: { title?: string; content?: string; category?: string },
    ipAddress?: string,
    userAgent?: string
  ) {
    const old = await HelpdeskRepository.findKBArticleById(id);
    if (!old) throw AppError.badRequest('ARTICLE_NOT_FOUND');

    const updated = await HelpdeskRepository.updateKBArticle(id, data);

    // Audit log
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'KnowledgeBaseArticle',
      entityId: id,
      oldValue: old,
      newValue: updated,
      ipAddress,
      userAgent
    });

    return updated;
  }

  static async deleteKBArticle(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const old = await HelpdeskRepository.findKBArticleById(id);
    if (!old) throw AppError.badRequest('ARTICLE_NOT_FOUND');

    const result = await HelpdeskRepository.deleteKBArticle(id);

    // Audit log
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'KnowledgeBaseArticle',
      entityId: id,
      oldValue: old,
      ipAddress,
      userAgent
    });

    return result;
  }

  // ==========================================
  // STATISTICS & REPORTS BUSINESS LOGIC
  // ==========================================

  static async getDashboardReports() {
    const stats = await HelpdeskRepository.getITDashboardStats();
    const deptData = await HelpdeskRepository.getTicketsByDepartment();
    const commonIssues = await HelpdeskRepository.getCommonIssues();

    return {
      ...stats,
      ticketsByDepartment: deptData,
      commonIssues
    };
  }

  // ==========================================
  // SITE OFFICES BUSINESS LOGIC
  // ==========================================

  static async getSiteOffices(params: { page?: number; limit?: number; search?: string }) {
    return HelpdeskRepository.findAllSiteOffices(params);
  }

  static async getSiteOffice(id: string) {
    return HelpdeskRepository.findSiteOfficeById(id);
  }

  static async createSiteOffice(
    userId: string,
    data: {
      name: string;
      address: string;
      officeAdminId?: string | null;
      contactNo?: string | null;
      rentalCost?: number;
      landlordName?: string | null;
      landlordPhone?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await HelpdeskRepository.findSiteOfficeByName(data.name);
    if (existing) {
      throw AppError.badRequest('SITE_OFFICE_NAME_TAKEN');
    }

    const siteOffice = await HelpdeskRepository.createSiteOffice({
      name: data.name,
      address: data.address,
      officeAdminId: data.officeAdminId || undefined,
      contactNo: data.contactNo || undefined,
      rentalCost: data.rentalCost || 0.0,
      landlordName: data.landlordName || undefined,
      landlordPhone: data.landlordPhone || undefined
    });

    // Audit Log
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'SiteOffice',
      entityId: siteOffice.id,
      newValue: siteOffice,
      ipAddress,
      userAgent
    });

    return siteOffice;
  }

  static async updateSiteOffice(
    userId: string,
    id: string,
    data: {
      name?: string;
      address?: string;
      officeAdminId?: string | null;
      contactNo?: string | null;
      rentalCost?: number;
      landlordName?: string | null;
      landlordPhone?: string | null;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const old = await HelpdeskRepository.findSiteOfficeById(id);
    if (!old) {
      throw AppError.badRequest('SITE_OFFICE_NOT_FOUND');
    }

    if (data.name && data.name !== old.name) {
      const existing = await HelpdeskRepository.findSiteOfficeByName(data.name);
      if (existing) throw AppError.badRequest('SITE_OFFICE_NAME_TAKEN');
    }

    const updated = await HelpdeskRepository.updateSiteOffice(id, {
      name: data.name,
      address: data.address,
      officeAdminId: data.officeAdminId === null ? null : (data.officeAdminId || undefined),
      contactNo: data.contactNo === null ? null : (data.contactNo || undefined),
      rentalCost: data.rentalCost,
      landlordName: data.landlordName === null ? null : (data.landlordName || undefined),
      landlordPhone: data.landlordPhone === null ? null : (data.landlordPhone || undefined)
    });

    // Audit Log
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'SiteOffice',
      entityId: id,
      oldValue: old,
      newValue: updated,
      ipAddress,
      userAgent
    });

    return updated;
  }

  static async deleteSiteOffice(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const old = await HelpdeskRepository.findSiteOfficeById(id);
    if (!old) {
      throw AppError.badRequest('SITE_OFFICE_NOT_FOUND');
    }

    const result = await HelpdeskRepository.deleteSiteOffice(id);

    // Audit Log
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'SiteOffice',
      entityId: id,
      oldValue: old,
      ipAddress,
      userAgent
    });

    return result;
  }

  // ==========================================
  // SITE OFFICES SUB-MODULES BUSINESS LOGIC
  // ==========================================

  // Agreements
  static async createAgreement(userId: string, siteOfficeId: string, data: any, ipAddress?: string, userAgent?: string) {
    const agreement = await HelpdeskRepository.createAgreement(siteOfficeId, {
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null
    });
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'SiteOfficeAgreement',
      entityId: agreement.id,
      newValue: agreement,
      ipAddress,
      userAgent
    });
    return agreement;
  }

  static async updateAgreement(userId: string, id: string, data: any, ipAddress?: string, userAgent?: string) {
    const formatted = { ...data };
    if (data.startDate) formatted.startDate = new Date(data.startDate);
    if (data.endDate) formatted.endDate = new Date(data.endDate);
    
    const agreement = await HelpdeskRepository.updateAgreement(id, formatted);
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'SiteOfficeAgreement',
      entityId: id,
      newValue: agreement,
      ipAddress,
      userAgent
    });
    return agreement;
  }

  static async deleteAgreement(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const result = await HelpdeskRepository.deleteAgreement(id);
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'SiteOfficeAgreement',
      entityId: id,
      ipAddress,
      userAgent
    });
    return result;
  }

  // Goods Requests
  static async createOfficeRequest(userId: string, siteOfficeId: string, requestedById: string, data: any, ipAddress?: string, userAgent?: string) {
    const request = await HelpdeskRepository.createOfficeRequest(siteOfficeId, requestedById, data);
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'SiteOfficeRequest',
      entityId: request.id,
      newValue: request,
      ipAddress,
      userAgent
    });
    return request;
  }

  static async updateOfficeRequest(userId: string, id: string, data: any, ipAddress?: string, userAgent?: string) {
    const request = await HelpdeskRepository.updateOfficeRequest(id, data);
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'SiteOfficeRequest',
      entityId: id,
      newValue: request,
      ipAddress,
      userAgent
    });
    return request;
  }

  static async deleteOfficeRequest(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const result = await HelpdeskRepository.deleteOfficeRequest(id);
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'SiteOfficeRequest',
      entityId: id,
      ipAddress,
      userAgent
    });
    return result;
  }

  // Vehicle Pool Allocations
  static async createOfficeVehicle(userId: string, siteOfficeId: string, data: any, ipAddress?: string, userAgent?: string) {
    const vehicle = await HelpdeskRepository.createOfficeVehicle(siteOfficeId, {
      ...data,
      allocationDate: data.allocationDate ? new Date(data.allocationDate) : undefined
    });
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'SiteOfficeVehicle',
      entityId: vehicle.id,
      newValue: vehicle,
      ipAddress,
      userAgent
    });
    return vehicle;
  }

  static async updateOfficeVehicle(userId: string, id: string, data: any, ipAddress?: string, userAgent?: string) {
    const formatted = { ...data };
    if (data.allocationDate) formatted.allocationDate = new Date(data.allocationDate);

    const vehicle = await HelpdeskRepository.updateOfficeVehicle(id, formatted);
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'SiteOfficeVehicle',
      entityId: id,
      newValue: vehicle,
      ipAddress,
      userAgent
    });
    return vehicle;
  }

  static async deleteOfficeVehicle(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const result = await HelpdeskRepository.deleteOfficeVehicle(id);
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'SiteOfficeVehicle',
      entityId: id,
      ipAddress,
      userAgent
    });
    return result;
  }

  // Purchasing Tenders
  static async createOfficeTender(userId: string, siteOfficeId: string, data: any, ipAddress?: string, userAgent?: string) {
    const tender = await HelpdeskRepository.createOfficeTender(siteOfficeId, {
      ...data,
      publishDate: new Date(data.publishDate),
      closingDate: new Date(data.closingDate)
    });
    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'SiteOfficeTender',
      entityId: tender.id,
      newValue: tender,
      ipAddress,
      userAgent
    });
    return tender;
  }

  static async updateOfficeTender(userId: string, id: string, data: any, ipAddress?: string, userAgent?: string) {
    const formatted = { ...data };
    if (data.publishDate) formatted.publishDate = new Date(data.publishDate);
    if (data.closingDate) formatted.closingDate = new Date(data.closingDate);

    const tender = await HelpdeskRepository.updateOfficeTender(id, formatted);
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'SiteOfficeTender',
      entityId: id,
      newValue: tender,
      ipAddress,
      userAgent
    });
    return tender;
  }

  static async deleteOfficeTender(userId: string, id: string, ipAddress?: string, userAgent?: string) {
    const result = await HelpdeskRepository.deleteOfficeTender(id);
    await AuditService.log({
      userId,
      action: 'DELETE',
      entity: 'SiteOfficeTender',
      entityId: id,
      ipAddress,
      userAgent
    });
    return result;
  }
}
