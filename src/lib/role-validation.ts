import { Role } from '@prisma/client';
import { AppError } from '@/lib/error';
import { isValidRole } from '@/config/valid-roles';

/**
 * Runtime guard for values received from the admin UI or external imports.
 * The Prisma Role enum is the canonical role domain; unknown organization
 * labels must not silently become authorization roles.
 */
export function isDatabaseRole(value: unknown): value is Role {
    return typeof value === 'string' && isValidRole(value);
}

/**
 * Validate a role before it is persisted or placed in a session.
 * Organization-specific human-readable titles belong to SystemRole.name;
 * User.role remains the stable authorization capability key.
 */
export function assertDatabaseRole(value: unknown): asserts value is Role {
    if (!isDatabaseRole(value)) {
        throw AppError.badRequest('INVALID_ROLE', {
            message: 'Role must be one of the database Role enum values',
        });
    }
}
