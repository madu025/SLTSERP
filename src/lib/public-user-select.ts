import type { Prisma } from '@prisma/client';

/**
 * The fields of a person that may travel with a record to the browser (who requested, received, approved it).
 * Never include a User relation with `true`: that sends the password hash, security answer and token version too.
 */
export const PUBLIC_USER_SELECT = {
    id: true,
    name: true,
    username: true,
    role: true,
    staffId: true,
    employeeId: true,
} satisfies Prisma.UserSelect;
