import { roleLabel } from '@/lib/gate-eligibility';

/**
 * The gate screen speaks to administrators, not to the database: a step is "Area Coordinator, anyone with that role in the item's own
 * area", not `AREA_COORDINATOR / invoice.confirm.coordinator / ROLE`. Pure, so the wording is testable.
 */
export interface StepInput {
    requiredRole: string;
    assignee?: string | null;
    skipIfNoApprover?: boolean | null;
    specificUserId?: string | null;
}

const ITEM: Record<string, string> = { MATERIAL_REQUEST: 'request', INVOICE: 'invoice', SERVICE_ORDER: 'service order', PURCHASE_ORDER: 'purchase order', STOCK_TRANSFER: 'transfer' };
export function itemName(entityType: string): string {
    return ITEM[entityType] ?? 'item';
}

export function describeStep(step: StepInput, opts: { queueMode: boolean; entityType: string }) {
    const title = roleLabel(step.requiredRole);
    const item = itemName(opts.entityType);
    const who = step.assignee === 'ORDER_CONTRACTOR'
        ? `The contractor of the ${item}`
        : step.specificUserId
            ? 'One named person'
            : opts.queueMode
                ? `Anyone with the ${title} role in the ${item}'s own area`
                : `Anyone with the ${title} role`;
    const rule = step.skipIfNoApprover ? 'Skipped when nobody holding this role works in the area' : null;
    return { title, who, rule };
}

/** "An invoice moves from Created to Area approved" in words. */
export function gateSentence(entityType: string, fromLabel: string, toLabel: string): string {
    const item = itemName(entityType);
    const article = /^[aeiou]/i.test(item) ? 'An' : 'A';
    return `${article} ${item} moves from "${fromLabel}" to "${toLabel}" once these steps have approved it, in this order.`;
}

export type StepHealth = 'ok' | 'warn' | 'info';

/**
 * Is anybody able to act on this step? `holders` is how many active people hold it (null when it cannot be counted, e.g. a named person);
 * `areasWithout` is how many areas that have contractors have nobody holding it (queue gates only).
 */
export function stepHealth(input: { holders: number | null; areasWithout: number | null; skipIfNoApprover: boolean }): { level: StepHealth; text: string } {
    const { holders, areasWithout, skipIfNoApprover } = input;
    if (holders === null) return { level: 'info', text: 'Approver is chosen when the step starts' };
    if (holders === 0) {
        return skipIfNoApprover
            ? { level: 'info', text: 'Nobody holds this role yet, so the step is always skipped' }
            : { level: 'warn', text: 'Nobody holds this role: items will wait here until someone does' };
    }
    if (areasWithout && areasWithout > 0 && !skipIfNoApprover) {
        return { level: 'warn', text: `${holders} approver${holders === 1 ? '' : 's'}, but ${areasWithout} area${areasWithout === 1 ? ' has' : 's have'} nobody: items there will wait` };
    }
    return { level: 'ok', text: `${holders} approver${holders === 1 ? '' : 's'}` };
}
