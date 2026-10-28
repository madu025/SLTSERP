import { z } from 'zod';
import { isValidUuid } from '@/lib/uuid';

/** Accept syntactically valid database UUIDs, including legacy/UUIDv7 values. */
export const databaseUuidSchema = z.string().refine(isValidUuid, {
    message: 'Invalid UUID',
});
