export const WORKFLOW_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'ON_HOLD'] as const;

/**
 * Pure stage state machine used by WorkflowEngine.transitionStage.
 * Returns an error message when the transition is not allowed, otherwise null.
 */
export function getStageTransitionError(
  currentStatus: string,
  nextStatus: string,
  isCurrentStage: boolean,
): string | null {
  if (currentStatus === 'COMPLETED') {
    return 'Workflow stage is already COMPLETED and cannot be changed';
  }
  if (!isCurrentStage) {
    return 'Only the current workflow stage can change status';
  }
  if (currentStatus === nextStatus) {
    return `Workflow stage is already ${currentStatus}`;
  }

  const allowed: Record<string, string[]> = {
    IN_PROGRESS: ['COMPLETED', 'BLOCKED', 'ON_HOLD'],
    BLOCKED: ['IN_PROGRESS', 'ON_HOLD'],
    ON_HOLD: ['IN_PROGRESS', 'BLOCKED'],
    CHANGES_REQUESTED: ['IN_PROGRESS'],
  };
  if (!allowed[currentStatus]?.includes(nextStatus)) {
    return `Workflow stage cannot move from ${currentStatus} to ${nextStatus}`;
  }
  return null;
}
