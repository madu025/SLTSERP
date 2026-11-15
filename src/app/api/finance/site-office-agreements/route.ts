import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
    action: z.literal('CREATE'),
    siteOfficeId: databaseUuidSchema,
    contractNumber: z.string().trim().min(1).max(80),
    startDate: z.string().min(8),
    endDate: z.string().nullish(),
    monthlyRent: z.number().finite().positive(),
    landlordName: z.string().trim().min(1).max(120),
    landlordPhone: z.string().trim().max(40).nullish(),
    vendorId: databaseUuidSchema,
});
const linkSchema = z.object({ action: z.literal('LINK_VENDOR'), id: databaseUuidSchema, vendorId: databaseUuidSchema });
const bodySchema = z.discriminatedUnion('action', [createSchema, linkSchema]);

// GET /api/finance/site-office-agreements            - agreements with the landlord's vendor
// GET /api/finance/site-office-agreements?stores=1   - site offices to attach an agreement to
export const GET = apiHandler(async (req) => {
    if (new URL(req.url).searchParams.get('stores')) {
        return prisma.inventoryStore.findMany({ select: { id: true, name: true, type: true }, orderBy: { name: 'asc' }, take: 500 });
    }
    const rows = await prisma.siteOfficeAgreement.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { siteOffice: { select: { name: true } } } });
    const vendors = await prisma.vendor.findMany({ where: { id: { in: rows.map((r) => r.vendorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    const vName = new Map(vendors.map((v) => [v.id, v.name]));
    return rows.map((r) => ({ id: r.id, siteOffice: r.siteOffice.name, contractNumber: r.contractNumber, startDate: r.startDate, endDate: r.endDate, monthlyRent: Number(r.monthlyRent), landlordName: r.landlordName, vendorId: r.vendorId, vendorName: r.vendorId ? (vName.get(r.vendorId) ?? null) : null, status: r.status }));
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/finance/site-office-agreements - register a rent agreement (landlord = a Vendor) or link an existing one to its vendor
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const vendor = await prisma.vendor.findUnique({ where: { id: body.vendorId }, select: { id: true } });
    if (!vendor) throw AppError.badRequest('VENDOR_NOT_FOUND');
    if (body.action === 'LINK_VENDOR') {
        const a = await prisma.siteOfficeAgreement.findUnique({ where: { id: body.id }, select: { id: true } });
        if (!a) throw AppError.notFound('Agreement not found');
        return prisma.siteOfficeAgreement.update({ where: { id: body.id }, data: { vendorId: body.vendorId } });
    }
    const store = await prisma.inventoryStore.findUnique({ where: { id: body.siteOfficeId }, select: { id: true } });
    if (!store) throw AppError.badRequest('SITE_OFFICE_NOT_FOUND');
    if (body.endDate && new Date(body.endDate) < new Date(body.startDate)) throw AppError.badRequest('END_DATE_BEFORE_START_DATE');
    return prisma.siteOfficeAgreement.create({
        data: {
            siteOfficeId: body.siteOfficeId, agreementType: 'RENT', contractNumber: body.contractNumber, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : null,
            terms: 'Monthly rent', monthlyRent: body.monthlyRent, landlordName: body.landlordName, landlordPhone: body.landlordPhone ?? null, vendorId: body.vendorId, status: 'ACTIVE',
        },
    });
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.FINANCE_WRITE], audit: { action: 'SITE_OFFICE_AGREEMENT', entity: 'SITE_OFFICE_AGREEMENT' } });
