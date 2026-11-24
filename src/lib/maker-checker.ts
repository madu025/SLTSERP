import { AppError } from '@/lib/error';

/** Maker and checker are two people: whoever recorded an item cannot approve it. Items recorded before the rule have no maker and stay approvable. */
export function assertNotMaker(createdById: string | null | undefined, actorId: string | null | undefined): void {
    if (createdById && actorId && createdById === actorId) {
        throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: You recorded this item, so someone else must approve it.');
    }
}
