/**
 * The action an approved process gate runs when its policy has none configured.
 *
 * A Service Order gate holds the status change until it is approved. Approving only marks the approval record; something
 * must then apply the status. The domain actions exist (HANDLE_SOD_COMPLETED, HANDLE_SOD_ASSIGNED) but the production
 * policies were saved without one, so a fully approved completion never reached COMPLETED and every retry opened a new
 * approval. When no action is configured, a Service Order gate applies its own target status.
 */
export function defaultGateDomainAction(entityType: string, toStatus: string | null | undefined): string | undefined {
    if (entityType !== 'SERVICE_ORDER') return undefined;
    if (toStatus === 'COMPLETED') return 'HANDLE_SOD_COMPLETED';
    if (toStatus === 'INPROGRESS') return 'HANDLE_SOD_ASSIGNED';
    return undefined;
}
