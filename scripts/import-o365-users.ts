/**
 * One-off import: OSP O365 License.xlsx ("365" sheet) -> SLTS ERP users.
 *
 * Decisions (user-approved 2026-08-03):
 *  - Default role: ENGINEER
 *  - Skip rows flagged: Delete / Delete After 2026-07-31 / User Replace
 *  - Password pattern: {EMP_NUMBER}@slts (email prefix fallback), mustChangePassword=true
 *  - Username: email local part
 *
 * Usage:
 *   npx tsx scripts/import-o365-users.ts --dry-run
 *   npx tsx scripts/import-o365-users.ts
 */
import * as XLSX from 'xlsx';
import { prisma } from '../src/lib/prisma';
import { UserService } from '../src/services/hr/user.service';

const EXCEL_PATH = 'OSP O365 License .xlsx';
const SHEET_NAME = '365';
const DEFAULT_ROLE = 'ENGINEER';
const SKIP_STATUSES = new Set([
    'Delete',
    'Delete After 2026-07-31',
    'User Replace'
]);

interface Row {
    'Display name'?: string;
    'User principal name'?: string;
    'First name'?: string;
    'Last name'?: string;
    'Department'?: string;
    'EMP NUBER'?: number | string;
    'Status'?: string;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    console.log(`[IMPORT-O365] Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);

    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets[SHEET_NAME];
    if (!sheet) {
        throw new Error(`Sheet "${SHEET_NAME}" not found in ${EXCEL_PATH}`);
    }
    const rows = XLSX.utils.sheet_to_json<Row>(sheet);
    console.log(`[IMPORT-O365] Excel rows: ${rows.length}`);

    // Existing users (idempotency) - match by username or email
    const existingUsers = await prisma.user.findMany({
        select: { username: true, email: true }
    });
    const existingUsernames = new Set(existingUsers.map(u => u.username.toLowerCase()));
    const existingEmails = new Set(
        existingUsers.filter(u => u.email).map(u => (u.email as string).toLowerCase())
    );

    const seenUsernames = new Set<string>();
    const summary = {
        imported: 0,
        skippedNoEmail: 0,
        skippedStatus: 0,
        skippedExisting: 0,
        skippedDuplicateInFile: 0,
        failed: 0
    };
    const failures: Array<{ name: string; reason: string }> = [];

    for (const row of rows) {
        const email = (row['User principal name'] || '').toString().trim().toLowerCase();
        const displayName = (row['Display name'] || '').toString().trim();
        const status = (row['Status'] || '').toString().trim();

        if (!email) {
            summary.skippedNoEmail++;
            console.log(`[SKIP] No email: ${displayName || '(unnamed)'}`);
            continue;
        }

        if (SKIP_STATUSES.has(status)) {
            summary.skippedStatus++;
            console.log(`[SKIP] Status "${status}": ${displayName}`);
            continue;
        }

        const username = email.split('@')[0];
        if (existingUsernames.has(username) || existingEmails.has(email)) {
            summary.skippedExisting++;
            console.log(`[SKIP] Already exists: ${username}`);
            continue;
        }
        if (seenUsernames.has(username)) {
            summary.skippedDuplicateInFile++;
            console.log(`[SKIP] Duplicate username in file: ${username}`);
            continue;
        }
        seenUsernames.add(username);

        const empNumber = row['EMP NUBER'] !== undefined && row['EMP NUBER'] !== null && row['EMP NUBER'] !== ''
            ? String(row['EMP NUBER']).trim()
            : undefined;
        const password = `${empNumber || username}@slts`;

        if (dryRun) {
            console.log(`[DRY-RUN] Would create: ${username} | ${displayName} | emp=${empNumber ?? '-'} | role=${DEFAULT_ROLE}`);
            summary.imported++;
            continue;
        }

        try {
            const created = await UserService.createUser(
                {
                    username,
                    email,
                    password,
                    name: displayName || username,
                    role: DEFAULT_ROLE as never,
                    employeeId: empNumber,
                    status: 'active'
                },
                'system'
            );

            // Force password change on first login
            await prisma.user.update({
                where: { id: created.id as string },
                data: { mustChangePassword: true }
            });

            summary.imported++;
            console.log(`[OK] ${username} (${displayName})`);
        } catch (err) {
            summary.failed++;
            failures.push({
                name: username,
                reason: err instanceof Error ? err.message : String(err)
            });
            console.error(`[FAIL] ${username}: ${err instanceof Error ? err.message : err}`);
        }
    }

    console.log('\n========== IMPORT SUMMARY ==========');
    console.log(JSON.stringify(summary, null, 2));
    if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(f => console.log(`  - ${f.name}: ${f.reason}`));
    }
    console.log('=====================================');
}

main()
    .catch((err) => {
        console.error('[IMPORT-O365] Fatal error:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
