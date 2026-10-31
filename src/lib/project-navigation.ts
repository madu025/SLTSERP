export interface NavigationStage { id: string; name: string; status: string; sequence?: number }

/** Prefer persisted stage identity; review/rework is not a pending next stage. */
export function resolveCurrentProjectStage<T extends NavigationStage>(stages: T[], currentStageId?: string | null): T | undefined {
    const ordered = [...stages].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const current = ordered.find(stage => stage.id === currentStageId);
    if (current && !['COMPLETED', 'SKIPPED'].includes(current.status)) return current;
    return ordered.find(stage => ['IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED', 'BLOCKED'].includes(stage.status))
        ?? ordered.find(stage => stage.status === 'PENDING')
        ?? ordered.at(-1);
}
