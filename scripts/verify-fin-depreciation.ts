import { PrismaClient } from '@prisma/client';
import { FixedAssetService } from '../src/services/finance/fixed-asset.service';

const prisma = new PrismaClient();

async function verifyFixedAssetDepreciation() {
    console.log('--- Starting Finance Verification: Task 5.1 & 5.2 (Fixed Assets & Depreciation) ---');

    // 1. Create a test fixed asset
    const asset = await FixedAssetService.createAsset({
        assetNumber: `FA-TEST-${Date.now()}`,
        name: 'High-Capacity Fiber Splicing Machine',
        category: 'EQUIPMENT',
        cost: 600000,          // LKR 600,000 cost
        usefulLifeYears: 5,   // 5 years -> 60 months -> LKR 10,000 per month
        depreciationMethod: 'STRAIGHT_LINE'
    });

    console.log(`Created Fixed Asset: ${asset.name} (Cost: LKR ${asset.cost}, Useful Life: ${asset.usefulLifeYears} years)`);

    // 2. Execute monthly depreciation for (2026, 1)
    const result1 = await prisma.$transaction(async (tx) => {
        return await FixedAssetService.runMonthlyDepreciation(tx, 2026, 1);
    });

    console.log(`Depreciation Run 1 (2026-01): Total Charge LKR ${result1.batchDepreciationTotal} across ${result1.logsCount} assets`);

    const updatedAsset = await prisma.fixedAsset.findUnique({ where: { id: asset.id } });
    if (!updatedAsset) throw new Error('FAILED: Updated fixed asset not found');

    console.log(`Updated Asset NBV: LKR ${updatedAsset.netBookValue} (Accumulated: LKR ${updatedAsset.accumulatedDepreciation})`);

    if (updatedAsset.accumulatedDepreciation !== 10000 || updatedAsset.netBookValue !== 590000) {
        throw new Error(`FAILED: Expected accumulated 10,000 & NBV 590,000 but got accumulated ${updatedAsset.accumulatedDepreciation} & NBV ${updatedAsset.netBookValue}`);
    }

    // 3. Verify GL double-entry journal
    const entry = await prisma.journalEntry.findFirst({
        where: { referenceId: 'DEP-2026-1' }
    });
    if (!entry) throw new Error('FAILED: GL journal entry for depreciation run not found');

    const lines = await prisma.journalLine.findMany({ where: { entryId: entry.id } });
    console.log(`Posted ${lines.length} depreciation journal lines:`);
    for (const l of lines) {
        console.log(`  ${l.accountCode}: DR ${l.debit} | CR ${l.credit}`);
    }

    const expLine = lines.find(l => l.accountCode === 'EXP-DEP-6010');
    const accumLine = lines.find(l => l.accountCode === 'ACC-DEP-1510');

    if (!expLine || Number(expLine.debit) < 10000) {
        throw new Error('FAILED: DR EXP-DEP-6010 invalid');
    }
    if (!accumLine || Number(accumLine.credit) < 10000) {
        throw new Error('FAILED: CR ACC-DEP-1510 invalid');
    }

    // 4. Verify duplicate run prevention for same period
    const result2 = await prisma.$transaction(async (tx) => {
        return await FixedAssetService.runMonthlyDepreciation(tx, 2026, 1);
    });

    console.log(`Duplicate Depreciation Run 2 (2026-01): Total Charge LKR ${result2.batchDepreciationTotal} (Logs: ${result2.logsCount})`);

    const assetAfterDuplicate = await prisma.fixedAsset.findUnique({ where: { id: asset.id } });
    if (assetAfterDuplicate?.accumulatedDepreciation !== 10000) {
        throw new Error('FAILED: Duplicate run modified accumulated depreciation!');
    }

    console.log('✅ Task 5.1 & 5.2 Verification Passed: Fixed Asset Straight-Line Depreciation math, GL postings, and duplicate run prevention are valid.');
}

verifyFixedAssetDepreciation()
    .catch((err) => {
        console.error('❌ Task 5.1 & 5.2 Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
