import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { subMonths, subDays, subYears, format } from 'date-fns';
import { getSriLankaStartOfDay, getSriLankaEndOfDay } from '@/lib/timezone';
import { PaymentTypeEnum, PaymentStatusEnum, Prisma, ServiceOrderStatus } from '@prisma/client';
import { SOD_EXCLUDED_FROM_PENDING, SOD_PENDING_DEFAULT_STATUSES, categorizeSodOrder } from '@/lib/constants/sod-constants';
import { classifySodDayActivity, type SodDayActivitySource, type SodDayWindow } from './daily-report-activity';
import { sumMaterialsForSods, type DailyMaterialTotals, type MaterialSodLike } from './daily-report-material';

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

/** DW and pole totals for one RTOM row; shape owned by the material rule module. */
type MaterialEntry = DailyMaterialTotals;

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

/** Install Closed carries the same order-type breakdown as Completed Orders. */
type InstallClosedEntry = CompletedEntry;

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
  installClosed: InstallClosedEntry;
  delays: DelaysEntry;
  balance: BalanceEntry;
  shortages: ShortagesEntry;
}

/** Sri Lanka (UTC+5:30) calendar-day key, e.g. '2026-09-02'. */
const slDateKey = (d: Date): string =>
  new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

/**
 * A report SOD is both a day-activity subject and a material carrier; the shapes
 * come from the rule modules so the report cannot drift from them.
 */
interface ServiceOrderWithRelations extends SodDayActivitySource, MaterialSodLike {
  id: string;
  orderType: string | null;
  package: string | null;
  teamId: string | null;
  delayReasons?: Record<string, boolean> | null;
  stbShortage?: boolean;
  ontShortage?: boolean;
}

export class ReportService {
  /**
   * Generates Analytics Report
   */
  static async getAnalyticsReport(view: string, period: string, options: AnalyticsReportOptions) {
    const VALID_VIEWS = ['manager', 'area'] as const;
    const VALID_PERIODS = ['Daily', 'Weekly', '1M', '3M', '6M', '1Y', 'CUSTOM'] as const;
    const VALID_GROUP_BY = ['REGION', 'ARM', 'RTOM', 'COORDINATOR'] as const;

    if (!VALID_VIEWS.includes(view as typeof VALID_VIEWS[number])) {
      throw AppError.badRequest(`Invalid view: ${view}`);
    }
    if (!VALID_PERIODS.includes(period as typeof VALID_PERIODS[number])) {
      throw AppError.badRequest(`Invalid period: ${period}`);
    }

    const { customFrom, customTo, groupBy = 'RTOM' } = options;

    if (groupBy && !VALID_GROUP_BY.includes(groupBy as typeof VALID_GROUP_BY[number])) {
      throw AppError.badRequest(`Invalid groupBy: ${groupBy}`);
    }

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
          sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED'] },
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
        const completed = (stats.find(s => s.sltsStatus === 'COMPLETED')?._count._all || 0)
          + (stats.find(s => s.sltsStatus === 'INSTALL_CLOSED')?._count._all || 0);
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
        const completed = (stats.find(s => s.sltsStatus === 'COMPLETED')?._count._all || 0)
          + (stats.find(s => s.sltsStatus === 'INSTALL_CLOSED')?._count._all || 0);
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
      const isDailyView = period === 'Daily' || period === 'Weekly';

      // Parallel DB-level aggregation queries (replaces 55K+ row findMany)
      const [
        perfGrouped,
        trendCompletedRaw,
        trendPendingRaw,
        total,
        completed,
        pending,
        returned,
      ] = await Promise.all([
        // Performance data: groupBy the selected dimension + sltsStatus
        groupBy === 'COORDINATOR'
          ? prisma.serviceOrder.groupBy({
              by: ['teamId', 'sltsStatus'],
              where: { createdAt: { gte: startDate, lte: endDate } },
              _count: { _all: true },
            })
          : groupBy === 'REGION' || groupBy === 'ARM'
            ? prisma.serviceOrder.groupBy({
                by: ['opmcId', 'sltsStatus'],
                where: { createdAt: { gte: startDate, lte: endDate } },
                _count: { _all: true },
              })
            : prisma.serviceOrder.groupBy({
                by: ['rtom', 'sltsStatus'],
                where: { createdAt: { gte: startDate, lte: endDate } },
                _count: { _all: true },
              }),
        // Trend: completed orders grouped by date
        prisma.serviceOrder.groupBy({
          by: ['completedDate'],
          where: {
            sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED'] },
            completedDate: { gte: startDate, lte: endDate },
          },
          _count: { _all: true },
        }),
        // Trend: pending orders grouped by statusDate
        prisma.serviceOrder.groupBy({
          by: ['statusDate'],
          where: {
            sltsStatus: 'INPROGRESS',
            statusDate: { gte: startDate, lte: endDate },
          },
          _count: { _all: true },
        }),
        prisma.serviceOrder.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
        prisma.serviceOrder.count({ where: { createdAt: { gte: startDate, lte: endDate }, sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED'] } } }),
        prisma.serviceOrder.count({ where: { createdAt: { gte: startDate, lte: endDate }, sltsStatus: 'INPROGRESS' } }),
        prisma.serviceOrder.count({ where: { createdAt: { gte: startDate, lte: endDate }, sltsStatus: 'RETURN' } }),
      ]);

      // Resolve dimension names from grouped data
      let dimensionMap = new Map<string, string>();

      if (groupBy === 'COORDINATOR') {
        const rawTeamIds = (perfGrouped as { teamId: string | null; sltsStatus: string; _count: { _all: number } }[]).map(g => g.teamId).filter(Boolean);
        const teamIds = [...new Set(rawTeamIds)] as string[];
        const teams = await prisma.contractorTeam.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        });
        dimensionMap = new Map(teams.map(t => [t.id, t.name]));
      } else if (groupBy === 'REGION' || groupBy === 'ARM') {
        const opmcIds = [...new Set((perfGrouped as { opmcId: string; sltsStatus: string; _count: { _all: number } }[]).map(g => g.opmcId))];
        const opmcs = await prisma.oPMC.findMany({
          where: { id: { in: opmcIds } },
          select: { id: true, region: true, province: true },
        });
        dimensionMap = new Map(opmcs.map(o => [o.id, groupBy === 'REGION' ? o.region : o.province]));
      }

      // Build performance data from grouped results
      const groupMap = new Map<string, { completed: number; pending: number; returned: number }>();
      const typedPerf = perfGrouped as { rtom?: string; teamId?: string | null; opmcId?: string; sltsStatus: string; _count: { _all: number } }[];

      for (const g of typedPerf) {
        let groupKey: string;
        if (groupBy === 'COORDINATOR') {
          groupKey = g.teamId ? (dimensionMap.get(g.teamId) || 'Unassigned') : 'Unassigned';
        } else if (groupBy === 'REGION' || groupBy === 'ARM') {
          groupKey = dimensionMap.get(g.opmcId!) || 'Unknown';
        } else {
          groupKey = g.rtom || 'Unknown';
        }

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, { completed: 0, pending: 0, returned: 0 });
        }
        const stats = groupMap.get(groupKey)!;
        if (g.sltsStatus === 'COMPLETED' || g.sltsStatus === 'INSTALL_CLOSED') stats.completed += g._count._all;
        else if (g.sltsStatus === 'INPROGRESS') stats.pending += g._count._all;
        else if (g.sltsStatus === 'RETURN') stats.returned += g._count._all;
      }

      const performanceData = Array.from(groupMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.completed - a.completed);

      // Build trend buckets
      const trendMap = new Map<string, { completed: number; pending: number }>();

      if (isDailyView) {
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        for (let i = days; i >= 0; i--) {
          const d = subDays(endDate, i);
          trendMap.set(format(d, 'MMM d'), { completed: 0, pending: 0 });
        }
      } else {
        for (let i = monthsToShow - 1; i >= 0; i--) {
          const d = subMonths(endDate, i);
          trendMap.set(format(d, 'MMM'), { completed: 0, pending: 0 });
        }
      }

      // Bin completed trend by completedDate
      for (const item of trendCompletedRaw) {
        if (!item.completedDate) continue;
        const k = isDailyView ? format(item.completedDate, 'MMM d') : format(item.completedDate, 'MMM');
        const trend = trendMap.get(k);
        if (trend) trend.completed += item._count._all;
      }

      // Bin pending trend by statusDate
      for (const item of trendPendingRaw) {
        if (!item.statusDate) continue;
        const k = isDailyView ? format(item.statusDate, 'MMM d') : format(item.statusDate, 'MMM');
        const trend = trendMap.get(k);
        if (trend) trend.pending += item._count._all;
      }

      const trendData = Array.from(trendMap.entries()).map(([month, data]) => ({ month, ...data }));

      return {
        performanceData,
        trendData,
        summary: { total, completed, pending, returned },
        dateRange: { from: startDate, to: endDate, period },
        groupBy,
      };
    }

    throw AppError.badRequest('INVALID_VIEW_TYPE');
  }

  /**
   * Generates Daily Operational Report
   */
  static async getDailyOperationalReport(options: DailyOperationalReportOptions) {
    const { date } = options;
    const selectedDate = date ? new Date(date) : new Date();
    const dateKey = date || slDateKey(selectedDate);

    // Past days are served verbatim from the frozen end-of-day snapshot; live fallback when none exists.
    if (selectedDate < getSriLankaStartOfDay(new Date())) {
      try {
        const snaps = await prisma.dailyReportSnapshot.findMany({
          where: { snapshotDate: new Date(`${dateKey}T00:00:00.000Z`) },
          orderBy: { orderIndex: 'asc' }
        });
        if (snaps.length > 0) {
          return {
            reportData: snaps.map(s => s.payload as unknown as ReportRow),
            date: dateKey,
            snapshot: true
          };
        }
      } catch (err) {
        console.error('[DailyReport] snapshot read failed, computing live:', err);
      }
    }

    const reportData = await ReportService.computeDailyOperationalReport(selectedDate);

    // Same-day self-heal: today's live views refresh the provisional snapshot (idempotent).
    if (slDateKey(selectedDate) === slDateKey(new Date())) {
      try {
        await ReportService.writeDailyReportSnapshot(dateKey, reportData);
      } catch (err) {
        console.error('[DailyReport] same-day snapshot persist failed:', err);
      }
    }

    return {
      reportData,
      date: dateKey,
      snapshot: false
    };
  }

  /** Pure live computation of the daily report rows (no snapshot logic). */
  private static async computeDailyOperationalReport(selectedDate: Date): Promise<ReportRow[]> {
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
              { updatedAt: { gte: startDate, lte: endDate } },
              // Fetch SODs whose only today-relevant event is a statusHistory row.
              { statusHistory: { some: { statusDate: { gte: startDate, lte: endDate } } } }
            ]
          },
          select: {
            id: true,
            createdAt: true,
            status: true,
            sltsStatus: true,
            statusDate: true,
            receivedDate: true,
            completedDate: true,
            opmcPatStatus: true,
            hoPatStatus: true,
            sltsPatStatus: true,
            orderType: true,
            package: true,
            wiredOnly: true,
            delayReasons: true,
            teamId: true,
            materialSource: true,
            stbShortage: true,
            ontShortage: true,
            materialUsage: {
              select: {
                quantity: true,
                item: {
                  select: {
                    code: true
                  }
                }
              }
            },
            erectedPoles: {
              select: {
                poleType: true
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

    const dayWindow: SodDayWindow = { start: startDate, end: endDate };

    // Morning carry-forward: orders received before today that are still pending.
    // Uses same logic as pending SODs table: excludes COMPLETED, INSTALL_CLOSED, RETURN, DISAPPEARED
    // and only includes PENDING, ASSIGNED, ASSIGN, INPROGRESS, PROV_CLOSED statuses.
    // receivedDate is canonical; fall back to createdAt when null.
    const excludedStatuses: ServiceOrderStatus[] = [...SOD_EXCLUDED_FROM_PENDING] as ServiceOrderStatus[];
    const pendingStatuses: ServiceOrderStatus[] = [...SOD_PENDING_DEFAULT_STATUSES] as ServiceOrderStatus[];

    const inHandMorningWhere: Prisma.ServiceOrderWhereInput = {
      OR: [
        { receivedDate: { lt: startDate } },
        { AND: [{ receivedDate: null }, { createdAt: { lt: startDate } }] }
      ],
      sltsStatus: { notIn: excludedStatuses },
      status: { in: pendingStatuses }
    };

    const [inHandMorningOrders, stbShortageInHandRaw, ontShortageInHandRaw] = await Promise.all([
      prisma.serviceOrder.groupBy({
        by: ['rtom', 'orderType'],
        where: inHandMorningWhere,
        _count: { id: true }
      }),
      prisma.serviceOrder.groupBy({
        by: ['rtom'],
        where: { ...inHandMorningWhere, stbShortage: true },
        _count: { id: true }
      }),
      prisma.serviceOrder.groupBy({
        by: ['rtom'],
        where: { ...inHandMorningWhere, ontShortage: true },
        _count: { id: true }
      })
    ]);

    const stbShortageMap = new Map<string, number>(stbShortageInHandRaw.map(r => [r.rtom, r._count.id]));
    const ontShortageMap = new Map<string, number>(ontShortageInHandRaw.map(r => [r.rtom, r._count.id]));

    const reportData: ReportRow[] = opmcs.map(opmc => {
      // Deduplicate orders (OPMC relation join can return duplicate rows for the same order)
      const seenIds = new Set<string>();
      const orders = (opmc.serviceOrders as unknown as ServiceOrderWithRelations[]).filter(o => {
        if (seenIds.has(o.id)) return false;
        seenIds.add(o.id);
        return true;
      });
      const regularTeams = opmc.contractorTeams.length;

      // One classification per SOD drives every counter of this row, so no two columns
      // can disagree about which day an SOD belongs to.
      const activities = orders.map((order) => ({
        order,
        activity: classifySodDayActivity(order, dayWindow),
      }));

      // Only count teams from orders actively in today's flow (received today or still pending)
      const teamsWorked = new Set(
        activities
          .filter(({ activity }) => activity.receivedToday || activity.pendingNow)
          .map(({ order }) => order.teamId)
          .filter(Boolean)
      ).size;

      // Family split delegates to the shared categorizeSodOrder rule (sod-constants.ts).
      const categorizeOrder = (order: { orderType?: string | null; package?: string | null }) =>
        categorizeSodOrder(order.orderType, order.package).family;

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
      const returned: ReturnedEntry = { nc: 0, rl: 0, data: 0, total: 0 };
      const wiredOnly: WiredOnlyEntry = { nc: 0, rl: 0, data: 0, total: 0 };
      const installClosed: InstallClosedEntry = { create: 0, recon: 0, upgrade: 0, fnc: 0, or: 0, ml: 0, frl: 0, data: 0, total: 0 };
      const delays: DelaysEntry = { ontShortage: 0, stbShortage: 0, nokia: 0, system: 0, opmc: 0, cxDelay: 0, sameDay: 0, polePending: 0 };
      // Balance halves counted directly instead of derived by subtracting the day's
      // closures from a queue that already dropped them (inHandMorning is measured on the
      // current status, so a job received in July and closed today is absent from it).
      const receivedStillOpen: { nc: number; rl: number; data: number } = { nc: 0, rl: 0, data: 0 };
      // Morning-queue rows treated as out of the working balance because they are wired only.
      const morningWiredOnly: { nc: number; rl: number; data: number } = { nc: 0, rl: 0, data: 0 };
      const completedSods: ServiceOrderWithRelations[] = [];

      activities.forEach(({ order, activity }) => {
        // One categorize call supplies the NC/RL/DATA family and the completed bucket.
        const { family: category, bucket } = categorizeSodOrder(order.orderType, order.package);

        if (activity.receivedToday) {
          received[category]++;
          received.total++;
        }

        if (activity.completedToday) {
          // Same categorizeSodOrder rule as the family split — the views cannot drift.
          completed[bucket]++;
          completed.total++;
          // Material is charged to the day the work was finished, so only completions consume.
          completedSods.push(order);
        }

        if (activity.installClosedToday) {
          // Same bucket rule as Completed Orders, so the two breakdowns are comparable.
          installClosed[bucket]++;
          installClosed.total++;
        }

        // Returns mirror the Return page: capture instant anchor, PAT-REJECTED excluded.
        if (activity.returnedToday && !activity.patRejected) {
          returned[category]++;
          returned.total++;
        }

        // Wired only is scoped to orders in today's flow (received today or morning carry-forward)
        const wiredOnlyish =
          activity.provClosedToday || activity.provClosedEventToday || activity.wiredOnlyFlagged;

        if (wiredOnlyish && activity.inTodayFlow) {
          wiredOnly[category]++;
          wiredOnly.total++;
        }

        // Intake that is still open at report time: the balance half that inHandMorning
        // cannot see, because those orders arrived inside the report day.
        if (activity.receivedToday && activity.pendingNow && !wiredOnlyish) {
          receivedStillOpen[category]++;
        }

        // Backlog that is wired only stays out of the working balance.
        if (wiredOnlyish && activity.morningCarryForward && !activity.completedToday) {
          morningWiredOnly[category]++;
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
      });

      const material: MaterialEntry = sumMaterialsForSods(completedSods);

      // FNC = CR+RC+UP, FRL = OR+ML — group subtotals; F-NC/F-RL order types do not exist in portal data.
      completed.fnc = completed.create + completed.recon + completed.upgrade;
      completed.frl = completed.or + completed.ml;
      installClosed.fnc = installClosed.create + installClosed.recon + installClosed.upgrade;
      installClosed.frl = installClosed.or + installClosed.ml;

      const totalInHand = inHandMorning.total + received.total;

      const balance: BalanceEntry = {
        nc: inHandMorning.nc - morningWiredOnly.nc + receivedStillOpen.nc,
        rl: inHandMorning.rl - morningWiredOnly.rl + receivedStillOpen.rl,
        data: inHandMorning.data - morningWiredOnly.data + receivedStillOpen.data,
        total: 0
      };
      balance.total = balance.nc + balance.rl + balance.data;

      // Shortages scoped to in-hand (morning carry-forward) orders, not all day-touched orders
      const shortages: ShortagesEntry = {
        stb: stbShortageMap.get(opmc.rtom) || 0,
        ont: ontShortageMap.get(opmc.rtom) || 0
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
        installClosed,
        delays,
        balance,
        shortages
      };
    });

    return reportData;
  }

  /** Idempotently writes the frozen snapshot rows for one calendar day. */
  static async writeDailyReportSnapshot(dateKey: string, reportData: ReportRow[]): Promise<void> {
    const day = new Date(`${dateKey}T00:00:00.000Z`);
    await prisma.$transaction([
      prisma.dailyReportSnapshot.deleteMany({ where: { snapshotDate: day } }),
      prisma.dailyReportSnapshot.createMany({
        data: reportData.map((r, i) => ({
          snapshotDate: day,
          orderIndex: i,
          rtom: r.rtom,
          region: r.region,
          province: r.province,
          payload: r as unknown as Prisma.InputJsonValue
        }))
      })
    ]);
  }

  /** End-of-day close: computes live and freezes the day (never reads a snapshot). */
  static async persistDailyReportSnapshot(dateKey: string): Promise<number> {
    const reportData = await ReportService.computeDailyOperationalReport(new Date(`${dateKey}T00:00:00.000Z`));
    await ReportService.writeDailyReportSnapshot(dateKey, reportData);
    return reportData.length;
  }

  /**
   * Generates Payments Report
   */
  static async getPaymentsReport(options: PaymentsReportOptions) {
    const { from_date, to_date, payment_type, status, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.VMPaymentWhereInput = {};
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
        total_base_amount: acc.total_base_amount + Number(p.base_amount),
        total_tax_amount: acc.total_tax_amount + Number(p.tax_amount),
        total_amount: acc.total_amount + Number(p.total_amount),
      }),
      { total_count: 0, total_base_amount: 0, total_tax_amount: 0, total_amount: 0 }
    );

    const byTypeMap = new Map<string, { count: number; total_amount: number }>();
    payments.forEach((p) => {
      const key = p.payment_type;
      const existing = byTypeMap.get(key) || { count: 0, total_amount: 0 };
      existing.count += 1;
      existing.total_amount += Number(p.total_amount);
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
