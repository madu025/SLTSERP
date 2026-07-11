import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get('month'); // e.g., "2026-07"
        const rtomParam = searchParams.get('rtom');   // e.g., "R-AD"

        // Default to current month if not specified
        const targetMonth = monthParam || new Date().toISOString().substring(0, 7);
        const startOfMonth = new Date(`${targetMonth}-01T00:00:00.000Z`);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59, 999);

        // Build database query filters
        const whereClause: any = {
            receivedDate: {
                lte: endOfMonth
            }
        };

        if (rtomParam && rtomParam !== 'ALL') {
            whereClause.rtom = rtomParam;
        }

        // Retrieve service orders received in or before this month
        const serviceOrders = await prisma.serviceOrder.findMany({
            where: whereClause,
            include: {
                opmc: true,
                contractor: true
            },
            orderBy: {
                receivedDate: 'asc'
            }
        });

        // Filter delayed orders:
        // 1. Not completed/closed in or before this month
        // 2. Or completed but has explicit delay markings/shortages
        const delayedOrders = serviceOrders.filter(order => {
            const isCompleted = order.status === 'INSTALL_CLOSED' || order.sltsStatus === 'COMPLETED';
            
            // If completed, check if it was completed AFTER the selected month
            if (isCompleted && order.completedDate) {
                const completionDate = new Date(order.completedDate);
                if (completionDate > endOfMonth) {
                    return true; // Count as delayed for the selected month since it wasn't done yet
                }
            }

            const hasShortage = order.stbShortage || order.ontShortage;
            const hasDelayReasons = order.delayReasons && typeof order.delayReasons === 'object' &&
                Object.values(order.delayReasons as Record<string, boolean>).some(Boolean);

            if (isCompleted) {
                return hasShortage || hasDelayReasons;
            }

            return true; // Pending/In-progress orders are always delayed for month-end reports
        });

        // Map data to client-friendly format
        const formattedOrders = delayedOrders.map(o => {
            const reasonsObj = (o.delayReasons as Record<string, boolean>) || {};
            const activeReasons: string[] = [];
            
            if (reasonsObj.cxDelay) activeReasons.push('Customer Delay');
            if (reasonsObj.ontShortage || o.ontShortage) activeReasons.push('ONT Shortage');
            if (reasonsObj.stbShortage || o.stbShortage) activeReasons.push('STB Shortage');
            if (reasonsObj.nokia) activeReasons.push('Nokia/Port Issue');
            if (reasonsObj.system) activeReasons.push('SLT System Issue');
            if (reasonsObj.opmc) activeReasons.push('OPMC Pending');
            if (reasonsObj.polePending) activeReasons.push('Pole Placement Pending');
            if (reasonsObj.sameDay) activeReasons.push('Same Day Delay');

            if (activeReasons.length === 0 && o.status !== 'INSTALL_CLOSED') {
                activeReasons.push('Pending Execution');
            }

            return {
                id: o.id,
                soNum: o.soNum,
                voiceNumber: o.voiceNumber || 'N/A',
                rtom: o.rtom,
                opmcName: o.opmc?.name || o.rtom,
                customerName: o.customerName || 'N/A',
                address: o.address || 'N/A',
                status: o.status,
                sltsStatus: o.sltsStatus,
                receivedDate: o.receivedDate ? o.receivedDate.toISOString().split('T')[0] : 'N/A',
                statusDate: o.statusDate ? o.statusDate.toISOString().split('T')[0] : 'N/A',
                stbShortage: o.stbShortage,
                ontShortage: o.ontShortage,
                ontType: o.ontType || null,
                reasons: activeReasons,
                comments: o.comments || 'N/A',
                contractorName: o.contractor?.name || 'N/A'
            };
        });

        // Calculate breakdown stats for dashboard cards
        const stats = {
            total: formattedOrders.length,
            ontShortage: formattedOrders.filter(o => o.ontShortage || o.reasons.includes('ONT Shortage')).length,
            stbShortage: formattedOrders.filter(o => o.stbShortage || o.reasons.includes('STB Shortage')).length,
            cxDelay: formattedOrders.filter(o => o.reasons.includes('Customer Delay')).length,
            other: formattedOrders.filter(o => 
                !o.ontShortage && !o.stbShortage && !o.reasons.includes('Customer Delay')
            ).length
        };

        // Fetch distinct RTOM list for filters
        const rtoms = Array.from(new Set(serviceOrders.map(o => o.rtom).filter(Boolean)));

        return NextResponse.json({
            success: true,
            month: targetMonth,
            stats,
            rtoms,
            orders: formattedOrders
        });

    } catch (error: unknown) {
        console.error('Delay Sheets GET Error:', error);
        const errMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { success: false, message: 'Failed to retrieve delay sheets data', error: errMessage },
            { status: 500 }
        );
    }
}
