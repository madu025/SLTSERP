import { prisma } from '@/lib/prisma';

export class ContractorKPIService {
  /**
   * Auto-calculate monthly KPI score for a contractor from live data
   */
  static async calculateMonthlyScore(contractorId: string, month: string, projectId?: string) {
    // month format: "YYYY-MM"
    const [yearStr, monthStr] = month.split('-');
    const startDate = new Date(`${yearStr}-${monthStr}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 1. Timeline Adherence from tasks
    const taskStats = await prisma.projectTask.aggregate({
      where: {
        project: { contractorId },
        createdAt: { gte: startDate, lt: endDate },
      },
      _count: { id: true },
    });
    const completedTasks = await prisma.projectTask.count({
      where: {
        project: { contractorId },
        status: 'COMPLETED',
        createdAt: { gte: startDate, lt: endDate },
      },
    });
    const delayedTasks = await prisma.projectTask.count({
      where: {
        project: { contractorId },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        plannedEndDate: { lt: new Date() },
        createdAt: { gte: startDate, lt: endDate },
      },
    });
    const totalTasks = taskStats._count.id;
    const timelineScore = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100;

    // 2. PAT Quality Score from PAT sessions
    const patSessions = await prisma.pATSession.findMany({
      where: {
        project: { contractorId },
        createdAt: { gte: startDate, lt: endDate },
        status: { in: ['COMPLETED', 'FAILED'] },
      },
      select: { passRate: true, fineTuneNeeded: true },
    });
    const patQualityScore = patSessions.length > 0
      ? patSessions.reduce((sum, s) => sum + (s.passRate ?? 0), 0) / patSessions.length
      : 100;

    // 3. Safety Score from HSE logs
    const hseIncidents = await prisma.hSESafetyLog.count({
      where: {
        project: { contractorId },
        date: { gte: startDate, lt: endDate },
        logType: 'INCIDENT',
        injuryCount: { gt: 0 },
      },
    });
    const safetyScore = Math.max(0, 100 - hseIncidents * 10);

    // 4. Rework Count from fine-tune points
    const reworkCount = await prisma.pATPointResult.count({
      where: {
        patSession: { project: { contractorId } },
        fineTuneNeeded: true,
        createdAt: { gte: startDate, lt: endDate },
      },
    });

    // 5. Timeline Adherence %
    const timelineAdherencePct = totalTasks > 0
      ? ((totalTasks - delayedTasks) / totalTasks) * 100
      : 100;

    // Weighted overall score
    const overallScore =
      timelineScore * 0.3 +
      patQualityScore * 0.35 +
      safetyScore * 0.2 +
      timelineAdherencePct * 0.15;

    // Upsert the performance score record
    const existing = await prisma.contractorPerformanceScore.findFirst({
      where: { contractorId, evaluationMonth: month },
    });

    const data = {
      score: Math.round(overallScore * 10) / 10,
      scheduleScore: Math.round(timelineScore * 10) / 10,
      qualityScore: Math.round(patQualityScore * 10) / 10,
      safetyScore: Math.round(safetyScore * 10) / 10,
      patPassPct: Math.round(patQualityScore * 10) / 10,
      reworkCount,
      timelineAdherencePct: Math.round(timelineAdherencePct * 10) / 10,
      completedTasksCount: completedTasks,
      delayedTasksCount: delayedTasks,
      totalTasksAssigned: totalTasks,
      hseIncidentCount: hseIncidents,
      autoCalculated: true,
      evaluatedAt: new Date(),
    };

    if (existing) {
      return prisma.contractorPerformanceScore.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.contractorPerformanceScore.create({
      data: {
        contractorId,
        projectId,
        evaluationMonth: month,
        ...data,
      },
    });
  }

  /**
   * Get contractor ranking across all months
   */
  static async getContractorRanking(limit = 10) {
    const latest = await prisma.contractorPerformanceScore.findMany({
      distinct: ['contractorId'],
      orderBy: [{ evaluationMonth: 'desc' }, { score: 'desc' }],
      take: limit,
      select: {
        contractorId: true,
        evaluationMonth: true,
        score: true,
        qualityScore: true,
        safetyScore: true,
        scheduleScore: true,
        patPassPct: true,
        contractor: { select: { name: true, contactNumber: true } },
      },
    });

    return latest.map((item, i) => ({
      rank: i + 1,
      contractorId: item.contractorId,
      name: item.contractor.name,
      score: item.score,
      qualityScore: item.qualityScore,
      safetyScore: item.safetyScore,
      scheduleScore: item.scheduleScore,
      patPassPct: item.patPassPct,
      month: item.evaluationMonth,
    }));
  }
}
