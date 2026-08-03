/**
 * UUID validation helpers.
 *
 * After the UUID v7 migration several columns are typed `uuid` in Postgres.
 * Writing non-UUID strings ('system', 'ADMIN_ID', document numbers) into them
 * crashes with Prisma P2023. All actor-id values coming from request bodies
 * MUST pass through these helpers before hitting the database.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the value is a syntactically valid UUID string. */
export function isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value);
}

/** Returns the value when it is a valid UUID, otherwise null. */
export function toUuidOrNull(value: unknown): string | null {
    return isValidUuid(value) ? value : null;
}

/**
 * Resolves an actor user id for uuid-typed columns.
 * Prefers a valid client-supplied value, falls back to the session user,
 * and yields null when neither is a real user UUID.
 */
export function resolveUserId(clientValue: unknown, sessionUserId: string | null | undefined): string | null {
    if (isValidUuid(clientValue)) return clientValue;
    return toUuidOrNull(sessionUserId);
}
