import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: projectId } = await params;

        // Fetch Project and its OPMC
        const project = await (prisma as any).project.findUnique({
            where: { id: projectId },
            include: { opmc: true }
        });

        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        // Fetch BOQ Items that are materials
        const boqItems = await (prisma as any).projectBOQItem.findMany({
            where: { 
                projectId,
                category: { in: ['MATERIAL', 'CABLE', 'CIVIL'] } // Add relevant material categories
            },
            include: { material: true }
        });

        // Find the main store or OPMC store to check stock against
        // For simplicity, we'll check the OPMC's assigned store or fallback to the Main Store.
        let store = null;
        if (project.opmcId) {
            store = await (prisma as any).inventoryStore.findFirst({
                where: { opmcs: { some: { id: project.opmcId } } }
            });
        }
        
        if (!store) {
            store = await (prisma as any).inventoryStore.findFirst({
                where: { type: 'MAIN' }
            });
        }

        if (!store) {
            return NextResponse.json({ error: 'No inventory store found to analyze against.' }, { status: 400 });
        }

        // Fetch stock levels for all relevant items
        const materialIds = boqItems.filter((i: any) => i.materialId).map((i: any) => i.materialId);
        const itemCodes = boqItems.filter((i: any) => !i.materialId).map((i: any) => i.itemCode);

        const stocks = await (prisma as any).inventoryStock.findMany({
            where: {
                storeId: store.id,
                item: {
                    OR: [
                        { id: { in: materialIds } },
                        { code: { in: itemCodes } }
                    ]
                }
            },
            include: { item: true }
        });

        // Combine data
        const analysis = boqItems.map((boqItem: any) => {
            const stock = stocks.find((s: any) => 
                s.itemId === boqItem.materialId || 
                s.item.code === boqItem.itemCode
            );
            
            const stockQty = stock ? Number(stock.quantity) : 0;
            const requiredQty = Number(boqItem.quantity);
            const shortfall = Math.max(0, requiredQty - stockQty);
            const recommendedSource = shortfall > 0 ? 'NEW' : 'EXISTING';

            return {
                boqItemId: boqItem.id,
                itemCode: boqItem.itemCode,
                description: boqItem.description,
                unit: boqItem.unit,
                requiredQty,
                availableStock: stockQty,
                shortfall,
                currentSource: boqItem.source,
                recommendedSource,
                materialId: stock?.item?.id || boqItem.materialId
            };
        });

        return NextResponse.json({
            store: { id: store.id, name: store.name, type: store.type },
            analysis
        });

    } catch (error: any) {
        console.error("Error analyzing BOQ:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: projectId } = await params;
        const updates = await request.json(); // Array of { boqItemId, source, materialId }

        if (!Array.isArray(updates)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Apply updates
        const updatePromises = updates.map((update: any) => 
            (prisma as any).projectBOQItem.update({
                where: { id: update.boqItemId },
                data: { 
                    source: update.source,
                    materialId: update.materialId || undefined
                }
            })
        );

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true, message: 'BOQ Sources updated successfully' });
    } catch (error: any) {
        console.error("Error updating BOQ sources:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
