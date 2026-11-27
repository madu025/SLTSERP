import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Fixes from the finance gap analysis of production (27 Nov 2026). */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('a contractor wastage keeps the store stock chain: the store quantity does not move', () => {
    const svc = read('src/services/inventory/wastage.service.ts');
    // the two contractor paths (record, approve) no longer write 0 -> 0 into the store chain
    const contractorRows = svc.split("referenceType: 'ContractorWastage'").slice(1).map((s) => s.slice(0, 400));
    assert.equal(contractorRows.length, 2);
    for (const row of contractorRows) {
        assert.match(row, /quantityBefore: storeQty,\s*quantityChange: 0,\s*quantityAfter: storeQty,/);
    }
    assert.doesNotMatch(svc, /quantityBefore: 0,\s*quantityChange: -qty,\s*quantityAfter: 0/);
    assert.match(svc, /private static async storeQuantity\(tx: TransactionClient, storeId: string, itemId: string\)/);
});

test('the monitoring ledger audit checks the same formats as fn_verify_ledger_integrity (it hashed the row id, so every row looked tampered)', () => {
    const mon = read('src/services/admin/system-monitoring.service.ts');
    const audit = mon.slice(mon.indexOf('static async runLedgerSecurityAudit()'), mon.indexOf('static async runLedgerSecurityAudit()') + 4000);
    assert.doesNotMatch(audit, /\$\{record\.id\}:/, 'no writer hashes the row id');
    assert.match(audit, /le\."createdAt"::text \|\| ':' \|\| COALESCE\(le\."previousChecksum", 'GENESIS'\)/, 'database format');
    assert.match(audit, /to_char\(le\."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'\)/, 'application format');
    assert.match(audit, /'HASH_CHAIN_BROKEN'/, 'a broken chain is reported as such');
    const fn = read('prisma/migrations/20261026000001_fix_ledger_legacy_checksum_validation/migration.sql');
    assert.match(fn, /to_char\(le\."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'\)/, 'the same rule as the database function');
});

test('posting rules the analysis confirmed (not gaps): MRN debit notes reduce the vendor payable, contractor invoices move AP-CON to AP-VEND', () => {
    const ledger = read('src/services/finance/ledger.service.ts');
    assert.match(ledger, /accountCode: ACCOUNTS\.AP_VENDOR, debit: payable, credit: 0, description: 'Debit note: invoiced goods returned to the supplier'/);
    assert.match(ledger, /debitAccountCode = ACCOUNTS\.AP_CONTRACTOR;\s*creditAccountCode = ACCOUNTS\.AP_VENDOR;/);
});
