export interface NavigationStage { id: string; name: string; status: string; sequence?: number }

export type ProjectStageAccess = 'current' | 'completed' | 'locked';

/** Prefer persisted stage identity; review/rework is not a pending next stage. */
export function resolveCurrentProjectStage<T extends NavigationStage>(stages: T[], currentStageId?: string | null): T | undefined {
    const ordered = [...stages].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const current = ordered.find(stage => stage.id === currentStageId);
    if (current && !['COMPLETED', 'SKIPPED'].includes(current.status)) return current;
    return ordered.find(stage => ['IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED', 'BLOCKED'].includes(stage.status))
        ?? ordered.find(stage => stage.status === 'PENDING')
        ?? ordered.at(-1);
}

/**
 * Keep the project UI aligned with the persisted workflow cursor.
 *
 * Completed stages remain available for read-only review. The persisted
 * current stage is the only stage that can be worked on. Pending stages are
 * intentionally locked until the current stage gate promotes them.
 */
export function getProjectStageAccess(
    stage: NavigationStage,
    currentStageId?: string | null,
): ProjectStageAccess {
    if (stage.status === 'COMPLETED' || stage.status === 'SKIPPED') return 'completed';
    if (stage.id === currentStageId) return 'current';
    return 'locked';
}
