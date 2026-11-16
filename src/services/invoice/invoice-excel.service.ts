import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { SODInvoicingService } from '@/services/service-order/sod.invoicing.service';
import { buildContractorInvoiceWorkbook, type ExportLine, type ExportSod, type InvoicePart } from '@/lib/contractor-invoice-excel';

export class InvoiceExcelService {
    static async build(invoiceId: string, part: InvoicePart, userId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                contractor: { select: { name: true, address: true, contactNumber: true, registrationNumber: true, bankName: true, bankBranch: true, bankAccountNumber: true, opmcId: true } },
                sods: {
                    orderBy: { completedDate: 'asc' },
                    include: { materialUsage: { include: { item: { select: { name: true } } } }, erectedPoles: { select: { poleType: true, poleNumber: true } } },
                },
            },
        });
        if (!invoice) throw AppError.notFound('Invoice not found');
        const scope = await resolveOpmcScope(userId);
        if (scope !== undefined && (!invoice.contractor.opmcId || !scope.includes(invoice.contractor.opmcId))) throw AppError.forbidden('Invoice is outside your area');
        if (invoice.sods.length === 0) throw AppError.badRequest('This invoice has no service orders to export');

        const rules = await prisma.contractorRateRule.findMany({ where: { isActive: true } });
        const grouped = new Map<string, ExportLine>();
        const add = (description: string, rtom: string, rate: number, qty: number) => {
            const k = `${description}|${rtom}|${rate}`;
            const g = grouped.get(k);
            if (g) g.qty += qty; else grouped.set(k, { description, rtom, qty, rate });
        };
        const missing: string[] = [];
        const sods: ExportSod[] = invoice.sods.map((s) => {
            const area = SODInvoicingService.resolveAreaGroup(s.rtom);
            const st = (s.serviceType || 'FTTH').toUpperCase();
            const workType = st.includes('DATA') ? 'DATA' : st.includes('PSTN') ? 'PSTN' : st.includes('IPTV') ? 'IPTV' : 'FTTH';
            const distance = Number(s.dropWireDistance ?? 0);
            const rule = rules
                .filter((r) => r.workType === workType && r.areaGroup === area && Number(r.minDistance) <= distance && Number(r.maxDistance) >= distance)
                .sort((a, b) => Number(b.minDistance) - Number(a.minDistance))[0];
            if (rule) add(rule.workDescription, s.rtom, Number(rule.rateAmount), 1); else missing.push(s.soNum);
            const poleCounts = new Map<string, number>();
            for (const p of s.erectedPoles) poleCounts.set(p.poleType, (poleCounts.get(p.poleType) ?? 0) + 1);
            for (const [poleType, n] of poleCounts) {
                const pr = rules.find((r) => r.workType === 'POLE' && r.poleType === poleType && r.areaGroup === area && r.poleMethod === 'STANDARD')
                    ?? rules.find((r) => r.workType === 'POLE' && r.poleType === poleType && r.areaGroup === area);
                if (pr) add(pr.workDescription, s.rtom, Number(pr.rateAmount), n); else missing.push(`${s.soNum} pole ${poleType}`);
            }
            const materials: Record<string, number> = {};
            for (const u of s.materialUsage) if (u.item?.name) materials[u.item.name.replace(/\s+/g, ' ').trim()] = (materials[u.item.name.replace(/\s+/g, ' ').trim()] ?? 0) + Number(u.quantity);
            return {
                soNum: s.soNum, tpNumber: s.voiceNumber, completedDate: s.completedDate, rtom: s.rtom, configs: s.orderType,
                sheet: st.includes('PSTN') ? 'PSTN' : st.includes('PEO') ? 'PEO' : 'FTTH',
                materials, remarks: s.erectedPoles.map((p) => `${p.poleType} ${p.poleNumber}`).join(', '),
            } as ExportSod;
        });
        if (missing.length > 0) throw AppError.validation('No active contractor rate for some service orders; fix the rate table first', { missing: missing.slice(0, 10) });

        const lines = [...grouped.values()].sort((a, b) => a.description.localeCompare(b.description) || a.rtom.localeCompare(b.rtom));
        const partAmount = Number(part === 'A' ? invoice.amountA : invoice.amountB);
        const { buffer, warnings } = await buildContractorInvoiceWorkbook({
            invoiceNumber: invoice.invoiceNumber, invoiceDate: invoice.date, periodYear: invoice.year, periodMonth: invoice.month,
            contractor: invoice.contractor, lines, partAmount: partAmount > 0 ? partAmount : null,
        }, part, sods);
        const gross = lines.reduce((a, l) => a + l.qty * l.rate, 0);
        if (Math.abs(gross - Number(invoice.totalAmount)) > 0.5) warnings.push(`Rates today give ${gross.toFixed(2)} but the invoice total is ${Number(invoice.totalAmount).toFixed(2)} (rates changed after the invoice was generated?)`);
        return { buffer, warnings, fileName: `${invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, '_')}-${part}.xlsx`, invoiceNumber: invoice.invoiceNumber };
    }
}
