import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, subMonths, subDays, subYears, format } from 'date-fns';
import { getSriLankaStartOfDay, getSriLankaEndOfDay } from '@/lib/timezone';
import { PaymentTypeEnum, PaymentStatusEnum } from '@prisma/client';

export interface AnalyticsReportOptions {
  customFrom?: string | null;
  customTo?: string | null;
  groupBy?: string | null;
}

export interface DailyOperationalReportOptions {
  date?: string | null;
}

export interface PaymentsReportOptions {
  from_date?: string | null;
  to_date?: string | null;
  payment_type?: string | null;
  status?: string | null;
  page?: number;
  limit?: number;
}

interface InHandMorningEntry {
  nc: number;
  rl: number;
  data: number;
  total: number;
}

interface ReceivedEntry {
  nc: number;
  rl: number;
  data: number;
  total: number;
}

interface CompletedEntry {
  create: number;
  recon: number;
  upgrade: number;
  fnc: number;
  or: number;
  ml: number;
  frl: number;
  data: number;
  total: number;
}

interface MaterialEntry {
  dwSlt: number;
  dwCompany: number;
  dw: number;
  pole56: number;
  pole67: number;
  pole80: number;
}

interface ReturnedEntry {
  nc: number;
  rl: number;
  data: number;
  total: number;
}

interface WiredOnlyEntry {
  nc: number;
  rl: number;
  data: number;
  total: number;
}

interface DelaysEntry {
  ontShortage: number;
  stbShortage: number;
  nokia: number;
  system: number;
  opmc: number;
  cxDelay: number;
  sameDay: number;
  polePending: number;
}

interface BalanceEntry {
  nc: number;
  rl: number;
  data: number;
  total: number;
}

interface ShortagesEntry {
  stb: number;
  ont: number;
}

interface ReportRow {
  region: string;
  province: string;
  rtom: string;
  regularTeams: number;
  teamsWorked: number;
  inHandMorning: InHandMorningEntry;
  received: ReceivedEntry;
  totalInHand: number;
  completed: CompletedEntry;
  material: MaterialEntry;
  returned: ReturnedEntry;
  wiredOnly: WiredOnlyEntry;
  delays: DelaysEntry;
  balance: BalanceEntry;
  shortages: ShortagesEntry;
}

interface StatusHistoryEntry {
  status: string;
  statusDate: Date | null | string;
}

interface MaterialUsageItem {
  category: string | null;
  name: string | null;
  code: string | null;
}

interface MaterialUsageEntry {
  item: MaterialUsageItem | null;
  quantity: number | string | { toNumber(): number };
}

interface ServiceOrderWithRelations {
  id: string;
  orderType: string | null;
  package: string | null;
  status: string | null;
  statusDate: Date | null;
  receivedDate: Date | null;
  createdAt: Date;
  sltsStatus: string | null;
  completedDate: Date | null;
  wiredOnly: boolean | null;
  teamId: string | null;
  materialUsage: MaterialUsageEntry[];
  statusHistory: StatusHistoryEntry[];
  delayReasons?: Record<string, boolean> | null;
  stbShortage?: boolean;
  ontShortage?: boolean;
}

export class ReportService {
  /**
   * Generates Analytics Report
   */
  static async getAnalyticsReport(view: string, period: string, options: AnalyticsReportOptions) {
    const { customFrom, customTo, groupBy = 'RTOM' } = options;

    // Calculate date range based on period
    let startDate: Date;
    let endDate = new Date();
    let monthsToShow = 6;

    if (customFrom && customTo) {
      startDate = new Date(customFrom);
      endDate = new Date(customTo);
      const monthsDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      monthsToShow = Math.min(monthsDiff, 12);
    } else {
      switch (period) {
        case 'Daily':
          startDate = subDays(endDate, 1);
          monthsToShow = 1;
          break;
        case 'Weekly':
          startDate = subDays(endDate, 7);
          monthsToShow = 1;
          break;
        case '1M':
          startDate = subMonths(endDate, 1);
          monthsToShow = 1;
          break;
        case '3M':
          startDate = subMonths(endDate, 3);
          monthsToShow = 3;
          break;
        case '6M':
          startDate = subMonths(endDate, 6);
          monthsToShow = 6;
          break;
        case '1Y':
          startDate = subYears(endDate, 1);
          monthsToShow = 12;
          break;
        default:
          startDate = subMonths(endDate, 6);
          monthsToShow = 6;
      }
    }

    // 1. MANAGER VIEW
    if (view === 'manager') {
      const trendDataRaw = await prisma.serviceOrder.groupBy({
        by: ['completedDate'],
        where: {
          sltsStatus: 'COMPLETED',
          completedDate: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: { _all: true }
      });

      const trendMap = new Map();
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const d = subMonths(endDate, i);
        const k = format(d, 'MMM');
        trendMap.set(k, 0);
      }

      trendDataRaw.forEach(item => {
        if (item.completedDate) {
          const k = format(item.completedDate, 'MMM');
          if (trendMap.has(k)) {
            trendMap.set(k, trendMap.get(k) + item._count._all);
          }
        }
      });

      const monthlyTrend = Array.from(trendMap.entries()).map(([month, completed]) => ({
        month,
        completed,
        target: 150
      }));

      const contractorStats = await prisma.serviceOrder.groupBy({
        by: ['contractorId', 'sltsStatus'],
        where: {
          contractorId: { not: null },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: { _all: true }
      });

      const contractorIds = [...new Set(contractorStats.map(s => s.contractorId))].filter(Boolean) as string[];
      const contractors = await prisma.contractor.findMany({
        where: { id: { in: contractorIds } },
        select: { id: true, name: true }
      });

      const contractorPerformance = contractors.map(c => {
        const stats = contractorStats.filter(s => s.contractorId === c.id);
        const completed = stats.find(s => s.sltsStatus === 'COMPLETED')?._count._all || 0;
        const pending = stats.find(s => s.sltsStatus === 'INPROGRESS')?._count._all || 0;
        const returned = stats.find(s => s.sltsStatus === 'RETURN')?._count._all || 0;
        const total = completed + pending + returned;

        return {
          name: c.name,
          completed,
          pending,
          returned,
          efficiency: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      }).sort((a, b) => b.completed - a.completed).slice(0, 10);

      const rtomStats = await prisma.serviceOrder.groupBy({
        by: ['rtom', 'sltsStatus'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: { _all: true }
      });

      const rtomNames = [...new Set(rtomStats.map(s => s.rtom))].filter(Boolean);
      const rtomPerformance = rtomNames.map(rtom => {
        const stats = rtomStats.filter(s => s.rtom === rtom);
        const completed = stats.find(s => s.sltsStatus === 'COMPLETED')?._count._all || 0;
        const total = stats.reduce((acc, curr) => acc + curr._count._all, 0);
        return {
          name: rtom,
          completion: total > 0 ? Math.round((completed / total) * 100) : 0,
          pending: total - completed
        };
      }).sort((a, b) => b.completion - a.completion);

      return {
        monthlyTrend,
        contractorPerformance,
        rtomPerformance,
        summary: {
          totalCompletion: monthlyTrend.reduce((acc, curr) => acc + curr.completed, 0),
          activeContractors: contractors.length
        },
        dateRange: {
          from: startDate,
          to: endDate,
          period
        }
      };
    }

    // 2. AREA MANAGER VIEW
    if (view === 'area') {
      const orders = await prisma.serviceOrder.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          rtom: true,
          sltsStatus: true,
          createdAt: true,
          opmc: {
            select: {
              region: true,
              province: true
            }
          },
          team: {
            select: {
              name: true
            }
          }
        }
      });

      const groupMap = new Map<string, { completed: number, pending: number, returned: number }>();

      orders.forEach(order => {
        let groupKey = '';

        switch (groupBy) {
          case 'REGION':
            groupKey = order.opmc?.region || 'Unknown';
            break;
          case 'ARM':
            groupKey = order.opmc?.province || 'Unknown ARM';
            break;
          case 'RTOM':
            groupKey = order.rtom || 'Unknown';
            break;
          case 'COORDINATOR':
            groupKey = order.team?.name || 'Unassigned';
            break;
          default:
            groupKey = order.rtom || 'Unknown';
        }

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, { completed: 0, pending: 0, returned: 0 });
        }

        const stats = groupMap.get(groupKey)!;
        if (order.sltsStatus === 'COMPLETED') stats.completed++;
        else if (order.sltsStatus === 'INPROGRESS') stats.pending++;
        else if (order.sltsStatus === 'RETURN') stats.returned++;
      });

      const performanceData = Array.from(groupMap.entries()).map(([name, stats]) => ({
        name,
        ...stats
      })).sort((a, b) => b.completed - a.completed);

      const trendMap = new Map();
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const d = subMonths(endDate, i);
        const k = format(d, 'MMM');
        trendMap.set(k, { completed: 0, pending: 0 });
      }

      orders.forEach(order => {
        if (order.createdAt) {
          const k = format(order.createdAt, 'MMM');
          if (trendMap.has(k)) {
            const trend = trendMap.get(k);
            if (order.sltsStatus === 'COMPLETED') trend.completed++;
            else if (order.sltsStatus === 'INPROGRESS') trend.pending++;
          }
        }
      });

      const trendData = Array.from(trendMap.entries()).map(([month, data]) => ({
        month,
        ...data
      }));

      const summary = {
        total: orders.length,
        completed: orders.filter(o => o.sltsStatus === 'COMPLETED').length,
        pending: orders.filter(o => o.sltsStatus === 'INPROGRESS').length,
        returned: orders.filter(o => o.sltsStatus === 'RETURN').length
      };

      return {
        performanceData,
        trendData,
        summary,
        dateRange: {
          from: startDate,
          to: endDate,
          period
        },
        groupBy
      };
    }

    throw new Error('INVALID_VIEW_TYPE');
  }

  /**
   * Generates Daily Operational Report
   */
  static async getDailyOperationalReport(options: DailyOperationalReportOptions) {
    const { date } = options;
    const selectedDate = date ? new Date(date) : new Date();
    const startDate = getSriLankaStartOfDay(selectedDate);
    const endDate = getSriLankaEndOfDay(selectedDate);

    const opmcs = await prisma.oPMC.findMany({
      select: {
        id: true,
        region: true,
        province: true,
        rtom: true,
        serviceOrders: {
          where: {
            OR: [
              { createdAt: { gte: startDate, lte: endDate } },
              { completedDate: { gte: startDate, lte: endDate } },
              { statusDate: { gte: startDate, lte: endDate } },
              { receivedDate: { gte: startDate, lte: endDate } },
              { updatedAt: { gte: startDate, lte: endDate } }
            ]
          },
          select: {
            id: true,
            createdAt: true,
            status: true,
            sltsStatus: true,
            statusDate: true,
            completedDate: true,
            orderType: true,
            package: true,
            wiredOnly: true,
            delayReasons: true,
            teamId: true,
            stbShortage: true,
            ontShortage: true,
            materialUsage: {
              select: {
                quantity: true,
                item: {
                  select: {
                    category: true,
                    name: true,
                    code: true
                  }
                }
              }
            },
            statusHistory: {
              select: {
                status: true,
                statusDate: true
              }
            }
          }
        },
        contractorTeams: {
          select: {
            id: true
          }
        }
      },
      orderBy: [
        { region: 'asc' },
        { province: 'asc' },
        { rtom: 'asc' }
      ]
    });

    const rawSources: { id: string; materialSource: string }[] = await prisma.$queryRaw`
      SELECT "id", "materialSource" FROM "ServiceOrder" 
      WHERE ("createdAt" >= ${startDate} AND "createdAt" <= ${endDate})
         OR ("completedDate" >= ${startDate} AND "completedDate" <= ${endDate})
         OR ("statusDate" >= ${startDate} AND "statusDate" <= ${endDate})
    `;

    const sourceMap = new Map<string, string>(rawSources.map(s => [s.id, s.materialSource]));

    const inHandMorningOrders = await prisma.serviceOrder.groupBy({
      by: ['rtom', 'orderType'],
      where: {
        createdAt: { lt: startDate },
        AND: [
          {
            OR: [
              { sltsStatus: { not: 'COMPLETED' } },
              { statusDate: { gte: startDate } }
            ]
          },
          {
            OR: [
              { sltsStatus: { not: 'RETURN' } },
              { statusDate: { gte: startDate } }
            ]
          }
        ]
      },
      _count: { id: true }
    });

    const reportData: ReportRow[] = opmcs.map(opmc => {
      const orders = opmc.serviceOrders as unknown as ServiceOrderWithRelations[];
      const regularTeams = opmc.contractorTeams.length;
      const teamsWorked = new Set(orders.map(o => o.teamId).filter(Boolean)).size;

      const categorizeOrder = (order: { orderType?: string | null; package?: string | null }) => {
        const orderType = order.orderType?.toUpperCase() || '';
        const packageInfo = (order.package || '').toUpperCase();

        if (orderType.includes('CREATE-OR') || orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION') || orderType.includes('F-RL') || packageInfo.includes('FRL')) {
          return 'rl' as const;
        }

        if (
          orderType.includes('CREATE') ||
          orderType.includes('F-NC') ||
          orderType.includes('RECON') ||
          orderType.includes('UPGRADE') ||
          orderType.includes('UPGRD') ||
          packageInfo.includes('FNC') ||
          packageInfo.includes('VOICE') ||
          packageInfo.includes('INT') ||
          packageInfo.includes('IPTV')
        ) {
          return 'nc' as const;
        }

        return 'data' as const;
      };

      const inHandMorning = { nc: 0, rl: 0, data: 0, total: 0 };
      const opmcInHandMorning = inHandMorningOrders.filter(row => row.rtom === opmc.rtom);
      opmcInHandMorning.forEach(row => {
        const category = categorizeOrder({ orderType: row.orderType });
        const count = row._count.id;
        inHandMorning[category] += count;
        inHandMorning.total += count;
      });

      const received: ReceivedEntry = { nc: 0, rl: 0, data: 0, total: 0 };
      const completed: CompletedEntry = { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 };
      const material: MaterialEntry = { dwSlt: 0, dwCompany: 0, dw: 0, pole56: 0, pole67: 0, pole80: 0 };
      const returned: ReturnedEntry = { nc: 0, rl: 0, data: 0, total: 0 };
      const wiredOnly: WiredOnlyEntry = { nc: 0, rl: 0, data: 0, total: 0 };
      const delays: DelaysEntry = { ontShortage: 0, stbShortage: 0, nokia: 0, system: 0, opmc: 0, cxDelay: 0, sameDay: 0, polePending: 0 };

      orders.forEach(order => {
        const category = categorizeOrder(order);
        const source = sourceMap.get(order.id) || 'SLT';

        const rDate = order.createdAt;
        if (rDate >= startDate && rDate <= endDate) {
          received[category]++;
          received.total++;
        }

        const statusStr = order.status?.toUpperCase() || '';
        const isInstallClosedToday = (statusStr === 'INSTALL_CLOSED' || order.sltsStatus === 'COMPLETED') && (
          (order.statusDate && order.statusDate >= startDate && order.statusDate <= endDate) ||
          (order.completedDate && order.completedDate >= startDate && order.completedDate <= endDate)
        );

        const hadInstallClosedHistoryToday = order.statusHistory?.some((h) =>
          h.status?.toUpperCase() === 'INSTALL_CLOSED' &&
          h.statusDate && new Date(h.statusDate) >= startDate && new Date(h.statusDate) <= endDate
        );

        if (isInstallClosedToday || hadInstallClosedHistoryToday) {
          const orderType = order.orderType?.toUpperCase() || '';
          const packageInfo = (order.package || '').toUpperCase();

          if (orderType.includes('RECON')) {
            completed.recon++;
          } else if (orderType.includes('UPGRADE') || orderType.includes('UPGRD')) {
            completed.upgrade++;
          } else if (orderType.includes('CREATE-OR')) {
            completed.or++;
          } else if (orderType.includes('MODIFY-LOCATION') || orderType.includes('MODIFY LOCATION')) {
            completed.ml++;
          } else if (orderType.includes('F-NC') || packageInfo.includes('FNC')) {
            completed.fnc++;
          } else if (orderType.includes('F-RL') || packageInfo.includes('FRL')) {
            completed.frl++;
          } else if (orderType.includes('CREATE')) {
            completed.create++;
          } else if (packageInfo.includes('VOICE') || packageInfo.includes('INT') || packageInfo.includes('IPTV')) {
            completed.create++;
          } else {
            completed.data++;
          }
          completed.total++;
        }

        if (order.sltsStatus === 'RETURN' && order.statusDate &&
          order.statusDate >= startDate && order.statusDate <= endDate) {
          returned[category]++;
          returned.total++;
        }

        const isProvClosedToday = order.status === 'PROV_CLOSED' && order.statusDate && order.statusDate >= startDate && order.statusDate <= endDate;
        const hadProvClosedHistoryToday = order.statusHistory?.some((h) =>
          h.status === 'PROV_CLOSED' &&
          h.statusDate && new Date(h.statusDate) >= startDate && new Date(h.statusDate) <= endDate
        );

        if (isProvClosedToday || hadProvClosedHistoryToday || order.wiredOnly === true) {
          wiredOnly[category]++;
          wiredOnly.total++;
        }

        if (order.delayReasons) {
          const reasons = order.delayReasons as Record<string, boolean>;
          if (reasons.ontShortage) delays.ontShortage++;
          if (reasons.stbShortage) delays.stbShortage++;
          if (reasons.nokia) delays.nokia++;
          if (reasons.system) delays.system++;
          if (reasons.opmc) delays.opmc++;
          if (reasons.cxDelay) delays.cxDelay++;
          if (reasons.sameDay) delays.sameDay++;
          if (reasons.polePending) delays.polePending++;
        }

        if (order.materialUsage && order.materialUsage.length > 0) {
          order.materialUsage.forEach((usage) => {
            const itemCategory = usage.item?.category?.toLowerCase() || '';
            const itemName = usage.item?.name?.toLowerCase() || '';
            const itemCode = usage.item?.code?.toUpperCase() || '';

            let quantity = 0;
            if (typeof usage.quantity === 'number') {
              quantity = usage.quantity;
            } else if (usage.quantity && typeof usage.quantity === 'object' && 'toNumber' in usage.quantity) {
              quantity = (usage.quantity as { toNumber(): number }).toNumber();
            } else {
              quantity = parseFloat(usage.quantity as string) || 0;
            }

            if (itemCode === 'OSPFTA003' || itemName.includes('drop wire')) {
              if (source === 'COMPANY') {
                material.dwCompany += quantity;
              } else {
                material.dwSlt += quantity;
              }
              material.dw += quantity;
            } else if (itemCategory.includes('pole')) {
              if (itemName.includes('5.6')) {
                material.pole56 += quantity;
              } else if (itemName.includes('6.7')) {
                material.pole67 += quantity;
              } else if (itemName.includes('8.0') || itemName.includes('8')) {
                material.pole80 += quantity;
              }
            }
          });
        }
      });

      const totalInHand = inHandMorning.total + received.total;

      const balance: BalanceEntry = {
        nc: inHandMorning.nc + received.nc - (completed.create + completed.fnc + completed.recon + completed.upgrade) - returned.nc,
        rl: inHandMorning.rl + received.rl - (completed.or + completed.ml + completed.frl) - returned.rl,
        data: inHandMorning.data + received.data - completed.data - returned.data,
        total: 0
      };
      balance.total = balance.nc + balance.rl + balance.data;

      const shortages: ShortagesEntry = {
        stb: orders.filter(o => o.stbShortage).length,
        ont: orders.filter(o => o.ontShortage).length
      };

      return {
        region: opmc.region,
        province: opmc.province,
        rtom: opmc.rtom,
        regularTeams,
        teamsWorked,
        inHandMorning,
        received,
        totalInHand,
        completed,
        material,
        returned,
        wiredOnly,
        delays,
        balance,
        shortages
      };
    });

    return {
      reportData,
      date: selectedDate.toISOString().split('T')[0]
    };
  }

  /**
   * Generates Payments Report
   */
  static async getPaymentsReport(options: PaymentsReportOptions) {
    const { from_date, to_date, payment_type, status, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (payment_type) where.payment_type = payment_type as PaymentTypeEnum;
    if (status) where.status = status as PaymentStatusEnum;
    if (from_date || to_date) {
      where.payment_date = {};
      if (from_date) where.payment_date.gte = new Date(from_date);
      if (to_date) where.payment_date.lte = new Date(to_date);
    }

    const [payments, total] = await Promise.all([
      prisma.vMPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: { select: { id: true, invoice_number: true, total_amount: true } },
        },
      }),
      prisma.vMPayment.count({ where }),
    ]);

    const summary = payments.reduce(
      (acc, p) => ({
        total_count: acc.total_count + 1,
        total_base_amount: acc.total_base_amount + p.base_amount,
        total_tax_amount: acc.total_tax_amount + p.tax_amount,
        total_amount: acc.total_amount + p.total_amount,
      }),
      { total_count: 0, total_base_amount: 0, total_tax_amount: 0, total_amount: 0 }
    );

    const byTypeMap = new Map<string, { count: number; total_amount: number }>();
    payments.forEach((p) => {
      const key = p.payment_type;
      const existing = byTypeMap.get(key) || { count: 0, total_amount: 0 };
      existing.count += 1;
      existing.total_amount += p.total_amount;
      byTypeMap.set(key, existing);
    });

    const by_type = Array.from(byTypeMap.entries()).map(([pType, data]) => ({
      payment_type: pType,
      ...data,
    }));

    return {
      payments,
      total,
      summary,
      by_type,
    };
  }
}
