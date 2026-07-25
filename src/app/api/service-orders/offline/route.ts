import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { SODInvoicingService } from '@/services/sod/sod.invoicing.service';
import { SODLifecycleService } from '@/services/sod/sod.lifecycle.service';

export const dynamic = 'force-dynamic';

// GET: Fetch Work Orders flagged as Offline Work Orders
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const opmcId = searchParams.get('opmcId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const whereClause: Record<string, unknown> = {
        isOfflineWorkOrder: true
    };

    if (opmcId && opmcId !== 'ALL') {
        whereClause.opmcId = opmcId;
    }

    if (status && status !== 'ALL') {
        whereClause.sltsStatus = status;
    }

    const [total, orders] = await prisma.$transaction([
        prisma.serviceOrder.count({ where: whereClause }),
        prisma.serviceOrder.findMany({
            where: whereClause,
            include: {
                opmc: { select: { id: true, rtom: true, name: true } },
                contractor: { select: { id: true, name: true } },
                team: { select: { id: true, name: true } },
                materialUsage: {
                    select: {
                        id: true,
                        itemId: true,
                        quantity: true,
                        unitPrice: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        })
    ]);

    return {
        success: true,
        count: orders.length,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        items: orders
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
});

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

    // Compute Rates using Rate Matrix & SODRevenueConfig
    const rates = await SODInvoicingService.calculateAmounts(validated.rtom, validated.dropWireDistance, {
        serviceType: validated.serviceType,
        completedDate: compDate
    });

    const order = await prisma.serviceOrder.create({
        data: {
            soNum: validated.soNum,
            rtom: validated.rtom,
            opmcId: validated.opmcId,
            customerName: validated.customerName || 'Offline Contractor Entry',
            voiceNumber: validated.voiceNumber,
            serviceType: validated.serviceType,
            orderType: validated.orderType,
            status: validated.sltsStatus,
            sltsStatus: validated.sltsStatus,
            completedDate: compDate,
            dropWireDistance: validated.dropWireDistance,
            revenueAmount: rates.revenueAmount,
            contractorAmount: rates.contractorAmount,
            contractorId: validated.contractorId || null,
            teamId: validated.teamId || null,
            comments: validated.comments || 'Registered via Offline Work Order Entry Portal',
            isOfflineWorkOrder: true,
            isManualEntry: true,
            offlineReference: validated.offlineReference || `OFFLINE-WO-${Date.now()}`
        }
    });

    return {
        success: true,
        message: 'Offline Work Order registered successfully!',
        data: order
    };
});
