import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRIGGERS = [
    `DROP TRIGGER IF EXISTS trg_pre_erp_auto_calc ON "PreErpMaterialBalance"`,
    `CREATE TRIGGER trg_pre_erp_auto_calc BEFORE INSERT OR UPDATE ON "PreErpMaterialBalance" FOR EACH ROW EXECUTE FUNCTION fn_pre_erp_auto_calc()`,

    `DROP TRIGGER IF EXISTS trg_prevent_negative_stock ON "InventoryStock"`,
    `CREATE TRIGGER trg_prevent_negative_stock BEFORE INSERT OR UPDATE ON "InventoryStock" FOR EACH ROW EXECUTE FUNCTION fn_prevent_negative_stock()`,

    `DROP TRIGGER IF EXISTS trg_auto_ledger_checksum ON "InventoryLedger"`,
    `CREATE TRIGGER trg_auto_ledger_checksum BEFORE INSERT ON "InventoryLedger" FOR EACH ROW EXECUTE FUNCTION fn_auto_ledger_checksum()`,

    `DROP TRIGGER IF EXISTS trg_cycle_count_variance ON "CycleCountLine"`,
    `CREATE TRIGGER trg_cycle_count_variance BEFORE INSERT OR UPDATE ON "CycleCountLine" FOR EACH ROW EXECUTE FUNCTION fn_calc_cycle_variance()`,

    `DROP TRIGGER IF EXISTS trg_low_stock_auto_alert ON "InventoryStock"`,
    `CREATE TRIGGER trg_low_stock_auto_alert AFTER UPDATE ON "InventoryStock" FOR EACH ROW WHEN (NEW.quantity <= NEW."minLevel" AND OLD.quantity > OLD."minLevel") EXECUTE FUNCTION fn_notify_low_stock()`,

    `DROP TRIGGER IF EXISTS trg_wastage_limit_check ON "ContractorWastageItem"`,
    `CREATE TRIGGER trg_wastage_limit_check BEFORE INSERT ON "ContractorWastageItem" FOR EACH ROW EXECUTE FUNCTION fn_validate_wastage_limit()`,

    `DROP TRIGGER IF EXISTS trg_variance_adjustment_calc ON "MaterialVarianceAdjustment"`,
    `CREATE TRIGGER trg_variance_adjustment_calc BEFORE INSERT OR UPDATE ON "MaterialVarianceAdjustment" FOR EACH ROW EXECUTE FUNCTION fn_calc_variance_adjustment()`,
];

async function main() {
    console.log('Applying 7 missing triggers...\n');
    let ok = 0, fail = 0;
    for (const sql of TRIGGERS) {
        try {
            await prisma.$executeRawUnsafe(sql);
            const name = sql.match(/TRIGGER\s+(\w+)/i)?.[1] || sql.substring(0, 50);
            console.log(`  OK - ${name}`);
            ok++;
        } catch (e: any) {
            console.error(`  FAIL - ${e.message.split('\n')[0]}`);
            fail++;
        }
    }
    console.log(`\n  Applied: ${ok}  |  Failed: ${fail}`);

    // Verify
    const triggers = await prisma.$queryRaw`
        SELECT trigger_name, event_object_table FROM information_schema.triggers
        WHERE trigger_schema = 'public' ORDER BY trigger_name`;
    console.log(`\n  Triggers in DB: ${(triggers as any[]).length}`);
    for (const t of triggers as any[]) {
        console.log(`    ${t.trigger_name} -> ${t.event_object_table}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
