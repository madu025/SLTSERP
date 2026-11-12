/**
 * Entity types whose workflow is actually driven by the Process Gate engine at runtime:
 *  - MATERIAL_REQUEST  (stock-request.service: submit, approve, dispatch stages and the approval queue)
 *  - SERVICE_ORDER     (sod-status.writer: status writes start the matching gate)
 * Project BOQ and change-request approvals read their policy through project-approval-policy.service and are edited
 * from the project workflow configuration, not from the generic gate screens.
 *
 * A gate saved for any other entity type is never started by a module, so it would approve nothing. The admin
 * screens use this list to say so instead of letting an administrator believe a control is in place.
 */
export const PROCESS_GATE_RUNTIME_ENTITIES: readonly string[] = ['MATERIAL_REQUEST', 'SERVICE_ORDER'];

export function isGateModuleConnected(entityType: string): boolean {
  return PROCESS_GATE_RUNTIME_ENTITIES.includes(entityType);
}
