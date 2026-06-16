import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/[id]/otdr - List OTDR tests for a project
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const otdrTests = await prisma.oTDRTest.findMany({
            where: { projectId: id },
            orderBy: { testDate: 'desc' },
        });

        return NextResponse.json(otdrTests);
    } catch (error) {
        console.error('Error fetching OTDR tests:', error);
        return NextResponse.json(
            { error: 'Failed to fetch OTDR tests' },
            { status: 500 }
        );
    }
}

// POST /api/projects/[id]/otdr - Create a new OTDR test
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Generate a unique test number if not provided
        const testNumber = body.testNumber || `OTDR-${id.slice(0, 8)}-${Date.now()}`;

        const otdrTest = await prisma.oTDRTest.create({
            data: {
                projectId: id,
                testNumber,
                testDate: body.testDate ? new Date(body.testDate) : new Date(),
                testType: body.testType || 'INSTALLATION_ACCEPTANCE',
                fiberNumber: body.fiberNumber ? parseInt(body.fiberNumber) : null,
                wavelength: body.wavelength ? parseInt(body.wavelength) : null,
                cableSegmentId: body.cableSegmentId ?? null,
                traceFileName: body.traceFileName ?? null,
                traceFileUrl: body.traceFileUrl ?? null,
                fileFormat: body.fileFormat ?? null,
                totalLength: body.totalLength != null ? parseFloat(body.totalLength) : null,
                endToEndLoss: body.endToEndLoss != null ? parseFloat(body.endToEndLoss) : null,
                lossPerKm: body.lossPerKm != null ? parseFloat(body.lossPerKm) : null,
                orl: body.orl != null ? parseFloat(body.orl) : null,
                spliceLoss: body.spliceLoss != null ? parseFloat(body.spliceLoss) : null,
                connectorLoss: body.connectorLoss != null ? parseFloat(body.connectorLoss) : null,
                spliceCount: body.spliceCount != null ? parseInt(body.spliceCount) : null,
                eventCount: body.eventCount != null ? parseInt(body.eventCount) : null,
                lossLimit: body.lossLimit != null ? parseFloat(body.lossLimit) : null,
                orlLimit: body.orlLimit != null ? parseFloat(body.orlLimit) : null,
                autoResult: body.autoResult ?? null,
                failureReason: body.failureReason ?? null,
                testedById: body.testedById,
                equipmentModel: body.equipmentModel ?? null,
                equipmentSerial: body.equipmentSerial ?? null,
                remarks: body.remarks ?? null,
                status: body.status ?? 'PENDING_REVIEW',
            },
        });

        return NextResponse.json(otdrTest, { status: 201 });
    } catch (error) {
        console.error('Error creating OTDR test:', error);
        return NextResponse.json(
            { error: 'Failed to create OTDR test' },
            { status: 500 }
        );
    }
}
