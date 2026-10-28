const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduleDependencyInput {
  type?: string | null;
  lagDays?: number | null;
  dependsOn?: {
    id?: string;
    status?: string | null;
    plannedStartDate?: string | Date | null;
    plannedEndDate?: string | Date | null;
  } | null;
}

export interface ScheduleTaskInput {
  id: string;
  wbsCode: string;
  name: string;
  status: string;
  actualProgress: unknown;
  plannedStartDate?: string | Date | null;
  plannedEndDate?: string | Date | null;
  plannedDuration?: number | string | null;
  actualStartDate?: string | Date | null;
  actualEndDate?: string | Date | null;
  isCritical?: boolean;
  dependencies?: ScheduleDependencyInput[];
}

export interface TimelineTask {
  id: string;
  wbsCode: string;
  name: string;
  status: string;
  actualProgress: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  plannedDuration: number | null;
  plannedOffsetDays: number | null;
  plannedDurationDays: number | null;
  actualOffsetDays: number | null;
  actualDurationDays: number | null;
  delayDays: number;
  isDelayed: boolean;
  isBlocked: boolean;
  isCritical: boolean;
  outOfProjectWindow: boolean;
}

export interface ProjectScheduleSnapshot {
  projectStartDate: string | null;
  projectEndDate: string | null;
  timelineStartDate: string;
  timelineEndDate: string;
  totalDurationDays: number;
  elapsedDays: number;
  remainingDays: number;
  projectProgress: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksDelayed: number;
  tasksBlocked: number;
  tasksWithoutDates: number;
  tasks: TimelineTask[];
}

export interface TaskScheduleValidationInput {
  projectStartDate?: string | Date | null;
  projectEndDate?: string | Date | null;
  plannedStartDate?: string | Date | null;
  plannedEndDate?: string | Date | null;
  plannedDuration?: number | string | null;
}

export interface NormalizedTaskSchedule {
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  plannedDuration: number | null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeTaskSchedule(input: TaskScheduleValidationInput): NormalizedTaskSchedule {
  const plannedStartDate = toDate(input.plannedStartDate);
  const explicitEndDate = toDate(input.plannedEndDate);
  const parsedDuration = input.plannedDuration === null || input.plannedDuration === undefined || String(input.plannedDuration).trim() === ''
    ? null
    : Number(input.plannedDuration);
  const plannedDuration = parsedDuration === null ? null : Math.ceil(parsedDuration);

  if (input.plannedStartDate && !plannedStartDate) throw new Error('INVALID_TASK_START_DATE');
  if (input.plannedEndDate && !explicitEndDate) throw new Error('INVALID_TASK_END_DATE');
  if (plannedDuration !== null && (!Number.isFinite(plannedDuration) || plannedDuration < 1)) {
    throw new Error('INVALID_TASK_DURATION');
  }

  const plannedEndDate = explicitEndDate || (plannedStartDate && plannedDuration
    ? addDays(plannedStartDate, plannedDuration - 1)
    : null);

  if (plannedStartDate && plannedEndDate && plannedEndDate < plannedStartDate) {
    throw new Error('INVALID_TASK_DATE_RANGE');
  }

  const projectStartDate = toDate(input.projectStartDate);
  const projectEndDate = toDate(input.projectEndDate);
  if (input.projectStartDate && !projectStartDate) throw new Error('INVALID_PROJECT_START_DATE');
  if (input.projectEndDate && !projectEndDate) throw new Error('INVALID_PROJECT_END_DATE');
  if (projectStartDate && projectEndDate && projectEndDate < projectStartDate) {
    throw new Error('INVALID_PROJECT_DATE_RANGE');
  }
  if (projectStartDate && plannedStartDate && plannedStartDate < projectStartDate) {
    throw new Error('TASK_START_OUTSIDE_PROJECT_WINDOW');
  }
  if (projectEndDate && plannedEndDate && plannedEndDate > projectEndDate) {
    throw new Error('TASK_END_OUTSIDE_PROJECT_WINDOW');
  }

  return { plannedStartDate, plannedEndDate, plannedDuration };
}

export function dependencyDateConflict(
  type: string | null | undefined,
  lagDays: number | null | undefined,
  task: { plannedStartDate: Date | null; plannedEndDate: Date | null },
  prerequisite: { plannedStartDate: Date | null; plannedEndDate: Date | null },
): boolean {
  const dependencyType = String(type || 'FINISH_TO_START').toUpperCase();
  const lag = Number(lagDays || 0);
  if (!Number.isFinite(lag)) return true;

  switch (dependencyType) {
    case 'START_TO_START':
      return Boolean(task.plannedStartDate && prerequisite.plannedStartDate &&
        task.plannedStartDate < addDays(prerequisite.plannedStartDate, lag));
    case 'FINISH_TO_FINISH':
      return Boolean(task.plannedEndDate && prerequisite.plannedEndDate &&
        task.plannedEndDate < addDays(prerequisite.plannedEndDate, lag));
    case 'START_TO_FINISH':
      return Boolean(task.plannedEndDate && prerequisite.plannedStartDate &&
        task.plannedEndDate < addDays(prerequisite.plannedStartDate, lag));
    case 'FINISH_TO_START':
    default:
      return Boolean(task.plannedStartDate && prerequisite.plannedEndDate &&
        task.plannedStartDate < addDays(prerequisite.plannedEndDate, lag + 1));
  }
}

function startOfDay(date: Date): Date {
  // Project/task dates are calendar dates. Normalize in UTC so a server's
  // local timezone cannot shift a date-only value into the previous day.
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function dateDiffDays(from: Date, to: Date): number {
  return Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(startOfDay(date).getTime() + days * DAY_MS);
}

function maxDate(dates: Date[]): Date | null {
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
}

function minDate(dates: Date[]): Date | null {
  return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
}

function resolvedPlannedEnd(task: ScheduleTaskInput, plannedStart: Date | null, plannedEnd: Date | null): Date | null {
  if (plannedEnd) return plannedEnd;
  const duration = Number(task.plannedDuration);
  if (plannedStart && Number.isFinite(duration) && duration > 0) return addDays(plannedStart, Math.max(0, Math.ceil(duration) - 1));
  return null;
}

export function buildProjectSchedule(
  project: { startDate?: string | Date | null; endDate?: string | Date | null; progress?: unknown },
  tasks: ScheduleTaskInput[],
  now: Date = new Date(),
): ProjectScheduleSnapshot {
  const projectStart = toDate(project.startDate);
  const projectEnd = toDate(project.endDate);
  const parsedTasks = tasks.map((task) => {
    const plannedStart = toDate(task.plannedStartDate);
    const plannedEnd = resolvedPlannedEnd(task, plannedStart, toDate(task.plannedEndDate));
    const actualStart = toDate(task.actualStartDate);
    const actualEnd = toDate(task.actualEndDate);
    return { task, plannedStart, plannedEnd, actualStart, actualEnd };
  });

  const datedTaskStarts = parsedTasks.flatMap(({ plannedStart, actualStart }) => plannedStart ? [plannedStart] : actualStart ? [actualStart] : []);
  const datedTaskEnds = parsedTasks.flatMap(({ plannedEnd, actualEnd, plannedStart }) => plannedEnd ? [plannedEnd] : actualEnd ? [actualEnd] : plannedStart ? [plannedStart] : []);
  const timelineStart = projectStart || minDate(datedTaskStarts) || startOfDay(now);
  const timelineEnd = projectEnd || maxDate(datedTaskEnds) || addDays(timelineStart, 30);
  const safeTimelineEnd = timelineEnd < timelineStart ? timelineStart : timelineEnd;

  const timelineTasks = parsedTasks.map(({ task, plannedStart, plannedEnd, actualStart, actualEnd }): TimelineTask => {
    const taskStatus = String(task.status || 'PENDING').toUpperCase();
    const plannedDurationDays = plannedStart && plannedEnd ? Math.max(1, dateDiffDays(plannedStart, plannedEnd) + 1) : null;
    const actualDurationDays = actualStart && actualEnd ? Math.max(1, dateDiffDays(actualStart, actualEnd) + 1) : null;
    const delayDays = plannedEnd && taskStatus === 'COMPLETED' && actualEnd
      ? Math.max(0, dateDiffDays(plannedEnd, actualEnd))
      : plannedEnd && taskStatus !== 'COMPLETED'
        ? Math.max(0, dateDiffDays(plannedEnd, now))
        : 0;
    const isBlocked = (task.dependencies || []).some((dependency) => String(dependency.dependsOn?.status || '').toUpperCase() !== 'COMPLETED');
    const outOfProjectWindow = Boolean(
      (projectStart && plannedStart && plannedStart < projectStart) ||
      (projectEnd && plannedEnd && plannedEnd > projectEnd),
    );

    return {
      id: task.id,
      wbsCode: task.wbsCode,
      name: task.name,
      status: taskStatus,
      actualProgress: Number(task.actualProgress || 0),
      plannedStartDate: toIso(plannedStart),
      plannedEndDate: toIso(plannedEnd),
      actualStartDate: toIso(actualStart),
      actualEndDate: toIso(actualEnd),
      plannedDuration: task.plannedDuration == null ? null : Number(task.plannedDuration),
      plannedOffsetDays: plannedStart ? dateDiffDays(timelineStart, plannedStart) : null,
      plannedDurationDays,
      actualOffsetDays: actualStart ? dateDiffDays(timelineStart, actualStart) : null,
      actualDurationDays,
      delayDays,
      isDelayed: delayDays > 0,
      isBlocked,
      isCritical: Boolean(task.isCritical),
      outOfProjectWindow,
    };
  });

  const elapsedDays = Math.max(0, Math.min(dateDiffDays(timelineStart, now), Math.max(0, dateDiffDays(timelineStart, safeTimelineEnd))));
  return {
    projectStartDate: toIso(projectStart),
    projectEndDate: toIso(projectEnd),
    timelineStartDate: timelineStart.toISOString(),
    timelineEndDate: safeTimelineEnd.toISOString(),
    totalDurationDays: Math.max(1, dateDiffDays(timelineStart, safeTimelineEnd) + 1),
    elapsedDays,
    remainingDays: Math.max(0, dateDiffDays(now, safeTimelineEnd)),
    projectProgress: Number(project.progress || 0),
    tasksTotal: timelineTasks.length,
    tasksCompleted: timelineTasks.filter((task) => task.status === 'COMPLETED').length,
    tasksInProgress: timelineTasks.filter((task) => task.status === 'IN_PROGRESS').length,
    tasksDelayed: timelineTasks.filter((task) => task.isDelayed).length,
    tasksBlocked: timelineTasks.filter((task) => task.isBlocked).length,
    tasksWithoutDates: timelineTasks.filter((task) => !task.plannedStartDate).length,
    tasks: timelineTasks,
  };
}
