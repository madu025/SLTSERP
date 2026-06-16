import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateProgressOnBOQGenerate } from "@/lib/project-progress";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                gisRoutes: { include: { poles: true, chambers: true, closures: true, cableSegments: true } },
                job: true
            }
        });
        if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
        const routes = project.gisRoutes.filter(r => r.status !== "BOQ_GENERATED");
        if (routes.length === 0) return NextResponse.json({ message: "No routes need BOQ", projectId });
        const results = [];
        let totalBOQItems = 0;
        for (const gisRoute of routes) {
            const poleCount = gisRoute.poles.length;
            const chamberCount = gisRoute.chambers.length;
            const closureCount = gisRoute.closures.length;
            const totalCableLength = gisRoute.cableSegments.reduce((sum, seg) => sum + (seg.length || 0), 0);
            const inventoryItems = await prisma.inventoryItem.findMany({
                where: { OR: [
                    { name: { contains: "Pole", mode: "insensitive" } },
                    { name: { contains: "Fiber", mode: "insensitive" } },
                    { name: { contains: "Cable", mode: "insensitive" } },
                    { name: { contains: "Chamber", mode: "insensitive" } },
                    { name: { contains: "Closure", mode: "insensitive" } },
                    { name: { contains: "Splice", mode: "insensitive" } }
                ]}, take: 50
            });
            const findRate = (keywords) => {
                const m = inventoryItems.find(i => keywords.some(k => i.name?.toLowerCase().includes(k.toLowerCase())));
                return m?.unitPrice || 0;
            };
            const items = [];
            if (poleCount > 0) { const r = findRate(["pole","wooden","concrete"]); items.push({ itemCategory:"POLE",itemCode:"POLE-001",description:"Fiber Optic Pole",unit:"Nos",quantity:poleCount,unitRate:r,amount:poleCount*r,sourceType:"AUTO_CALCULATED",sourceReference:`GIS survey: ${poleCount} poles` }); }
            if (chamberCount > 0) { const r = findRate(["chamber","manhole"]); items.push({ itemCategory:"CHAMBER",itemCode:"CHMB-001",description:"Fiber Optic Chamber",unit:"Nos",quantity:chamberCount,unitRate:r,amount:chamberCount*r,sourceType:"AUTO_CALCULATED",sourceReference:`GIS survey: ${chamberCount} chambers` }); }
            if (closureCount > 0) { const r = findRate(["closure","splice"]); items.push({ itemCategory:"CLOSURE",itemCode:"CLSR-001",description:"Fiber Splice Closure",unit:"Nos",quantity:closureCount,unitRate:r,amount:closureCount*r,sourceType:"AUTO_CALCULATED",sourceReference:`GIS survey: ${closureCount} closures` }); }
            if (gisRoute.cableSegments.length > 0) { const r = findRate(["fiber","cable"]); items.push({ itemCategory:"CABLE",itemCode:"CBL-001",description:"Fiber Optic Cable",unit:"Meters",quantity:totalCableLength,unitRate:r,amount:totalCableLength*r,sourceType:"AUTO_CALCULATED",sourceReference:`GIS survey: ${gisRoute.cableSegments.length} segments, ${totalCableLength.toFixed(1)}m` }); }
            if (items.length === 0) { results.push({ routeId: gisRoute.id, message: "No data" }); continue; }
            const totalEstimated = items.reduce((s, i) => s + i.amount, 0);
            const boq = await prisma.gISGeneratedBOQ.create({
                data: { routeId: gisRoute.id, projectId, status: "DRAFT", totalEstimated, notes: "Auto-generated from survey", createdById: body.createdById || null, items: { create: items } },
                include: { items: true }
            });
            const pboqItems = items.map((item, idx) => ({ projectId, itemCode: `${item.itemCode}-${String(idx+1).padStart(2,'0')}`, description: item.description, unit: item.unit, quantity: item.quantity, unitRate: item.unitRate, amount: item.amount, category: item.itemCategory, remarks: item.sourceReference }));
            const existing = await prisma.projectBOQItem.findMany({ where: { projectId, remarks: { contains: "GIS survey" } } });
            if (existing.length > 0) await prisma.projectBOQItem.deleteMany({ where: { id: { in: existing.map(i => i.id) } } });
            await prisma.projectBOQItem.createMany({ data: pboqItems });
            await prisma.gISRoute.update({ where: { id: gisRoute.id }, data: { status: "BOQ_GENERATED" } });
            totalBOQItems += items.length;
            results.push({ routeId: gisRoute.id, routeName: gisRoute.name, itemsGenerated: items.length, totalEstimated, projectBOQItems: pboqItems.length });
        }
        const totalBOQ = results.reduce((s, r) => s + (r.totalEstimated || 0), 0);
        if (totalBOQ > 0) await prisma.project.update({ where: { id: projectId }, data: { budget: totalBOQ } });
        if (project.job) await prisma.job.update({ where: { id: project.job.id }, data: { status: "SURVEY_COMPLETED" } });
        await updateProgressOnBOQGenerate(projectId);
        return NextResponse.json({ message: `Survey complete. BOQ: ${totalBOQItems} items.`, projectId, totalBOQItems, totalEstimated: totalBOQ, results, nextStep: "BOQ in DRAFT. Review to continue." }, { status: 201 });
    } catch (error) {
        console.error("survey-complete error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
