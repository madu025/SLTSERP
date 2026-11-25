/**
 * Which capabilities the RBAC seed may reconcile.
 *
 * The seed rewrites every catalogue capability from the bootstrap grants. The notification audiences (notification.audience.*) are the
 * exception once they have been given to anybody: the administrator manages who is in an audience on the page "Automated reports and
 * alerts", and a change made there must survive the next deploy. So an audience capability that already has grants in the database is left
 * as it is; one that has none yet (a new audience) gets its starting grants from the bootstrap.
 */
export const AUDIENCE_CAPABILITY_PREFIX = 'notification.audience.';

/** The capability codes the seed leaves alone: the audiences that already have at least one grant. */
export function codesToPreserve(allCodes: readonly string[], codesWithExistingGrants: ReadonlySet<string>): Set<string> {
    return new Set(allCodes.filter((code) => code.startsWith(AUDIENCE_CAPABILITY_PREFIX) && codesWithExistingGrants.has(code)));
}
