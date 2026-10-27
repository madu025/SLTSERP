import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { UserService } from '../src/services/hr/user.service';

/**
 * Provision a least-privilege account for the post-deploy smoke gate.
 *
 * This command is intentionally fail-closed:
 * - credentials must come from environment variables;
 * - the explicit confirmation flag is required;
 * - an existing username/email is never modified automatically.
 */
const prisma = new PrismaClient();

const username = process.env.PRODUCTION_SMOKE_USERNAME?.trim();
const email = process.env.PRODUCTION_SMOKE_EMAIL?.trim();
const password = process.env.PRODUCTION_SMOKE_PASSWORD;

async function main() {
    if (process.env.PROVISION_SMOKE_USER_CONFIRM !== 'YES') {
        throw new Error('Set PROVISION_SMOKE_USER_CONFIRM=YES to provision the smoke user.');
    }
    if (!username || !email || !password) {
        throw new Error('PRODUCTION_SMOKE_USERNAME, PRODUCTION_SMOKE_EMAIL, and PRODUCTION_SMOKE_PASSWORD are required.');
    }
    if (password.length < 16) {
        throw new Error('PRODUCTION_SMOKE_PASSWORD must be at least 16 characters long.');
    }

    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                { username: { equals: username, mode: 'insensitive' } },
                { email: { equals: email, mode: 'insensitive' } },
            ],
        },
        select: { id: true, username: true, email: true },
    });

    if (existing) {
        throw new Error(`Smoke user already exists (${existing.username ?? existing.email}). No existing account was changed.`);
    }

    const user = await UserService.createUser({
        username,
        name: 'Production Smoke Test',
        email,
        role: 'HEAD_OF_SECTION',
        password,
        status: 'active',
    }, 'system');

    await prisma.user.update({
        where: { id: user.id },
        data: {
            mustChangePassword: false,
            permissions: JSON.stringify(['dashboard']),
        },
    });

    console.log(`[OK] Production smoke user provisioned: ${username} (${user.id})`);
    console.log('[OK] Role: HEAD_OF_SECTION; permissions: dashboard only');
}

main()
    .catch((error) => {
        console.error('[FAIL]', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
