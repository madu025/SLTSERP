/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class HelpdeskRepository {
  // ==========================================
  // IT ASSETS DATA ACCESS
  // ==========================================

  static async findAssetById(id: string, tx?: any) {
    const db = tx || prisma;
    return db.iTAsset.findUnique({
      where: { id },
      include: {
        assignedStaff: {
          select: { id: true, name: true, employeeId: true, designation: true }
        },
        siteOffice: true,
        units: {
          include: {
            assignedStaff: {
              select: { id: true, name: true, employeeId: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  static async findAssetBySerialNumber(serialNumber: string, tx?: any) {
    const db = tx || prisma;
    return db.iTAsset.findUnique({
      where: { serialNumber }
    });
  }

  static async findAssetByAssetNumber(assetNumber: string, tx?: any) {
    const db = tx || prisma;
    return db.iTAsset.findUnique({
      where: { assetNumber }
    });
  }

  static async findAllAssets(
    { page = 1, limit = 20, search = '', status, deviceType, siteOfficeId, assignedStaffId }: {
      page?: number;
      limit?: number;
      search?: string;
      status?: any;
      deviceType?: any;
      siteOfficeId?: string;
      assignedStaffId?: string;
    },
    tx?: any
  ) {
    const db = tx || prisma;
    const skip = (page - 1) * limit;

    const where: Prisma.ITAssetWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (deviceType) {
      where.deviceType = deviceType;
    }
    if (siteOfficeId) {
      where.siteOfficeId = siteOfficeId;
    }
    if (assignedStaffId) {
      where.assignedStaffId = assignedStaffId;
    }
    if (search) {
      where.OR = [
        { assetNumber: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        {
          siteOffice: {
            name: { contains: search, mode: 'insensitive' }
          }
        },
        {
          units: {
            some: {
              OR: [
                { serialNumber: { contains: search, mode: 'insensitive' } },
                { unitNumber: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        }
      ];
    }

    // O(log n) - DB-level pagination with status-based ordering
    // Status order: ACTIVE(1) > SPARE(2) > UNDER_REPAIR(3) > FAULTY(4) > DECOMMISSIONED(5) > DISPOSED(6) > TRANSFERRED(7)
    const [total, paginatedAssets] = await Promise.all([
      db.iTAsset.count({ where }),
      db.iTAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' }
        ],
        include: {
          assignedStaff: {
            select: { id: true, name: true, employeeId: true, designation: true }
          },
          siteOffice: {
            select: { id: true, name: true }
          },
          _count: {
            select: { units: true }
          }
        }
      })
    ]);

    // Query matched, synced audits to flag which items are verified
    const serialNumbers = paginatedAssets.map((a: any) => a.serialNumber);
    const syncedAudits = await db.iTAssetAudit.findMany({
      where: {
        serialNumber: { in: serialNumbers },
        isSynced: true
      },
      select: {
        serialNumber: true
      }
    });

    const auditedSerials = new Set(syncedAudits.map((sa: any) => sa.serialNumber.toLowerCase()));

    const assetsWithAudit = paginatedAssets.map((asset: any) => ({
      ...asset,
      isAudited: auditedSerials.has(asset.serialNumber.toLowerCase())
    }));

    return { total, assets: assetsWithAudit };
  }

  static async createAsset(data: Prisma.ITAssetUncheckedCreateInput, tx?: any) {
    const db = tx || prisma;
    return db.iTAsset.create({
      data,
      include: {
        assignedStaff: {
          select: { id: true, name: true, employeeId: true, designation: true }
        }
      }
    });
  }

  static async updateAsset(id: string, data: Prisma.ITAssetUncheckedUpdateInput, tx?: any) {
    const db = tx || prisma;
    return db.iTAsset.update({
      where: { id },
      data,
      include: {
        assignedStaff: {
          select: { id: true, name: true, employeeId: true, designation: true }
        }
      }
    });
  }

  static async deleteAsset(id: string, tx?: any) {
    const db = tx || prisma;
    return db.iTAsset.delete({
      where: { id }
    });
  }

  // ==========================================
  // HELP DESK TICKETS DATA ACCESS
  // ==========================================

  static async findTicketById(id: string, tx?: any) {
    const db = tx || prisma;
    return db.ticket.findUnique({
      where: { id },
      include: {
        asset: true,
        user: {
          select: { id: true, name: true, email: true, username: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true, username: true }
        },
        updates: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
  }

  static async findTicketByNumber(ticketNumber: string, tx?: any) {
    const db = tx || prisma;
    return db.ticket.findUnique({
      where: { ticketNumber },
      include: {
        asset: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  static async findAllTickets(
    {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      userId,
      assignedToId,
      search = ''
    }: {
      page?: number;
      limit?: number;
      status?: any;
      priority?: any;
      category?: any;
      userId?: string;
      assignedToId?: string;
      search?: string;
    },
    tx?: any
  ) {
    const db = tx || prisma;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (userId) where.userId = userId;
    if (assignedToId) where.assignedToId = assignedToId;

    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          asset: {
            OR: [
              { assetNumber: { contains: search, mode: 'insensitive' } },
              { serialNumber: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
              { model: { contains: search, mode: 'insensitive' } }
            ]
          }
        },
        {
          user: {
            name: { contains: search, mode: 'insensitive' }
          }
        }
      ];
    }

    const [total, tickets] = await Promise.all([
      db.ticket.count({ where }),
      db.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          asset: true,
          user: {
            select: { id: true, name: true, email: true }
          },
          assignedTo: {
            select: { id: true, name: true }
          }
        }
      })
    ]);

    return { total, tickets };
  }

  static async createTicket(data: Prisma.TicketUncheckedCreateInput, tx?: any) {
    const db = tx || prisma;
    return db.ticket.create({
      data,
      include: {
        asset: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  static async updateTicket(id: string, data: Prisma.TicketUncheckedUpdateInput, tx?: any) {
    const db = tx || prisma;
    return db.ticket.update({
      where: { id },
      data,
      include: {
        asset: true,
        user: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  static async countTicketsToday(tx?: any) {
    const db = tx || prisma;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return db.ticket.count({
      where: {
        createdAt: {
          gte: startOfDay
        }
      }
    });
  }

  // ==========================================
  // TICKET TIMELINE LOGS & UPDATES
  // ==========================================

  static async createTicketUpdate(data: Prisma.TicketUpdateUncheckedCreateInput, tx?: any) {
    const db = tx || prisma;
    return db.ticketUpdate.create({
      data,
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });
  }

  static async findTicketUpdates(ticketId: string, tx?: any) {
    const db = tx || prisma;
    return db.ticketUpdate.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });
  }

  // ==========================================
  // KNOWLEDGE BASE DATA ACCESS
  // ==========================================

  static async findKBArticleById(id: string, tx?: any) {
    const db = tx || prisma;
    return db.knowledgeBaseArticle.findUnique({
      where: { id }
    });
  }

  static async findAllKBArticles({ search = '', category = '' }: { search?: string; category?: string }, tx?: any) {
    const db = tx || prisma;
    const where: Prisma.KnowledgeBaseArticleWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    return db.knowledgeBaseArticle.findMany({
      where,
      orderBy: [
        { views: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  static async createKBArticle(data: Prisma.KnowledgeBaseArticleCreateInput, tx?: any) {
    const db = tx || prisma;
    return db.knowledgeBaseArticle.create({
      data
    });
  }

  static async updateKBArticle(id: string, data: Prisma.KnowledgeBaseArticleUpdateInput, tx?: any) {
    const db = tx || prisma;
    return db.knowledgeBaseArticle.update({
      where: { id },
      data
    });
  }

  static async deleteKBArticle(id: string, tx?: any) {
    const db = tx || prisma;
    return db.knowledgeBaseArticle.delete({
      where: { id }
    });
  }

  static async incrementKBArticleViews(id: string, tx?: any) {
    const db = tx || prisma;
    return db.knowledgeBaseArticle.update({
      where: { id },
      data: {
        views: {
          increment: 1
        }
      }
    });
  }

  // ==========================================
  // REPORTS AND METRICS REPORTING
  // ==========================================

  static async getITDashboardStats(tx?: any) {
    const db = tx || prisma;

    const [openCount, inProgressCount, waitingCount, resolvedCount, totalCount] = await Promise.all([
      db.ticket.count({ where: { status: 'OPEN' } }),
      db.ticket.count({ where: { status: 'IN_PROGRESS' } }),
      db.ticket.count({ where: { OR: [{ status: 'WAITING_FOR_USER' }, { status: 'WAITING_FOR_PARTS' }] } }),
      db.ticket.count({ where: { status: 'RESOLVED' } }),
      db.ticket.count()
    ]);

    const criticalCount = await db.ticket.count({
      where: {
        priority: 'CRITICAL',
        status: { notIn: ['RESOLVED', 'CLOSED'] }
      }
    });

    // Workload (Tickets per engineer)
    const activeEngineers = await db.user.findMany({
      where: {
        assignedTickets: {
          some: {
            status: { notIn: ['RESOLVED', 'CLOSED'] }
          }
        }
      },
      select: {
        id: true,
        name: true,
        assignedTickets: {
          where: {
            status: { notIn: ['RESOLVED', 'CLOSED'] }
          },
          select: { id: true }
        }
      }
    });

    const engineerWorkload = activeEngineers.map((eng: any) => ({
      engineerId: eng.id,
      engineerName: eng.name || 'Unknown',
      activeTickets: eng.assignedTickets.length
    }));

    // Failure frequency by brand/model
    const assetsWithTickets = await db.iTAsset.findMany({
      where: {
        tickets: { some: {} }
      },
      select: {
        brand: true,
        model: true,
        deviceType: true,
        _count: {
          select: { tickets: true }
        }
      }
    });

    const failureFrequency = assetsWithTickets.map((asset: any) => ({
      brand: asset.brand,
      model: asset.model,
      deviceType: asset.deviceType,
      failures: asset._count.tickets
    })).sort((a: any, b: any) => b.failures - a.failures).slice(0, 10);

    return {
      counts: {
        open: openCount,
        inProgress: inProgressCount,
        waiting: waitingCount,
        resolved: resolvedCount,
        critical: criticalCount,
        total: totalCount
      },
      engineerWorkload,
      failureFrequency
    };
  }

  static async getTicketsByDepartment(tx?: any) {
    const db = tx || prisma;
    // Include both the linked asset's department AND the ticket creator's own assets
    // This ensures software-only tickets (no linked asset) are still counted by department
    const tickets = await db.ticket.findMany({
      select: {
        id: true,
        category: true,
        asset: {
          select: { department: true }
        },
        user: {
          select: {
            staff: {
              select: {
                assignedITAssets: {
                  select: { department: true },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    const deptCounts: Record<string, number> = {};
    tickets.forEach((t: any) => {
      // Priority: linked asset dept > user's primary asset dept > 'General'
      const dept =
        t.asset?.department ||
        t.user?.staff?.assignedITAssets?.[0]?.department ||
        'General';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    return Object.entries(deptCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value);
  }

  static async getCommonIssues(tx?: any) {
    const db = tx || prisma;
    const groups = await db.ticket.groupBy({
      by: ['category'],
      _count: {
        id: true
      }
    });

    return groups.map((g: any) => ({
      category: g.category,
      count: g._count.id
    })).sort((a: any, b: any) => b.count - a.count);
  }

  // ==========================================
  // SITE OFFICES DATA ACCESS
  // ==========================================

  static async findSiteOfficeById(id: string, tx?: any) {
    const db = tx || prisma;
    const store = await db.inventoryStore.findUnique({
      where: { id },
      include: {
        officeAdmin: {
          select: { id: true, name: true, email: true, username: true }
        },
        itAssets: {
          select: { id: true, assetNumber: true, brand: true, model: true }
        },
        agreements: {
          orderBy: { startDate: 'desc' }
        },
        requests: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        vehicles: {
          orderBy: { allocationDate: 'desc' }
        },
        tenders: {
          orderBy: { publishDate: 'desc' }
        }
      }
    });

    if (!store) return null;

    return {
      id: store.id,
      name: store.name,
      address: store.location,
      officeAdminId: store.officeAdminId,
      officeAdmin: store.officeAdmin,
      contactNo: null,
      rentalCost: 0,
      landlordName: null,
      landlordPhone: null,
      assets: store.itAssets,
      agreements: store.agreements,
      requests: store.requests,
      vehicles: store.vehicles,
      tenders: store.tenders,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt
    };
  }

  static async findSiteOfficeByName(name: string, tx?: any) {
    const db = tx || prisma;
    const store = await db.inventoryStore.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });
    return store ? { id: store.id, name: store.name } : null;
  }

  static async findAllSiteOffices(
    { page = 1, limit = 50, search = '' }: { page?: number; limit?: number; search?: string },
    tx?: any
  ) {
    const db = tx || prisma;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, stores] = await Promise.all([
      db.inventoryStore.count({ where }),
      db.inventoryStore.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          officeAdmin: {
            select: { id: true, name: true, email: true, username: true }
          },
          _count: {
            select: { itAssets: true }
          }
        }
      })
    ]);

    const siteOffices = stores.map((s: any) => ({
      id: s.id,
      name: s.name,
      address: s.location,
      officeAdminId: s.officeAdminId,
      officeAdmin: s.officeAdmin,
      contactNo: null,
      rentalCost: 0,
      landlordName: null,
      landlordPhone: null,
      assets: s.itAssets,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      _count: {
        assets: s._count.itAssets
      }
    }));

    return { total, siteOffices };
  }

  static async createSiteOffice(data: any, tx?: any) {
    const db = tx || prisma;
    const { address, name, officeAdminId } = data;
    const store = await db.inventoryStore.create({
      data: {
        name,
        location: address,
        officeAdminId
      },
      include: {
        officeAdmin: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return {
      id: store.id,
      name: store.name,
      address: store.location,
      officeAdminId: store.officeAdminId,
      officeAdmin: store.officeAdmin,
      contactNo: null,
      rentalCost: 0,
      landlordName: null,
      landlordPhone: null,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt
    };
  }

  static async updateSiteOffice(id: string, data: any, tx?: any) {
    const db = tx || prisma;
    const { address, name, officeAdminId } = data;
    const store = await db.inventoryStore.update({
      where: { id },
      data: {
        name,
        location: address,
        officeAdminId
      },
      include: {
        officeAdmin: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return {
      id: store.id,
      name: store.name,
      address: store.location,
      officeAdminId: store.officeAdminId,
      officeAdmin: store.officeAdmin,
      contactNo: null,
      rentalCost: 0,
      landlordName: null,
      landlordPhone: null,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt
    };
  }

  static async deleteSiteOffice(id: string, tx?: any) {
    const db = tx || prisma;
    return db.inventoryStore.delete({
      where: { id }
    });
  }

  // ==========================================
  // SITE OFFICES SUB-MODULES
  // ==========================================

  // Agreements
  static async createAgreement(siteOfficeId: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeAgreement.create({
      data: {
        ...data,
        siteOfficeId
      }
    });
  }

  static async updateAgreement(id: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeAgreement.update({
      where: { id },
      data
    });
  }

  static async deleteAgreement(id: string, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeAgreement.delete({
      where: { id }
    });
  }

  // Goods Requests
  static async createOfficeRequest(siteOfficeId: string, requestedById: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeRequest.create({
      data: {
        ...data,
        siteOfficeId,
        requestedById
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, username: true }
        }
      }
    });
  }

  static async updateOfficeRequest(id: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeRequest.update({
      where: { id },
      data,
      include: {
        requestedBy: {
          select: { id: true, name: true, username: true }
        }
      }
    });
  }

  static async deleteOfficeRequest(id: string, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeRequest.delete({
      where: { id }
    });
  }

  // Vehicle Allocations
  static async createOfficeVehicle(siteOfficeId: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeVehicle.create({
      data: {
        ...data,
        siteOfficeId
      }
    });
  }

  static async updateOfficeVehicle(id: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeVehicle.update({
      where: { id },
      data
    });
  }

  static async deleteOfficeVehicle(id: string, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeVehicle.delete({
      where: { id }
    });
  }

  // Purchasing Tenders
  static async createOfficeTender(siteOfficeId: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeTender.create({
      data: {
        ...data,
        siteOfficeId
      }
    });
  }

  static async updateOfficeTender(id: string, data: any, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeTender.update({
      where: { id },
      data
    });
  }

  static async deleteOfficeTender(id: string, tx?: any) {
    const db = tx || prisma;
    return db.siteOfficeTender.delete({
      where: { id }
    });
  }
}
