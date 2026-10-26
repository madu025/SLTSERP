import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Keep the multi-file schema and migration history explicit. Prisma otherwise
 * resolves migrations relative to a single schema.prisma file and reports the
 * existing prisma/migrations directory as empty.
 */
export default defineConfig({
    schema: 'prisma/schema',
    migrations: {
        path: 'prisma/migrations',
        seed: 'node prisma/seed.js'
    }
});
