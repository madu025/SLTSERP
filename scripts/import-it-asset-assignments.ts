/* eslint-disable no-console */
/**
 * Import IT laptop assets + user handover history from NDJSON export.
 *
 * Data source: prisma/data/it-asset-assignments.ndjson
 *   {"serialNumber":"...","userOrder":1,"userName":"...","employeeNo":"..."}
 *
 * Semantics:
 *   - userOrder 1  = CURRENT custodian (matches agent telemetry lastSeenEmployeeNumber)
 *   - userOrder 2+ = PAST custodians (higher order = older), recorded as AssetHandoverLog history
 *
 * Behavior (idempotent, keyed on unique serialNumber):
 *   - Staff auto-created by employeeId (designation ENGINEER) + login provisioned
 *     via HelpdeskService.ensureUserAccountForStaff (same as audit-sync flow)
 *   - Brand inferred from serial prefix; model set to a generic family
 *   - Asset numbers generated as SLT-LAP-XXXX continuing existing sequence
 *   - Dirty employeeNo rows (null / non-numeric) are imported and flagged
 *     pendingAssignmentReview for admin correction
 *
 * Run: npx tsx scripts/import-it-asset-assignments.ts
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { HelpdeskService } from '../src/services/helpdesk/helpdesk.service';

interface AssignmentRow {
  serialNumber: string;
  userOrder: number;
  userName: string;
  employeeNo: string | null;
}

const IMPORT_MARKER = '[IMPORT-2026-08]';

function inferBrand(serial: string): { brand: string; model: string } {
  if (/^(PF|T[68]NRCX|3GF|2GH|4ZJ|5TF|6HO|6SB|9TJ|BMB|52G)/i.test(serial)) {
    return { brand: 'Lenovo', model: 'ThinkPad' };
  }
  if (/^(5CD|5CG|CND|SCG|PG)/i.test(serial)) {
    return { brand: 'HP', model: 'HP Laptop' };
  }
  if (/^NXA/i.test(serial)) {
    return { brand: 'Acer', model: 'Acer Laptop' };
  }
  return { brand: 'Unknown', model: 'Laptop' };
}

function isCleanEmployeeNo(empNo: string | null): empNo is string {
  return empNo !== null && empNo.trim().length > 0 && /^\d+$/.test(empNo.trim());
}

async function main() {
  const file = path.join(process.cwd(), 'prisma', 'data', 'it-asset-assignments.ndjson');
  const rows: AssignmentRow[] = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l) as AssignmentRow);

  // Group by serial number
  const bySerial = new Map<string, AssignmentRow[]>();
  for (const row of rows) {
    const serial = row.serialNumber.trim().toUpperCase();
    if (!bySerial.has(serial)) bySerial.set(serial, []);
    bySerial.get(serial)!.push(row);
  }
  for (const list of bySerial.values()) {
    list.sort((a, b) => a.userOrder - b.userOrder);
  }

  // Admin user for handover log performedById (FK cannot be null)
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
  if (!admin) throw new Error('No SUPER_ADMIN user found for performedById');

  // Asset number sequence: continue after the highest existing SLT-LAP-XXXX
  const existingNumbers = await prisma.iTAsset.findMany({
    where: { assetNumber: { startsWith: 'SLT-LAP-' } },
    select: { assetNumber: true }
  });
  let nextAssetNo = existingNumbers.reduce((max, a) => {
    const n = parseInt(a.assetNumber.replace('SLT-LAP-', ''), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 1000);

  const stats = { created: 0, updated: 0, staffCreated: 0, logsCreated: 0, flagged: 0, failed: 0 };
  const failures: string[] = [];

  for (const [serial, assignments] of bySerial) {
    try {
      const current = assignments.find((a) => a.userOrder === 1) ?? assignments[0];
      // Past custodians oldest-first: higher order = older
      const past = assignments
        .filter((a) => a !== current)
        .sort((a, b) => b.userOrder - a.userOrder);

      const dirty = !isCleanEmployeeNo(current.employeeNo);
      const { brand, model } = inferBrand(serial);

      await prisma.$transaction(async (tx) => {
        // Resolve/create staff for every named custodian (current + past)
        const resolveStaff = async (row: AssignmentRow) => {
          if (!row.employeeNo || row.employeeNo.trim().length === 0) return null;
          const empId = row.employeeNo.trim().toUpperCase();
          let staff = await tx.staff.findFirst({ where: { employeeId: empId } });
          if (!staff) {
            staff = await tx.staff.create({
              data: { employeeId: empId, name: row.userName.trim(), designation: 'ENGINEER' }
            });
            stats.staffCreated++;
          }
          await HelpdeskService.ensureUserAccountForStaff(staff.id, tx as never);
          return staff;
        };

        const currentStaff = await resolveStaff(current);
        const currentUser = currentStaff
          ? await tx.user.findFirst({ where: { staffId: currentStaff.id }, select: { id: true } })
          : null;

        // Upsert asset by serial
        const existing = await tx.iTAsset.findUnique({ where: { serialNumber: serial } });
        let assetId: string;

        if (existing) {
          await tx.iTAsset.update({
            where: { id: existing.id },
            data: {
              assignedStaffId: currentStaff?.id ?? existing.assignedStaffId,
              assignedUserId: currentUser?.id ?? existing.assignedUserId,
              lastSeenEmployeeNumber: current.employeeNo?.trim() ?? existing.lastSeenEmployeeNumber,
              pendingAssignmentReview: dirty || existing.pendingAssignmentReview,
              repairRemarks: dirty
                ? `${IMPORT_MARKER} Imported with unresolved employeeNo "${current.employeeNo ?? 'null'}" for ${current.userName}`
                : existing.repairRemarks
            }
          });
          assetId = existing.id;
          stats.updated++;
        } else {
          nextAssetNo += 1;
          const created = await tx.iTAsset.create({
            data: {
              assetNumber: `SLT-LAP-${nextAssetNo}`,
              serialNumber: serial,
              deviceType: 'LAPTOP',
              brand,
              model,
              status: 'ACTIVE',
              assignedStaffId: currentStaff?.id ?? null,
              assignedUserId: currentUser?.id ?? null,
              lastSeenEmployeeNumber: current.employeeNo?.trim() ?? null,
              pendingAssignmentReview: dirty,
              repairRemarks: dirty
                ? `${IMPORT_MARKER} Imported with unresolved employeeNo "${current.employeeNo ?? 'null'}" for ${current.userName}`
                : null
            }
          });
          assetId = created.id;
          stats.created++;
        }
        if (dirty) stats.flagged++;

        // Handover log helper (idempotent via import marker + staff id)
        const logHandover = async (staffId: string | null, date: Date, remarks: string) => {
          const dupe = await tx.assetHandoverLog.findFirst({
            where: {
              assetId,
              targetStaffId: staffId,
              remarks: { contains: IMPORT_MARKER }
            }
          });
          if (dupe) return;
          await tx.assetHandoverLog.create({
            data: {
              assetId,
              transactionType: 'ISSUED_TO_USER',
              performedById: admin.id,
              targetStaffId: staffId,
              condition: 'Good',
              date,
              remarks
            }
          });
          stats.logsCreated++;
        };

        // Past custodians: staggered dates so history renders in chronological order
        const now = new Date();
        for (let i = 0; i < past.length; i++) {
          const p = past[i];
          const staff = await resolveStaff(p);
          const d = new Date(now);
          d.setDate(d.getDate() - 30 * (past.length - i));
          await logHandover(
            staff?.id ?? null,
            d,
            `${IMPORT_MARKER} Previous custodian ${p.userName} (emp ${p.employeeNo ?? 'n/a'}) — imported handover history`
          );
        }

        // Current custodian
        await logHandover(
          currentStaff?.id ?? null,
          now,
          `${IMPORT_MARKER} Current custodian ${current.userName} (emp ${current.employeeNo ?? 'n/a'}) — imported assignment`
        );
      });
    } catch (e) {
      stats.failed++;
      failures.push(`${serial}: ${(e as Error).message?.split('\n')[0]}`);
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Assets created:  ${stats.created}`);
  console.log(`Assets updated:  ${stats.updated}`);
  console.log(`Staff created:   ${stats.staffCreated}`);
  console.log(`Handover logs:   ${stats.logsCreated}`);
  console.log(`Flagged dirty:   ${stats.flagged}`);
  console.log(`Failed:          ${stats.failed}`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  ${f}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
