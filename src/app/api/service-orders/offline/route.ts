import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { SODInvoicingService } from '@/services/service-order/sod.invoicing.service';
import { SODLifecycleService } from '@/services/service-order/sod.lifecycle.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

// GET: Fetch Work Orders flagged as Offline Work Orders
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const opmcId = searchParams.get('opmcId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await SODLifecycleService.getOfflineOrders(page, limit, opmcId, status);

    return {
        success: true,
        count: result.orders.length,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        items: result.orders
    };
});

// PATCH Schema: Toggle Offline Status on any ISHAMP Work Order (CREATE, CREATE-UPGRD, SAME_NO)
const patchSchema = z.object({
    id: z.string().min(1),
    isOfflineWorkOrder: z.boolean(),
    offlineReference: z.string().optional(),
    reason: z.string().optional()
});

// PATCH: Mark / Unmark an existing Work Order as Offline
export const PATCH = apiHandler(async (req) => {
    const body = await req.json();
    const validated = patchSchema.parse(body);

    const updated = await SODLifecycleService.toggleOfflineWorkOrder(
        validated.id,
        validated.isOfflineWorkOrder,
        validated.offlineReference,
        validated.reason
    );

    return {
        success: true,
        message: validated.isOfflineWorkOrder
            ? `Work Order ${updated.soNum} flagged as OFFLINE WORK ORDER successfully!`
            : `Work Order ${updated.soNum} unflagged from Offline mode.`,
        data: updated
    };
}, { roles: ROLE_GROUPS.INVOICE_GENERATORS });

// POST Schema: Register New Offline Work Order manually
const postSchema = z.object({
    soNum: z.string().min(3),
    rtom: z.string().min(2),
    opmcId: z.string().min(1),
    customerName: z.string().optional(),
    voiceNumber: z.string().optional(),
    serviceType: z.string().default('FTTH'),
    orderType: z.string().default('CREATE'),
    sltsStatus: z.enum(['INPROGRESS', 'COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED']).default('COMPLETED'),
    dropWireDistance: z.number().min(0).default(0),
    contractorId: z.string().optional(),
    teamId: z.string().optional(),
    offlineReference: z.string().optional(),
    comments: z.string().optional(),
    completedDate: z.string().optional()
});

// POST: Register New Offline Work Order
export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const validated = postSchema.parse(body);

    const compDate = validated.completedDate ? new Date(validated.completedDate) : new Date();

    const order = await SODLifecycleService.registerOfflineOrder({
        ...validated,
        completedDate: compDate
    });

    return {
        success: true,
        message: 'Offline Work Order registered successfully!',
        data: order
    };
}, { roles: ROLE_GROUPS.INVOICE_GENERATORS });
