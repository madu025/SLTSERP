import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';
import { assertProjectAccess } from '@/lib/project-access';
import { parseBoqWorkbook } from '@/lib/slt-boq/excel-import';
import {
    SSCL_PERCENT, VAT_PERCENT, invoiceTierTotals, invoiceUnitRate, round2, taxBreakdown, tierRate,
    type BoqLineInput, type SupplyTier,
} from '@/lib/slt-boq/pricing';
import { buildDocumentPack, resolveDocumentProfile, type PackInput } from '@/lib/slt-boq/document-pack';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { ProjectInvoiceService } from '@/services/project/project-invoice.service';

/** Invoice number prefix by project type (SLTS/<RTOM>/<prefix>/<year>/<serial>) */
const INVOICE_PREFIX: Record<string, string> = {
    CUSTOMER_REQUEST: 'CR',
    REHABILITATION_SHIFTING: 'CR',
    MARKETING: 'MKT',
    CLUSTER_DEVELOPMENT: 'CEN',
    BUILDING_FIBER: 'BLD',
};

const toTier = (v: string | null | undefined): SupplyTier => (v === 'P1' || v === 'P2' ? v : 'P0');
const n = (v: Prisma.Decimal | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

type BoqRow = Prisma.ProjectBOQItemGetPayload<Record<string, never>>;

function rowToLine(row: BoqRow, quantity: number): BoqLineInput {
    const tier = toTier(row.supplyTier);
    const rateP0 = n(row.rateP0) || n(row.unitRate);
    return {
        udNo: row.udNo,
        unitDesignator: row.unitDesignator || row.itemCode,
        description: row.description,
        unit: row.unit,
        quantity,
        supplyTier: tier,
        rateP0,
        rateP1: row.rateP1 === null ? rateP0 : n(row.rateP1),
        rateP2: row.rateP2 === null ? (row.rateP1 === null ? rateP0 : n(row.rateP1)) : n(row.rateP2),
        boqPart: row.boqPart,
    };
}

export class SltBoqService {
    /**
     * Import an SLT BOQ workbook (customer request, cluster or marketing invoice summary) as the project's BOQ.
     * Lines already imported the same way are replaced; manually entered lines are kept. Unit designators that are
     * not yet in the rate catalogue are added to it (existing catalogue rates are never overwritten).
     */
    static async importBoq(projectId: string, data: Buffer | Uint8Array, actorId: string) {
        await assertProjectAccess(projectId, actorId);
        await ProjectBOQService.assertBOQEditable(projectId);

        let parsed;
        try {
            parsed = parseBoqWorkbook(data);
        } catch (e) {
            throw AppError.badRequest(`BOQ_WORKBOOK_UNREADABLE: ${e instanceof Error ? e.message : 'unknown'}`);
        }
        if (!parsed.lines.length) throw AppError.badRequest(`BOQ_WORKBOOK_HAS_NO_LINES: ${parsed.warnings.join('; ')}`);

        const result = await prisma.$transaction(async (tx) => {
            const removed = await tx.projectBOQItem.deleteMany({ where: { projectId, unitDesignator: { not: null } } });
            const created = await tx.projectBOQItem.createMany({
                data: parsed.lines.map((l) => {
                    const rate = tierRate(l, l.supplyTier);
                    return {
                        projectId,
                        itemCode: l.unitDesignator,
                        description: l.description || l.unitDesignator,
                        unit: l.unit || 'Nos',
                        quantity: l.quantity,
                        unitRate: rate,
                        amount: round2(rate * l.quantity),
                        category: l.boqPart ?? null,
                        remarks: 'SLT_IMPORT',
                        udNo: l.udNo ?? null,
                        unitDesignator: l.unitDesignator,
                        supplyTier: l.supplyTier,
                        rateP0: l.rateP0,
                        rateP1: l.rateP1,
                        rateP2: l.rateP2,
                        boqPart: l.boqPart ?? null,
                    };
                }),
            });

            // Rate catalogue: add what is missing, keep what is there
            const known = new Set((await tx.sltRateItem.findMany({
                where: { unitDesignator: { in: parsed.lines.map((l) => l.unitDesignator) } },
                select: { unitDesignator: true },
            })).map((r) => r.unitDesignator));
            const seen = new Set<string>();
            const fresh = parsed.lines.filter((l) => {
                if (known.has(l.unitDesignator) || seen.has(l.unitDesignator)) return false;
                seen.add(l.unitDesignator);
                return true;
            });
            if (fresh.length) {
                await tx.sltRateItem.createMany({
                    data: fresh.map((l) => ({
                        unitDesignator: l.unitDesignator, udNo: l.udNo ?? null, description: l.description || l.unitDesignator,
                        unit: l.unit || 'Nos', rateP0: l.rateP0, rateP1: l.rateP1, rateP2: l.rateP2,
                    })),
                    skipDuplicates: true,
                });
            }

            const project = await tx.project.findUnique({ where: { id: projectId }, select: { sltRef: true } });
            const meta: Prisma.ProjectUpdateInput = {};
            if (!project?.sltRef && parsed.meta.sltRef) meta.sltRef = parsed.meta.sltRef;
            if (Object.keys(meta).length) await tx.project.update({ where: { id: projectId }, data: meta });

            return { removed: removed.count, created: created.count, catalogueAdded: fresh.length };
        });

        return { format: parsed.format, meta: parsed.meta, warnings: parsed.warnings, ...result };
    }

    /** Quantity of each BOQ line already invoiced on live (non-cancelled) invoices */
    private static async invoicedQuantities(projectId: string): Promise<Map<string, number>> {
        const items = await prisma.projectInvoiceItem.findMany({
            where: { boqItemId: { not: null }, invoice: { projectId, type: 'CLIENT', status: { not: 'CANCELLED' } } },
            select: { boqItemId: true, quantity: true },
        });
        const map = new Map<string, number>();
        for (const i of items) map.set(i.boqItemId as string, (map.get(i.boqItemId as string) ?? 0) + Number(i.quantity));
        return map;
    }

    private static async nextReferenceNumber(prefix: string, rtom: string): Promise<string> {
        const year = new Date().getFullYear();
        const base = `SLTS/${rtom || 'NA'}/${prefix}/${year}/`;
        const existing = await prisma.projectInvoice.count({ where: { referenceNumber: { startsWith: base } } });
        return `${base}${String(existing + 1).padStart(2, '0')}`;
    }

    /**
     * Draft client invoice for the work still to be invoiced on the project: measured (actual) quantity, or the BOQ
     * quantity when none was recorded, less what earlier invoices already claimed. FINAL when it clears the BOQ,
     * otherwise PART. The draft goes through the normal invoice approval (Finance / Project Manager).
     * Returns null when there is nothing left to invoice.
     */
    static async createCompletionInvoiceDraft(projectId: string, actorId: string | null) {
        if (actorId) await assertProjectAccess(projectId, actorId);
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { projectType: true, opmc: { select: { rtom: true } }, boqItems: { where: { unitDesignator: { not: null } }, orderBy: [{ boqPart: 'asc' }, { udNo: 'asc' }] } },
        });
        if (!project) throw AppError.notFound('Project not found');
        if (!project.boqItems.length) throw AppError.badRequest('PROJECT_HAS_NO_SLT_BOQ: import the BOQ workbook first');

        const profile = resolveDocumentProfile(project.projectType?.documentProfile);
        const invoiced = await this.invoicedQuantities(projectId);

        const toInvoice: Array<{ row: BoqRow; line: BoqLineInput }> = [];
        let fullyCovered = true;
        for (const row of project.boqItems) {
            const planned = Number(row.quantity);
            const done = Number(row.actualQuantity) > 0 ? Number(row.actualQuantity) : planned;
            const already = invoiced.get(row.id) ?? 0;
            const remaining = round2(done - already);
            if (done < planned) fullyCovered = false;
            if (remaining > 0) toInvoice.push({ row, line: rowToLine(row, remaining) });
            if (already + Math.max(remaining, 0) < planned) fullyCovered = false;
        }
        if (!toInvoice.length) return null;

        const lines = toInvoice.map((t) => t.line);
        const totals = invoiceTierTotals(lines, profile.increment);
        const gross = round2(totals.P0 + totals.P1 + totals.P2);
        if (gross <= 0) return null;
        const tax = taxBreakdown(gross);

        const prefix = INVOICE_PREFIX[project.projectType?.name ?? ''] ?? 'PRJ';
        const referenceNumber = await this.nextReferenceNumber(prefix, project.opmc?.rtom ?? '');
        const kind: 'FINAL' | 'PART' = fullyCovered ? 'FINAL' : 'PART';

        const invoice = await ProjectInvoiceService.createInvoice({
            projectId,
            title: `${kind === 'FINAL' ? 'Final' : 'Part'} invoice - ${project.name}`,
            description: `Generated from the SLT BOQ (${profile.label}). ${kind === 'FINAL' ? 'Clears the BOQ.' : 'Part of the BOQ.'}`,
            type: 'CLIENT',
            referenceNumber,
            currency: 'LKR',
            taxAmount: round2(tax.sscl + tax.vat),
            createdById: actorId,
            items: toInvoice.map(({ row, line }) => ({
                description: `${line.udNo ?? ''} ${line.unitDesignator} - ${line.description}`.trim(),
                quantity: line.quantity,
                unitPrice: invoiceUnitRate(line, profile.increment),
                boqItemId: row.id,
                itemType: line.supplyTier === 'P2' ? 'SERVICE' : 'MATERIAL_AND_SERVICE',
                notes: `Tier ${line.supplyTier}`,
            })),
        });

        // createInvoice only knows one tax figure: record the SLT split and rates on the invoice
        await prisma.projectInvoice.update({
            where: { id: invoice.id },
            data: {
                invoiceKind: kind,
                ssclAmount: round2(tax.sscl), ssclPercent: SSCL_PERCENT,
                vatAmount: round2(tax.vat), vatPercent: VAT_PERCENT,
                whtPercent: 0, whtAmount: 0,
            },
        });
        return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, referenceNumber, kind, gross, net: round2(tax.net), lines: lines.length };
    }

    /**
     * Called when project work is finished. Creates the draft invoice once all tasks are complete and the project
     * has an SLT BOQ. Never throws: the task update that triggered it must not fail because of billing.
     */
    static async maybeGenerateCompletionDraft(projectId: string): Promise<void> {
        try {
            const [open, total, boqLines] = await Promise.all([
                prisma.projectTask.count({ where: { projectId, status: { not: 'COMPLETED' } } }),
                prisma.projectTask.count({ where: { projectId } }),
                prisma.projectBOQItem.count({ where: { projectId, unitDesignator: { not: null } } }),
            ]);
            if (total === 0 || open > 0 || boqLines === 0) return;
            await this.createCompletionInvoiceDraft(projectId, null);
        } catch (e) {
            console.warn('[slt-boq] completion draft skipped:', e instanceof Error ? e.message : e);
        }
    }

    /** Document pack (xlsx) for an invoice that was generated from the BOQ; layout follows the project type */
    static async buildPackForInvoice(invoiceId: string, actorId: string) {
        const invoice = await prisma.projectInvoice.findUnique({
            where: { id: invoiceId },
            include: { items: true, project: { include: { projectType: true, opmc: { select: { rtom: true } } } } },
        });
        if (!invoice) throw AppError.notFound('Invoice not found');
        await assertProjectAccess(invoice.projectId, actorId);

        const boqIds = invoice.items.map((i) => i.boqItemId).filter((id): id is string => Boolean(id));
        if (!boqIds.length) throw AppError.badRequest('INVOICE_HAS_NO_BOQ_LINES');
        const rows = await prisma.projectBOQItem.findMany({ where: { id: { in: boqIds } }, orderBy: [{ boqPart: 'asc' }, { udNo: 'asc' }] });
        const qtyByBoq = new Map(invoice.items.map((i) => [i.boqItemId as string, Number(i.quantity)]));
        const lines = rows.map((r) => rowToLine(r, qtyByBoq.get(r.id) ?? 0)).filter((l) => l.quantity > 0);

        const profile = resolveDocumentProfile(invoice.project.projectType?.documentProfile);
        const p = invoice.project;
        const input: PackInput = {
            profile,
            project: {
                name: p.name, code: p.projectCode, rtom: p.opmc?.rtom ?? null, route: p.location ?? p.routeFrom ?? null,
                poNumber: p.poNumber, poDate: p.poDate, contractRef: p.contractRef, sltRef: p.sltRef,
            },
            lines,
            invoiceNumber: invoice.referenceNumber || invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            invoiceKind: invoice.invoiceKind === 'PART' ? 'PART' : 'FINAL',
            materialBalance: profile.includeMaterialBalance ? await this.materialBalance(p.id, rows, qtyByBoq) : [],
        };
        const buffer = buildDocumentPack(input);
        const safe = (invoice.referenceNumber || invoice.invoiceNumber).replace(/[^A-Za-z0-9._-]+/g, '_');
        return { buffer, fileName: `${safe}.xlsx`, profile: profile.code };
    }

    /** Material balance rows: what the project received from stores against what the invoice claims */
    private static async materialBalance(projectId: string, rows: BoqRow[], qtyByBoq: Map<string, number>) {
        const materialRows = rows.filter((r) => r.materialId);
        const out: Array<{ description: string; received: number; invoiced: number; wasted: number }> = [];
        for (const r of materialRows) {
            const issued = await prisma.stockIssueItem.aggregate({
                where: { itemId: r.materialId as string, issue: { projectId, status: { in: ['APPROVED', 'ISSUED', 'ACCEPTED', 'COMPLETED'] } } },
                _sum: { quantity: true },
            }).catch(() => null);
            out.push({ description: r.description, received: Number(issued?._sum.quantity ?? 0), invoiced: qtyByBoq.get(r.id) ?? 0, wasted: 0 });
        }
        return out;
    }
}
