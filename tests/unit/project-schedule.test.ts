import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildProjectSchedule,
  dependencyDateConflict,
  normalizeTaskSchedule,
} from '../../src/lib/project-schedule';

describe('project schedule timeline', () => {
  it('anchors the timeline to the project start, not the first task', () => {
    const schedule = buildProjectSchedule(
      { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z', progress: 20 },
      [{
        id: 'task-1',
        wbsCode: '1',
        name: 'Survey',
        status: 'PENDING',
        actualProgress: 0,
        plannedStartDate: '2026-01-08T00:00:00.000Z',
        plannedEndDate: '2026-01-10T00:00:00.000Z',
        dependencies: [],
      }],
      new Date('2026-01-05T00:00:00.000Z'),
    );

    assert.equal(schedule.timelineStartDate, '2026-01-01T00:00:00.000Z');
    assert.equal(schedule.tasks[0].plannedOffsetDays, 7);
    assert.equal(schedule.totalDurationDays, 31);
  });

  it('reports delayed, blocked, and unscheduled tasks', () => {
    const schedule = buildProjectSchedule(
      { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z' },
      [
        {
          id: 'blocked', wbsCode: '1', name: 'Implementation', status: 'IN_PROGRESS', actualProgress: 30,
          plannedStartDate: '2026-01-02T00:00:00.000Z', plannedEndDate: '2026-01-03T00:00:00.000Z',
          dependencies: [{ type: 'FINISH_TO_START', lagDays: 0, dependsOn: { id: 'pre', status: 'PENDING' } }],
        },
        { id: 'unscheduled', wbsCode: '2', name: 'Invoice', status: 'PENDING', actualProgress: 0, dependencies: [] },
      ],
      new Date('2026-01-10T00:00:00.000Z'),
    );

    assert.equal(schedule.tasksBlocked, 1);
    assert.equal(schedule.tasksDelayed, 1);
    assert.equal(schedule.tasksWithoutDates, 1);
    assert.equal(schedule.tasks[0].delayDays, 7);
  });

  it('normalizes duration dates and rejects dates outside the project window', () => {
    const normalized = normalizeTaskSchedule({
      projectStartDate: '2026-01-01T00:00:00.000Z',
      projectEndDate: '2026-01-31T00:00:00.000Z',
      plannedStartDate: '2026-01-05T00:00:00.000Z',
      plannedDuration: 3,
    });
    assert.equal(normalized.plannedEndDate?.toISOString(), '2026-01-07T00:00:00.000Z');
    assert.throws(() => normalizeTaskSchedule({
      projectStartDate: '2026-01-01T00:00:00.000Z',
      plannedStartDate: '2025-12-31T00:00:00.000Z',
      plannedDuration: 1,
    }), /TASK_START_OUTSIDE_PROJECT_WINDOW/);
  });

  it('applies dependency date semantics before a dependency is persisted', () => {
    assert.equal(dependencyDateConflict(
      'FINISH_TO_START',
      0,
      { plannedStartDate: new Date('2026-01-03T00:00:00.000Z'), plannedEndDate: new Date('2026-01-04T00:00:00.000Z') },
      { plannedStartDate: new Date('2026-01-01T00:00:00.000Z'), plannedEndDate: new Date('2026-01-02T00:00:00.000Z') },
    ), false);
    assert.equal(dependencyDateConflict(
      'FINISH_TO_START',
      0,
      { plannedStartDate: new Date('2026-01-02T00:00:00.000Z'), plannedEndDate: new Date('2026-01-04T00:00:00.000Z') },
      { plannedStartDate: new Date('2026-01-01T00:00:00.000Z'), plannedEndDate: new Date('2026-01-02T00:00:00.000Z') },
    ), true);
  });
});
