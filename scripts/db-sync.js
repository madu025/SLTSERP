// @ts-nocheck
/* eslint-disable */
/**
 * Database Sync Script - Uses @prisma/client directly (NO CLI needed)
 * Works in any Docker container without npx or prisma binary
 */

const { PrismaClient } = require('@prisma/client');

async function sync() {
    console.log('🚀 Starting Database Synchronization (via Prisma Client)...');

    const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL not set. Skipping sync.');
        process.exit(0); // Non-fatal - app will still start
    }

    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`📌 Using DB: ${maskedUrl}`);

    const prisma = new PrismaClient();

    try {
        await prisma.$connect();
        console.log('✅ Connected to database');

        // List of ALL columns that need to be added if missing
        // Add any new columns here when schema changes
        const migrations = [
            {
                table: 'Contractor',
                column: 'registrationFeeSlipUrl',
                type: 'TEXT',
            },
            {
                table: 'Contractor',
                column: 'brNumber',
                type: 'TEXT',
            },
            {
                table: 'Contractor',
                column: 'vatNumber',
                type: 'TEXT',
            },
            {
                table: 'Contractor',
                column: 'svat',
                type: 'TEXT',
            },
            {
                table: 'Contractor',
                column: 'documentStatus',
                type: 'TEXT',
                default: "'PENDING'",
            },
            {
                table: 'Contractor',
                column: 'registrationToken',
                type: 'TEXT',
            },
            {
                table: 'Contractor',
                column: 'registrationExpiry',
                type: 'TIMESTAMP',
            },
            {
                table: 'Contractor',
                column: 'siteOfficeStaffId',
                type: 'TEXT',
            },
        ];

        let applied = 0;
        for (const m of migrations) {
            try {
                const sql = m.default
                    ? `ALTER TABLE "${m.table}" ADD COLUMN IF NOT EXISTS "${m.column}" ${m.type} DEFAULT ${m.default}`
                    : `ALTER TABLE "${m.table}" ADD COLUMN IF NOT EXISTS "${m.column}" ${m.type}`;
                
                await prisma.$executeRawUnsafe(sql);
                console.log(`✅ Column "${m.table}.${m.column}" ensured`);
                applied++;
            } catch (err) {
                // Usually means column already exists with different type - safe to ignore
                console.warn(`⚠️ Skipped "${m.table}.${m.column}": ${err.message.split('\n')[0]}`);
            }
        }

        console.log(`✨ Sync complete. ${applied}/${migrations.length} columns verified.`);

    } catch (err) {
        console.error('❌ DB Sync error:', err.message);
        // Non-fatal - app will still start, just with potential schema mismatch
    } finally {
        await prisma.$disconnect();
    }
}

sync();
