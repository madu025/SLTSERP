import { prisma } from '@/lib/prisma';
import { buildProjectSchedule } from '@/lib/project-schedule';

export class ProjectScheduleService {
  static async getSchedule(projectId: string) {
    const [project, tasks] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, startDate: true, endDate: true, progress: true },
      }),
      prisma.projectTask.findMany({
        where: { projectId },
        select: {
          id: true,
          wbsCode: true,
          name: true,
          status: true,
          actualProgress: true,
          plannedStartDate: true,
          plannedEndDate: true,
          plannedDuration: true,
          actualStartDate: true,
          actualEndDate: true,
          isCritical: true,
          dependencies: {
            select: {
              type: true,
              lagDays: true,
              dependsOn: {
                select: { id: true, status: true, plannedStartDate: true, plannedEndDate: true },
              },
            },
          },
        },
        orderBy: [{ plannedStartDate: 'asc' }, { order: 'asc' }],
      }),
    ]);

    if (!project) throw new Error('PROJECT_NOT_FOUND');
    return buildProjectSchedule(project, tasks);
  }
}
