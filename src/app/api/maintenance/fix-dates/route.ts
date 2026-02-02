
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const execute = searchParams.get('execute') === 'true';

        // 1. Target Time: Start of 29th in LK Time = 28th 18:30 UTC
        const targetTime = new Date('2026-01-28T18:30:00.000Z');

        // 2. Find suspect orders (Completed and date is "in the future" relative to 28th end)
        const suspectOrders = await prisma.serviceOrder.findMany({
            where: {
                status: 'COMPLETED',
                completedDate: {
                    gte: targetTime
                }
            },
            select: {
                id: true,
                soNum: true,
                completedDate: true,
                updatedAt: true
            }
        });

        if (!execute) {
            return NextResponse.json({
                message: "Dry Run: Found suspect orders. Add '?execute=true' to apply fix.",
                count: suspectOrders.length,
                samples: suspectOrders.slice(0, 5).map(o => ({
                    soNum: o.soNum,
                    currentDate: o.completedDate,
                    proposedFix: o.completedDate ? new Date(o.completedDate.getTime() - 330 * 60000) : null
                }))
            });
        }

        let fixedCount = 0;
        for (const order of suspectOrders) {
            if (order.completedDate) {
                // Subtract 5.5 hours (330 minutes)
                const newDate = new Date(order.completedDate.getTime() - 330 * 60000);

                await prisma.serviceOrder.update({
                    where: { id: order.id },
                    data: {
                        completedDate: newDate
                    }
                });
                fixedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: "Successfully adjusted timestamps.",
            fixedCount
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
