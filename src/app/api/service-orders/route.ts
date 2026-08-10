import { ServiceOrderService } from '@/services/service-order/sod.service';
import { serviceOrderCreateSchema, serviceOrderPatchSchema, serviceOrderUpdateSchema } from '@/lib/validations/service-order.schema';
import { apiHandler } from '@/lib/api-handler';
import { AppError, ErrorCode } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { ROLE_GROUPS } from '@/config/roles';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import type { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET service orders with pagination and summary metrics
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    // Normalize "ALL" sentinel to empty string — rtomId is a UUID column and
    // passing the literal "ALL" to Prisma causes a 500 UUID parse error.
    const rawRtomId = searchParams.get('rtomId') || searchParams.get('opmcId') || searchParams.get('rtom') || '';
    const params = {
        rtomId: rawRtomId && rawRtomId !== 'ALL' ? rawRtomId : '',
        filter: searchParams.get('filter') || 'pending',
        search: searchParams.get('search') || undefined,
        statusFilter: searchParams.get('statusFilter') || undefined,
        patFilter: searchParams.get('patFilter') || undefined,
        matFilter: searchParams.get('matFilter') || undefined,
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '50'),
        cursor: searchParams.get('cursor') || undefined,
        month: searchParams.get('month') && searchParams.get('month') !== 'ALL' && !isNaN(parseInt(searchParams.get('month')!)) ? parseInt(searchParams.get('month')!) : undefined,
        year: searchParams.get('year') && searchParams.get('year') !== 'ALL' && !isNaN(parseInt(searchParams.get('year')!)) ? parseInt(searchParams.get('year')!) : undefined,
    };

    // rtomId is optional (allows fetching cross-OPMC completed/invoicable SODs)

    const userId = request.headers.get('x-user-id') || 'SYSTEM';
    const result = await ServiceOrderService.getServiceOrders(userId, params);
    return result;
}, { rawResponse: true });

// POST - Create manual service order
export const POST = apiHandler(
    async (req, _params, body: z.infer<typeof serviceOrderCreateSchema>) => {
        const userId = req.headers.get('x-user-id') || undefined;

        // Resolve OPMC from rtomId
        const opmc = await prisma.oPMC.findUnique({
            where: { id: body.rtomId },
            select: { id: true, rtom: true, name: true }
        });
        if (!opmc) {
            throw AppError.badRequest(`OPMC not found for ID: ${body.rtomId}`);
        }

        // Regional ownership check: non-admin users may only create SODs in
        // their accessible OPMCs (admins unrestricted).
        const scope = await resolveOpmcScope(userId);
        if (scope !== undefined && !scope.includes(opmc.id)) {
            throw AppError.forbidden('Target OPMC is outside your regional access');
        }

        // Generate soNum if not provided (manual entries may omit it)
        const soNum = body.soNum?.trim()
            || `MANUAL-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Check for duplicate soNum
        if (body.soNum?.trim()) {
            const existing = await prisma.serviceOrder.findUnique({ where: { soNum: body.soNum.trim() } });
            if (existing) {
                throw AppError.conflict(`Service Order ${body.soNum.trim()} already exists`);
            }
        }

        // Map form status to ServiceOrderStatus enum
        const mappedStatus = body.status === 'INSTALL_CLOSED' ? 'INSTALL_CLOSED' : 'INPROGRESS';

        const created = await prisma.serviceOrder.create({
            data: {
                soNum,
                opmcId: opmc.id,
                rtom: opmc.rtom,
                voiceNumber: body.voiceNumber?.trim() || null,
                customerName: body.customerName?.trim() || null,
                techContact: body.techContact?.trim() || null,
                orderType: body.orderType?.trim() || null,
                serviceType: body.serviceType?.trim() || null,
                package: body.package?.trim() || null,
                dp: body.dp?.trim() || null,
                sales: body.sales?.trim() || null,
                address: body.address?.trim() || null,
                status: mappedStatus,
                sltsStatus: mappedStatus,
                statusDate: new Date(),
                receivedDate: new Date(),
                isManualEntry: true,
            },
            include: {
                opmc: { select: { name: true, rtom: true } }
            }
        });

        // Write status history entry
        await prisma.serviceOrderStatusHistory.create({
            data: {
                serviceOrderId: created.id,
                status: mappedStatus,
                statusDate: new Date()
            }
        });

        // Audit log
        if (userId) {
            await prisma.auditLog.create({
                data: {
                    action: 'SOD_MANUAL_CREATED',
                    entity: 'ServiceOrder',
                    entityId: created.id,
                    userId,
                    newValue: { soNum, rtom: opmc.rtom, status: mappedStatus }
                }
            }).catch(() => { /* non-critical, don't fail the request */ });
        }

        return { success: true, data: created };
    },
    { schema: serviceOrderCreateSchema, roles: ROLE_GROUPS.INVOICE_GENERATORS, rawResponse: true }
);

// PUT - Update service order
export const PUT = apiHandler(
    async (request, params, body) => {
        const { id, ...updateData } = body;
        if (!id) {
            throw AppError.badRequest('Service Order ID required');
        }
        
        const userId = request.headers.get('x-user-id') || undefined;
        const serviceOrder = await ServiceOrderService.updateServiceOrder(id, updateData, userId);
        return serviceOrder;
    },
    { schema: serviceOrderUpdateSchema, roles: ROLE_GROUPS.INVOICE_GENERATORS, rawResponse: true }
);

// PATCH - Update SLTS Status query or Contractor assignment
export const PATCH = apiHandler(
    async (request, params, body) => {
        const { id, ...updateData } = body;
        if (!id) {
            throw AppError.badRequest('Service Order ID required');
        }

        const userId = request.headers.get('x-user-id') || undefined;
        const serviceOrder = await ServiceOrderService.updateServiceOrder(id, updateData, userId);
        return serviceOrder;
    },
    { schema: serviceOrderPatchSchema, roles: ROLE_GROUPS.INVOICE_GENERATORS, rawResponse: true }
);
