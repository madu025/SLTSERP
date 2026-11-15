import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { SupplierInvoiceService } from '@/services/procurement/supplier-invoice.service';
import { monthRange } from '@/lib/ho-monthly-rules';

export interface GeneratedResult { sourceId: string; label: string; ok: boolean; invoiceId?: string; invoiceNumber?: string; error?: string }

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Site office rent and vehicle rentals are billed by the month. The source records already exist (the site office agreement and the
 * approved monthly vehicle summary), so Finance generates that month's invoice from them instead of typing it. One invoice per
 * source and month (the database refuses a second one); a source with no vendor to pay is reported, not guessed.
 */
export class ServicePayableGeneratorService {
    static async rentCandidates(month: string) {
        const range = monthRange(month);
        if (!range) throw AppError.badRequest('INVALID_MONTH: use YYYY-MM');
        const agreements = await prisma.siteOfficeAgreement.findMany({
            where: { status: 'ACTIVE', monthlyRent: { gt: 0 }, startDate: { lte: range.end }, OR: [{ endDate: null }, { endDate: { gte: range.start } }] },
            include: { siteOffice: { select: { name: true } } }, orderBy: { contractNumber: 'asc' }, take: 500,
        });
        const billed = await prisma.supplierInvoice.findMany({ where: { sourceType: 'SITE_OFFICE_AGREEMENT', periodMonth: month, sourceId: { in: agreements.map((a) => a.id) } }, select: { sourceId: true, invoiceNumber: true } });
        const billedBy = new Map(billed.map((b) => [b.sourceId, b.invoiceNumber]));
        const vendors = await prisma.vendor.findMany({ where: { id: { in: agreements.map((a) => a.vendorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
        const vName = new Map(vendors.map((v) => [v.id, v.name]));
        return agreements.map((a) => ({
            sourceId: a.id, label: `${a.siteOffice.name} · ${a.contractNumber}`, landlord: a.vendorId ? (vName.get(a.vendorId) ?? a.landlordName) : a.landlordName,
            vendorId: a.vendorId, amount: Number(a.monthlyRent), billedInvoice: billedBy.get(a.id) ?? null,
        }));
    }

    static async generateRent(userId: string, month: string, agreementIds: string[]): Promise<GeneratedResult[]> {
        const range = monthRange(month);
        if (!range) throw AppError.badRequest('INVALID_MONTH: use YYYY-MM');
        const agreements = await prisma.siteOfficeAgreement.findMany({ where: { id: { in: agreementIds } }, include: { siteOffice: { select: { name: true } } } });
        const results: GeneratedResult[] = [];
        for (const id of agreementIds) {
            const a = agreements.find((x) => x.id === id);
            if (!a) { results.push({ sourceId: id, label: id, ok: false, error: 'AGREEMENT_NOT_FOUND' }); continue; }
            const label = `${a.siteOffice.name} · ${a.contractNumber}`;
            if (a.status !== 'ACTIVE' || a.startDate > range.end || (a.endDate && a.endDate < range.start)) { results.push({ sourceId: id, label, ok: false, error: 'AGREEMENT_NOT_ACTIVE_IN_THIS_MONTH' }); continue; }
            if (!a.vendorId) { results.push({ sourceId: id, label, ok: false, error: 'LINK_THE_LANDLORD_TO_A_VENDOR_FIRST' }); continue; }
            try {
                const inv = await SupplierInvoiceService.createService({
                    userId, category: 'SITE_OFFICE_RENT', vendorId: a.vendorId, invoiceNumber: `RENT-${a.contractNumber}-${month}`, invoiceDate: dayStr(range.start), periodMonth: month,
                    sourceType: 'SITE_OFFICE_AGREEMENT', sourceId: a.id, lines: [{ description: `Site office rent ${a.siteOffice.name} ${month}`, unitPrice: Number(a.monthlyRent) }],
                });
                results.push({ sourceId: id, label, ok: true, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber });
            } catch (e) { results.push({ sourceId: id, label, ok: false, error: (e as Error).message }); }
        }
        return results;
    }

    static async vehicleCandidates(month: string) {
        const range = monthRange(month);
        if (!range) throw AppError.badRequest('INVALID_MONTH: use YYYY-MM');
        const [y, m] = month.split('-').map(Number);
        const summaries = await prisma.vMRentedVehicleMonthlySummary.findMany({
            where: { year: y, month: m, status: 'APPROVED' },
            include: { rentalVehicle: { select: { supplier_id: true, vehicle: { select: { registration_number: true } } } } }, take: 500,
        });
        const billed = await prisma.supplierInvoice.findMany({ where: { sourceType: 'VM_RENTAL_SUMMARY', periodMonth: month, sourceId: { in: summaries.map((s) => s.id) } }, select: { sourceId: true, invoiceNumber: true } });
        const billedBy = new Map(billed.map((b) => [b.sourceId, b.invoiceNumber]));
        const vendors = await prisma.vendor.findMany({ where: { id: { in: summaries.map((s) => s.rentalVehicle.supplier_id) } }, select: { id: true, name: true } });
        const vName = new Map(vendors.map((v) => [v.id, v.name]));
        return summaries.map((s) => ({
            sourceId: s.id, label: `${s.rentalVehicle.vehicle.registration_number} · ${month}`, landlord: vName.get(s.rentalVehicle.supplier_id) ?? null,
            vendorId: vName.has(s.rentalVehicle.supplier_id) ? s.rentalVehicle.supplier_id : null, amount: Number(s.net_payment), billedInvoice: billedBy.get(s.id) ?? null,
        }));
    }

    static async generateVehicle(userId: string, month: string, summaryIds: string[]): Promise<GeneratedResult[]> {
        const range = monthRange(month);
        if (!range) throw AppError.badRequest('INVALID_MONTH: use YYYY-MM');
        const summaries = await prisma.vMRentedVehicleMonthlySummary.findMany({ where: { id: { in: summaryIds } }, include: { rentalVehicle: { select: { supplier_id: true, vehicle: { select: { registration_number: true } } } } } });
        const results: GeneratedResult[] = [];
        for (const id of summaryIds) {
            const s = summaries.find((x) => x.id === id);
            if (!s) { results.push({ sourceId: id, label: id, ok: false, error: 'SUMMARY_NOT_FOUND' }); continue; }
            const reg = s.rentalVehicle.vehicle.registration_number;
            const label = `${reg} · ${month}`;
            if (s.status !== 'APPROVED') { results.push({ sourceId: id, label, ok: false, error: 'THE_MONTHLY_SUMMARY_MUST_BE_APPROVED_FIRST' }); continue; }
            if (`${s.year}-${String(s.month).padStart(2, '0')}` !== month) { results.push({ sourceId: id, label, ok: false, error: 'SUMMARY_IS_FOR_A_DIFFERENT_MONTH' }); continue; }
            const vendor = await prisma.vendor.findUnique({ where: { id: s.rentalVehicle.supplier_id }, select: { id: true } });
            if (!vendor) { results.push({ sourceId: id, label, ok: false, error: 'THE_VEHICLE_SUPPLIER_IS_NOT_A_VENDOR' }); continue; }
            try {
                const inv = await SupplierInvoiceService.createService({
                    userId, category: 'VEHICLE_RENTAL', vendorId: vendor.id, invoiceNumber: `VEH-${reg}-${month}`, invoiceDate: dayStr(range.start), periodMonth: month,
                    sourceType: 'VM_RENTAL_SUMMARY', sourceId: s.id, lines: [{ description: `Vehicle rental ${reg} ${month}`, unitPrice: Number(s.net_payment) }],
                });
                results.push({ sourceId: id, label, ok: true, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber });
            } catch (e) { results.push({ sourceId: id, label, ok: false, error: (e as Error).message }); }
        }
        return results;
    }
}
