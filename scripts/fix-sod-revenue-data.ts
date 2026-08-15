/**
 * fix-sod-revenue-data.ts
 *
 * Removes fake seeded revenue data (scripts/seed-dashboard-finance.ts stamped
 * random LKR 8,000-25,000 amounts) and recomputes CORRECT amounts for every
 * COMPLETED SOD through the production calculator:
 *   - revenueAmount    -> SODRevenueConfig (default 10,500/SOD)
 *   - contractorAmount -> ContractorRateRule matrix / base-rate + wire-fee formula
 *
 * Usage: npx tsx scripts/fix-sod-revenue-data.ts [--apply]
 *   Without --apply it runs in DRY-RUN mode (no writes).
 */
import 'dotenv/config';
import { primaryClient } from '../src/lib/prisma';

const APPLY = process.argv.includes('--apply');
const DEFAULT_REVENUE = 10500;

const lkr = (n: unknown) =>
    n === null || n === undefined ? '0.00' : Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main(): Promise<void> {
    console.log(`SOD Revenue Data Fixer - ${APPLY ? 'APPLY MODE' : 'DRY-RUN MODE'}`);

    // --- Before state ---
    const before = await primaryClient.serviceOrder.aggregate({
        where: { sltsStatus: 'COMPLETED' },
        _count: true,
        _sum: { revenueAmount: true, contractorAmount: true },
    });
    console.log(`\nBEFORE: ${before._count} completed SODs | revenue total ${lkr(before._sum.revenueAmount)} | contractor total ${lkr(before._sum.contractorAmount)}`);

    // --- 1. Ensure default SODRevenueConfig exists (10,500/SOD, all RTOMs) ---
    const existingDefault = await primaryClient.sODRevenueConfig.findFirst({
        where: { rtomId: null, isActive: true },
    });
    if (existingDefault) {
        console.log(`\nDefault config exists: LKR ${lkr(existingDefault.revenuePerSOD)}/SOD`);
    } else {
        console.log(`\nNo default SODRevenueConfig - ${APPLY ? 'creating' : 'would create'} LKR ${lkr(DEFAULT_REVENUE)}/SOD`);
        if (APPLY) {
            await primaryClient.sODRevenueConfig.create({
                data: {
                    rtomId: null,
                    revenuePerSOD: DEFAULT_REVENUE,
                    notes: 'Default revenue per SOD for all RTOMs',
                    isActive: true,
                },
            });
        }
    }

    // --- 2. Recompute all completed SODs (set-based, mirrors SODInvoicingService.calculateAmounts) ---
    const sods = await primaryClient.serviceOrder.findMany({
        where: { sltsStatus: 'COMPLETED' },
        select: {
            id: true,
            soNum: true,
            opmcId: true,
            dropWireDistance: true,
            serviceType: true,
            completedDate: true,
            revenueAmount: true,
            contractorAmount: true,
        },
    });
    console.log(`\nRecomputing ${sods.length} completed SODs (revenue -> ${lkr(DEFAULT_REVENUE)}, contractor -> ContractorRateRule matrix)...`);

    if (APPLY) {
        const revenueUpdated = await primaryClient.$executeRaw`
            UPDATE "ServiceOrder"
            SET "revenueAmount" = ${Number(DEFAULT_REVENUE)}
            WHERE "sltsStatus" = 'COMPLETED'
              AND ("revenueAmount" IS DISTINCT FROM ${Number(DEFAULT_REVENUE)})
        `;
        console.log(`  Revenue stamped to ${lkr(DEFAULT_REVENUE)} on ${revenueUpdated} rows.`);

        // Contractor: production rule order -
        // 1) exact rule (workType=FTTH + areaGroup + distance bracket, highest minDistance first)
        // 2) fallback rule (any areaGroup, same bracket)
        // 3) base rate (OTHER 6650 / CEN+HK 6750) + LKR 35/m beyond 50m, distance capped at 180m
        const contractorUpdated = await primaryClient.$executeRaw`
            UPDATE "ServiceOrder" so
            SET "contractorAmount" = calc.amount
            FROM (
                SELECT base.id,
                       COALESCE(
                           (SELECT r."rateAmount"
                            FROM "ContractorRateRule" r
                            WHERE r."workType" = base.work_type
                              AND r."areaGroup" = base.area_group
                              AND r."minDistance" <= base.distance
                              AND r."maxDistance" >= base.distance
                              AND r."isActive" = true
                            ORDER BY r."minDistance" DESC
                            LIMIT 1),
                           (SELECT r."rateAmount"
                            FROM "ContractorRateRule" r
                            WHERE r."workType" = base.work_type
                              AND r."minDistance" <= base.distance
                              AND r."maxDistance" >= base.distance
                              AND r."isActive" = true
                            LIMIT 1),
                           base.fallback_amount
                       ) AS amount
                FROM (
                    SELECT s.id,
                           LEAST(COALESCE(s."dropWireDistance", 0), 180) AS distance,
                           CASE WHEN upper(TRIM(COALESCE(o.rtom, ''))) IN ('R-MD','R-CEN','MD','CEN','R-HK','HK')
                                     OR upper(TRIM(COALESCE(o.rtom, ''))) LIKE '%-MD'
                                     OR upper(TRIM(COALESCE(o.rtom, ''))) LIKE '%-CEN'
                                     OR upper(TRIM(COALESCE(o.rtom, ''))) LIKE '%-HK'
                                THEN 'CEN' ELSE 'OTHER' END AS area_group,
                           CASE WHEN upper(COALESCE(s."serviceType", 'FTTH')) LIKE '%DATA%' THEN 'DATA'
                                WHEN upper(COALESCE(s."serviceType", 'FTTH')) LIKE '%PSTN%' THEN 'PSTN'
                                WHEN upper(COALESCE(s."serviceType", 'FTTH')) LIKE '%IPTV%' THEN 'IPTV'
                                ELSE 'FTTH' END AS work_type,
                           (CASE WHEN upper(TRIM(COALESCE(o.rtom, ''))) IN ('R-MD','R-CEN','MD','CEN','R-HK','HK')
                                      OR upper(TRIM(COALESCE(o.rtom, ''))) LIKE '%-MD'
                                      OR upper(TRIM(COALESCE(o.rtom, ''))) LIKE '%-CEN'
                                      OR upper(TRIM(COALESCE(o.rtom, ''))) LIKE '%-HK'
                                 THEN 6750 ELSE 6650 END)
                           + GREATEST(0, LEAST(COALESCE(s."dropWireDistance", 0), 180) - 50) * 35 AS fallback_amount
                    FROM "ServiceOrder" s
                    JOIN "OPMC" o ON o.id = s."opmcId"
                    WHERE s."sltsStatus" = 'COMPLETED'
                ) base
            ) calc
            WHERE so.id = calc.id
              AND so."contractorAmount" IS DISTINCT FROM calc.amount
        `;
        console.log(`  Contractor recomputed on ${contractorUpdated} rows.`);
    }

    // --- After state ---
    if (APPLY) {
        const after = await primaryClient.serviceOrder.aggregate({
            where: { sltsStatus: 'COMPLETED' },
            _count: true,
            _sum: { revenueAmount: true, contractorAmount: true },
        });
        console.log(`AFTER:  ${after._count} completed SODs | revenue total ${lkr(after._sum.revenueAmount)} | contractor total ${lkr(after._sum.contractorAmount)}`);
    }
}

main()
    .then(() => primaryClient.$disconnect())
    .catch(async (err) => {
        console.error('Fixer failed:', err);
        await primaryClient.$disconnect();
        process.exit(1);
    });
