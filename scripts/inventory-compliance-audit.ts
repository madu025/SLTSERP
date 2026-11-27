import { config } from 'dotenv'; config({ path: '.env.local' });
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sri Lanka inventory compliance audit (LKAS 2, ISO 9001, ISO 27001) on the SLTSERP data. READ ONLY: every query runs inside one
 * `SET TRANSACTION READ ONLY` transaction, nothing is written. Used by the project skill `sl-inventory-compliance-audit`.
 *
 *   pnpm exec tsx scripts/inventory-compliance-audit.ts [outDir]
 *
 * Prints the report as Markdown and, with outDir, also writes inventory-compliance-<day>.md and .json there.
 * Thresholds are the constants below; change them only with the owner's agreement and say so in the report.
 */
import fs from 'node:fs';
import path from 'node:path';

const SLOW_MOVING_DAYS = 90;          // LKAS 2 NRV review: stock without movement for longer than this
const COUNT_VARIANCE_PCT = 1;         // ISO 9001: a counted line further than this from the system quantity
const VAT_RATE = 0.18;                // Sri Lanka VAT (from 1 Jan 2024)
const SSCL_RATE = 0.025;              // Social Security Contribution Levy
const WORK_START = 7, WORK_END = 19;  // Colombo working window for stock adjustments (Sunday is outside it)
const SAMPLE = 5;

type Status = 'PASS' | 'NCR' | 'OBSERVATION' | 'NOT_TRACKED';
interface Check { std: 'LKAS 2' | 'ISO 9001' | 'ISO 27001'; clause: string; id: string; title: string; status: Status; count: number; value?: number; detail: string; sample?: unknown[]; fix?: string }

async function main() {
    const outDir = process.argv[2];
    const { prisma } = await import('../src/lib/prisma');
    const { getUserEffectivePermissions } = await import('../src/lib/user-permissions');
    const { RBAC_PERMISSIONS } = await import('../src/config/rbac-permissions');
    const checks: Check[] = [];
    const add = (c: Check) => checks.push(c);

    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const q = async (sql: string): Promise<any[]> => {
            try { return await tx.$queryRawUnsafe<any[]>(sql); } catch (e: any) { return [{ __error: String(e.message).slice(0, 200) }]; }
        };
        const one = async (sql: string) => (await q(sql))[0] ?? {};
        const failed = (r: any) => r && r.__error;

        // ---------- LKAS 2: cost and valuation ----------
        const fifo = await one(`SELECT count(*)::int n FROM "InventoryStock" s LEFT JOIN (SELECT "storeId","itemId",sum(quantity) q FROM "InventoryBatchStock" GROUP BY 1,2) b USING ("storeId","itemId") WHERE abs(s.quantity - coalesce(b.q,0)) > 0.0001`);
        const fifoSample = await q(`SELECT st.name store, i.code item, s.quantity::float stock, coalesce(b.q,0)::float batches FROM "InventoryStock" s JOIN "InventoryStore" st ON st.id=s."storeId" JOIN "InventoryItem" i ON i.id=s."itemId" LEFT JOIN (SELECT "storeId","itemId",sum(quantity) q FROM "InventoryBatchStock" GROUP BY 1,2) b USING ("storeId","itemId") WHERE abs(s.quantity - coalesce(b.q,0)) > 0.0001 LIMIT ${SAMPLE}`);
        add({ std: 'LKAS 2', clause: 'LKAS 2.25 (FIFO cost formula)', id: 'L1', title: 'Store stock equals its FIFO batches', status: failed(fifo) ? 'NOT_TRACKED' : fifo.n ? 'NCR' : 'PASS', count: fifo.n ?? 0, detail: failed(fifo) ? fifo.__error : `${fifo.n} store/item balances differ from the sum of their FIFO batches`, sample: fifoSample, fix: 'Find the movement that changed the stock without its batch (or the reverse) and correct it through a counted adjustment.' });

        const zeroCost = await one(`SELECT count(*)::int n, coalesce(sum(bs.quantity),0)::float qty FROM "InventoryBatchStock" bs JOIN "InventoryBatch" b ON b.id=bs."batchId" WHERE bs.quantity > 0 AND coalesce(b."costPrice",0) = 0`);
        add({ std: 'LKAS 2', clause: 'LKAS 2.10 (cost of inventories)', id: 'L2', title: 'Every batch in stock carries a cost', status: failed(zeroCost) ? 'NOT_TRACKED' : zeroCost.n ? 'OBSERVATION' : 'PASS', count: zeroCost.n ?? 0, detail: `${zeroCost.n ?? 0} batches in stock (${zeroCost.qty ?? 0} units) have no cost price; their value is understated (opening stock or free issue from SLT may be legitimate).`, fix: 'Confirm the source of each; give the batch its cost when it was bought.' });

        const slow = await q(`WITH last AS (SELECT "storeId","itemId",max("createdAt") at FROM "InventoryLedger" GROUP BY 1,2)
            SELECT st.name store, i.code item, i.name, s.quantity::float qty, (s.quantity*coalesce(i."costPrice",0))::float value, coalesce(l.at, s."updatedAt")::date last_move
            FROM "InventoryStock" s JOIN "InventoryItem" i ON i.id=s."itemId" JOIN "InventoryStore" st ON st.id=s."storeId" LEFT JOIN last l USING ("storeId","itemId")
            WHERE s.quantity > 0 AND coalesce(l.at, s."updatedAt") < now() - interval '${SLOW_MOVING_DAYS} days' ORDER BY value DESC`);
        if (failed(slow[0])) add({ std: 'LKAS 2', clause: 'LKAS 2.28-33 (net realisable value)', id: 'L3', title: `No movement for ${SLOW_MOVING_DAYS}+ days`, status: 'NOT_TRACKED', count: 0, detail: slow[0].__error });
        else add({ std: 'LKAS 2', clause: 'LKAS 2.28-33 (net realisable value)', id: 'L3', title: `No movement for ${SLOW_MOVING_DAYS}+ days (NRV review)`, status: slow.length ? 'OBSERVATION' : 'PASS', count: slow.length, value: slow.reduce((s, r) => s + (r.value ?? 0), 0), detail: `${slow.length} store/item balances have not moved for ${SLOW_MOVING_DAYS} days; their NRV needs review (not an automatic write-down).`, sample: slow.slice(0, SAMPLE), fix: 'Finance reviews NRV for each; a write-down is a finance decision with its reason.' });

        const damaged = await one(`SELECT count(*)::int n, coalesce(sum("quantityChange"),0)::float qty FROM "InventoryLedger" WHERE "transactionType" = 'DAMAGED_RETURN_RECEIVED' AND "createdAt" > now() - interval '365 days'`);
        add({ std: 'LKAS 2', clause: 'LKAS 2.28 (damaged goods)', id: 'L4', title: 'Damaged returns received (last 12 months)', status: failed(damaged) ? 'NOT_TRACKED' : damaged.n ? 'OBSERVATION' : 'PASS', count: damaged.n ?? 0, detail: `${damaged.n ?? 0} damaged returns (${damaged.qty ?? 0} units) were received; confirm they are valued at NRV or written off.` });

        const taxGap = await q(`SELECT g."grnNumber", si."invoiceNumber", g."vendorInvoiceTax"::float grn_tax, si."taxAmount"::float invoice_tax FROM "GRN" g JOIN "SupplierInvoice" si ON si."grnId" = g.id WHERE g."vendorInvoiceTax" IS NOT NULL AND abs(g."vendorInvoiceTax" - si."taxAmount") > 0.01`);
        const taxHigh = await q(`SELECT "invoiceNumber", ("totalAmount"-"taxAmount")::float goods, "taxAmount"::float tax, round(("taxAmount"/nullif("totalAmount"-"taxAmount",0))::numeric*100,2)::float pct FROM "SupplierInvoice" WHERE "taxAmount" > 0 AND "taxAmount"/nullif("totalAmount"-"taxAmount",0) > ${VAT_RATE + SSCL_RATE + 0.005}`);
        const taxRows = failed(taxGap[0]) || failed(taxHigh[0]) ? [] : [...taxGap, ...taxHigh];
        add({ std: 'LKAS 2', clause: 'LKAS 2.11 (purchase cost net of recoverable taxes)', id: 'L5', title: `Invoice tax recorded once and within VAT ${VAT_RATE * 100}% + SSCL ${SSCL_RATE * 100}%`, status: failed(taxGap[0]) || failed(taxHigh[0]) ? 'NOT_TRACKED' : taxRows.length ? 'NCR' : 'PASS', count: taxRows.length, detail: `${failed(taxGap[0]) ? '?' : taxGap.length} GRN/invoice pairs record a different tax; ${failed(taxHigh[0]) ? '?' : taxHigh.length} invoices carry tax above the VAT + SSCL rate.`, sample: taxRows.slice(0, SAMPLE), fix: 'Correct the invoice tax with the vendor invoice; recoverable VAT is not part of the inventory cost.' });
        add({ std: 'LKAS 2', clause: 'LKAS 2.11 (import duties in landed cost)', id: 'L6', title: 'Import duties in landed cost', status: 'NOT_TRACKED', count: 0, detail: 'Nexus records local purchases only; no import duty or landed-cost fields exist. Not applicable unless imports are bought through Nexus.' });

        // ---------- ISO 9001: traceability, counts, suppliers ----------
        const noBatch = await one(`SELECT count(*)::int n FROM "GRNItem" gi WHERE gi."batchId" IS NULL AND gi.quantity > 0`);
        const noLot = await one(`SELECT count(*)::int n FROM "InventoryBatch" b WHERE b."batchNumber" IS NULL OR b."batchNumber" = ''`);
        add({ std: 'ISO 9001', clause: 'ISO 9001:2015 8.5.2 (identification and traceability)', id: 'Q1', title: 'Every GRN line has a batch with a number', status: failed(noBatch) || failed(noLot) ? 'NOT_TRACKED' : (noBatch.n || noLot.n) ? 'NCR' : 'PASS', count: (noBatch.n ?? 0) + (noLot.n ?? 0), detail: `${noBatch.n ?? '?'} GRN lines received without a batch; ${noLot.n ?? '?'} batches without a batch number.`, fix: 'Receipts must create a numbered batch (FIFO and recalls depend on it).' });
        const issueNotes = await one(`SELECT (SELECT count(*) FROM "StockIssue" WHERE "issueNumber" IS NULL OR "issueNumber" = '')::int + (SELECT count(*) FROM "ContractorMaterialIssue" WHERE "issueNumber" IS NULL OR "issueNumber" = '')::int n`);
        add({ std: 'ISO 9001', clause: 'ISO 9001:2015 8.5.2 / 7.5 (issue notes)', id: 'Q2', title: 'Every issue carries its Issue Note number (MIN)', status: failed(issueNotes) ? 'NOT_TRACKED' : issueNotes.n ? 'NCR' : 'PASS', count: issueNotes.n ?? 0, detail: `${issueNotes.n ?? '?'} issues without an Issue Note number (the schema requires a unique one).` });
        const expiry = await one(`SELECT count(*) FILTER (WHERE b."expiryDate" IS NOT NULL AND b."expiryDate" < now() AND bs.quantity > 0)::int expired_in_stock FROM "InventoryBatch" b JOIN "InventoryBatchStock" bs ON bs."batchId" = b.id`);
        add({ std: 'ISO 9001', clause: 'ISO 9001:2015 8.5.4 (preservation)', id: 'Q3', title: 'No expired batch still in stock', status: failed(expiry) ? 'NOT_TRACKED' : expiry.expired_in_stock ? 'NCR' : 'PASS', count: expiry.expired_in_stock ?? 0, detail: `${expiry.expired_in_stock ?? '?'} batches past their expiry date still hold stock. Expiry is optional (most OSP material does not expire), so batches without a date are not counted.` });

        const variance = await q(`SELECT h.id, st.name store, i.code item, l."systemQty"::float system, l."countedQty"::float counted, round((abs(l."countedQty"-l."systemQty")/nullif(l."systemQty",0)*100)::numeric,2)::float pct, l."varianceValue"::float value, h.status
            FROM "CycleCountLine" l JOIN "CycleCountHeader" h ON h.id=l."headerId" JOIN "InventoryItem" i ON i.id=l."itemId" JOIN "InventoryStore" st ON st.id=h."storeId"
            WHERE h.status NOT IN ('DRAFT','CANCELLED') AND (CASE WHEN l."systemQty" = 0 THEN l."countedQty" <> 0 ELSE abs(l."countedQty"-l."systemQty")/l."systemQty"*100 > ${COUNT_VARIANCE_PCT} END) ORDER BY abs(l."varianceValue") DESC`);
        const counted = await one(`SELECT count(*)::int n FROM "CycleCountLine" l JOIN "CycleCountHeader" h ON h.id=l."headerId" WHERE h.status NOT IN ('DRAFT','CANCELLED')`);
        if (failed(variance[0])) add({ std: 'ISO 9001', clause: 'ISO 9001:2015 9.1 (monitoring)', id: 'Q4', title: `Count variance within ${COUNT_VARIANCE_PCT}%`, status: 'NOT_TRACKED', count: 0, detail: variance[0].__error });
        else add({ std: 'ISO 9001', clause: 'ISO 9001:2015 9.1 / 10.2 (monitoring, nonconformity)', id: 'Q4', title: `Count variance within ${COUNT_VARIANCE_PCT}%`, status: counted.n ? (variance.length ? 'NCR' : 'PASS') : 'NOT_TRACKED', count: variance.length, value: variance.reduce((s, r) => s + Math.abs(r.value ?? 0), 0), detail: counted.n ? `${variance.length} of ${counted.n} counted lines are more than ${COUNT_VARIANCE_PCT}% from the system quantity.` : 'No submitted cycle count yet: the physical-vs-system check has no evidence.', sample: variance.slice(0, SAMPLE), fix: 'Investigate each line (root cause) before its correction is approved.' });

        const badVendor = await q(`SELECT po."poNumber", po.status, v.name vendor, v.status vendor_status FROM "PurchaseOrder" po JOIN "Vendor" v ON v.id = po."vendorId" WHERE v.status <> 'ACTIVE' AND po.status NOT IN ('CANCELLED','CLOSED','COMPLETED','REJECTED')`);
        const noVendor = await one(`SELECT count(*)::int n FROM "PurchaseOrder" WHERE "vendorId" IS NULL AND status NOT IN ('CANCELLED','CLOSED','COMPLETED','REJECTED')`);
        add({ std: 'ISO 9001', clause: 'ISO 9001:2015 8.4 (externally provided products)', id: 'Q5', title: 'Open POs only with active (approved) vendors', status: failed(badVendor[0]) || failed(noVendor) ? 'NOT_TRACKED' : (badVendor.length || noVendor.n) ? 'NCR' : 'PASS', count: (failed(badVendor[0]) ? 0 : badVendor.length) + (noVendor.n ?? 0), detail: `${failed(badVendor[0]) ? '?' : badVendor.length} open POs with an inactive vendor; ${noVendor.n ?? '?'} open POs without a vendor.`, sample: failed(badVendor[0]) ? [] : badVendor.slice(0, SAMPLE) });

        // ---------- ISO 27001: adjustments, segregation, integrity ----------
        const offHours = await q(`SELECT l."transactionType" type, l."createdAt" at_utc, st.name store, i.code item, l."quantityChange"::float change
            FROM "InventoryLedger" l JOIN "InventoryStore" st ON st.id=l."storeId" JOIN "InventoryItem" i ON i.id=l."itemId"
            WHERE l."transactionType" IN ('WASTAGE_ADJUSTMENT','CYCLE_COUNT_CORRECTION','VIRTUAL_SWAP')
              AND (extract(dow FROM l."createdAt" AT TIME ZONE 'Asia/Colombo') = 0 OR extract(hour FROM l."createdAt" AT TIME ZONE 'Asia/Colombo') < ${WORK_START} OR extract(hour FROM l."createdAt" AT TIME ZONE 'Asia/Colombo') >= ${WORK_END})
            ORDER BY l."createdAt" DESC`);
        add({ std: 'ISO 27001', clause: 'ISO/IEC 27001:2022 A.8.15-8.16 (logging, monitoring)', id: 'S1', title: `Stock adjustments inside working hours (${WORK_START}:00-${WORK_END}:00, not Sunday)`, status: failed(offHours[0]) ? 'NOT_TRACKED' : offHours.length ? 'OBSERVATION' : 'PASS', count: failed(offHours[0]) ? 0 : offHours.length, detail: failed(offHours[0]) ? offHours[0].__error : `${offHours.length} adjustments were posted outside the working window; confirm each was authorised.`, sample: failed(offHours[0]) ? [] : offHours.slice(0, SAMPLE) });

        const selfApproved = await one(`SELECT (SELECT count(*) FROM "CycleCountHeader" WHERE "approvedById" IS NOT NULL AND "approvedById" = "countedById")::int counts,
            (SELECT count(*) FROM "MaterialVarianceAdjustment" WHERE "approvedById" IS NOT NULL AND "approvedById" = "createdById")::int variances,
            (SELECT count(*) FROM "InventoryLedger" l WHERE l."transactionType" = 'CYCLE_COUNT_CORRECTION' AND NOT EXISTS (SELECT 1 FROM "CycleCountHeader" h WHERE h.id::text = l."referenceId" AND h."approvedById" IS NOT NULL))::int unapproved_corrections`);
        const selfN = failed(selfApproved) ? 0 : (selfApproved.counts + selfApproved.variances + selfApproved.unapproved_corrections);
        add({ std: 'ISO 27001', clause: 'ISO/IEC 27001:2022 A.5.3 (segregation of duties)', id: 'S2', title: 'Every adjustment approved by a second person', status: failed(selfApproved) ? 'NOT_TRACKED' : selfN ? 'NCR' : 'PASS', count: selfN, detail: failed(selfApproved) ? selfApproved.__error : `${selfApproved.counts} counts approved by their counter; ${selfApproved.variances} variance adjustments approved by their maker; ${selfApproved.unapproved_corrections} count corrections in the ledger without an approved count.` });

        const sodGrn = await q(`SELECT g."grnNumber", po."poNumber" FROM "GRN" g JOIN "PurchaseOrder" po ON po.id = g."purchaseOrderId" WHERE po."createdById" IS NOT NULL AND po."createdById" = g."receivedById"`);
        add({ std: 'ISO 27001', clause: 'ISO/IEC 27001:2022 A.5.3 (segregation of duties)', id: 'S3', title: 'No GRN received by the person who recorded its PO', status: failed(sodGrn[0]) ? 'NOT_TRACKED' : sodGrn.length ? 'NCR' : 'PASS', count: failed(sodGrn[0]) ? 0 : sodGrn.length, detail: failed(sodGrn[0]) ? sodGrn[0].__error : `${sodGrn.length} GRNs were received by the PO's recorder (the server refuses this since 27 Nov 2026; older ones are history).`, sample: failed(sodGrn[0]) ? [] : sodGrn.slice(0, SAMPLE) });

        // fn_verify_ledger_integrity() returns one summary row: total_checked, tampered_count, legacy_count, is_integral
        const led = await one(`SELECT * FROM fn_verify_ledger_integrity()`);
        add({ std: 'ISO 27001', clause: 'ISO/IEC 27001:2022 A.8.15 (protection of logs)', id: 'S5', title: 'Stock ledger SHA-256 chain unbroken', status: failed(led) || led.is_integral === undefined ? 'NOT_TRACKED' : led.is_integral && !Number(led.tampered_count) ? 'PASS' : 'NCR', count: Number(led.tampered_count ?? 0), detail: failed(led) ? led.__error : `${led.total_checked} ledger rows checked: ${led.tampered_count} fail the checksum chain, ${led.legacy_count} are older rows without a chain.`, fix: 'A broken checksum means a ledger row was changed outside the application: treat it as a security incident.' });
    }, { timeout: 180_000 });

    // S4 outside the transaction: effective capabilities (role, designations, overrides) of every active user, read through the app's own resolver
    const users: any[] | null = await prisma.user.findMany({ where: { status: { equals: 'active', mode: 'insensitive' } }, select: { id: true, username: true, role: true } }).catch(() => null);
    const both: { username: string; role: string }[] = [];
    for (const u of users ?? []) {
        const p = await getUserEffectivePermissions(u.id);
        if (p.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) continue; // administrators are reported by the access review, not here
        if (p.includes(RBAC_PERMISSIONS.PROCUREMENT_WRITE) && p.includes(RBAC_PERMISSIONS.INVENTORY_GRN)) both.push({ username: u.username, role: String(u.role) });
    }
    checks.splice(checks.findIndex((c) => c.id === 'S5'), 0, { std: 'ISO 27001', clause: 'ISO/IEC 27001:2022 A.5.3 / A.5.15 (segregation, access control)', id: 'S4', title: 'No user may both record POs and receive GRNs', status: !users?.length ? 'NOT_TRACKED' : both.length ? 'OBSERVATION' : 'PASS', count: both.length, detail: !users?.length ? 'The active users could not be read.' : `${both.length} of ${users.length} active non-admin users hold procurement.write and inventory.grn. Mitigated per transaction (S3: the PO's recorder cannot receive it), so this is an access-review observation, not an NCR.`, sample: both.slice(0, SAMPLE), fix: 'Review each grant on Administration > Permissions; remove one of the two where the person does not need it.' });

    // ---------- report ----------
    const stds = ['LKAS 2', 'ISO 9001', 'ISO 27001'] as const;
    const score = (list: Check[]) => { const a = list.filter((c) => c.status !== 'NOT_TRACKED'); return a.length ? Math.round(a.filter((c) => c.status !== 'NCR').length / a.length * 100) : null; };
    const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(`# Inventory compliance audit, ${day}`, '', '## 1. Executive summary', '', '| Standard | Score | Checks | NCR | Observations | Not tracked |', '|---|---|---|---|---|---|');
    for (const s of stds) { const l = checks.filter((c) => c.std === s); lines.push(`| ${s} | ${score(l) ?? '-'}% | ${l.length} | ${l.filter((c) => c.status === 'NCR').length} | ${l.filter((c) => c.status === 'OBSERVATION').length} | ${l.filter((c) => c.status === 'NOT_TRACKED').length} |`); }
    lines.push(`| **Overall** | **${score(checks) ?? '-'}%** | ${checks.length} | ${checks.filter((c) => c.status === 'NCR').length} | ${checks.filter((c) => c.status === 'OBSERVATION').length} | ${checks.filter((c) => c.status === 'NOT_TRACKED').length} |`, '', 'Score = checks without a nonconformity / checks with evidence (observations count as passed; not-tracked checks are left out).', '');
    lines.push('## 2. Non-conformity report (NCR)', '', '| # | Standard / clause | Check | Found | Corrective action |', '|---|---|---|---|---|');
    const ncr = checks.filter((c) => c.status === 'NCR');
    if (!ncr.length) lines.push('| - | - | No nonconformity found | - | - |');
    ncr.forEach((c, i) => lines.push(`| NCR-${String(i + 1).padStart(2, '0')} | ${c.std}, ${c.clause} | ${c.id} ${c.title} | ${c.detail} | ${c.fix ?? 'Investigate and correct.'} |`));
    lines.push('', '## 3. Observations', '');
    checks.filter((c) => c.status === 'OBSERVATION').forEach((c) => lines.push(`- **${c.id} ${c.title}** (${c.std}, ${c.clause}): ${c.detail}${c.value ? ` Value Rs. ${c.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}.` : ''}${c.fix ? ` Action: ${c.fix}` : ''}`));
    lines.push('', '## 4. All checks', '', '| Id | Standard | Check | Result | Count |', '|---|---|---|---|---|');
    checks.forEach((c) => lines.push(`| ${c.id} | ${c.std} | ${c.title} | ${c.status} | ${c.count} |`));
    lines.push('', '## 5. Not tracked (no evidence in the system)', '');
    checks.filter((c) => c.status === 'NOT_TRACKED').forEach((c) => lines.push(`- **${c.id} ${c.title}**: ${c.detail}`));
    lines.push('', `Thresholds: no movement ${SLOW_MOVING_DAYS} days; count variance ${COUNT_VARIANCE_PCT}%; VAT ${VAT_RATE * 100}% + SSCL ${SSCL_RATE * 100}%; working window ${WORK_START}:00-${WORK_END}:00 Colombo, Sunday outside. Read only: nothing was changed.`);
    const md = lines.join('\n');
    console.log(md);
    if (outDir) {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, `inventory-compliance-${day}.md`), md);
        fs.writeFileSync(path.join(outDir, `inventory-compliance-${day}.json`), JSON.stringify({ day, checks }, null, 1));
    }
    process.exit(0);
}
main().catch((e) => { console.error(String(e?.stack ?? e).slice(0, 600)); process.exit(1); });
