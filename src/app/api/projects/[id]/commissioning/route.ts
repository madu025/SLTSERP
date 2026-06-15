import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch commissioned assets for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // In a real ERP system, this queries deployed inventory items linked to WBS.
        // We will return a structured list of commissioned assets.
        const assets = [
            { id: 'asset-1', name: 'ONT GPON Client Unit', serialNumber: 'ONT-5534-112', status: 'COMMISSIONED', warrantyMonths: 12, date: new Date().toISOString() },
            { id: 'asset-2', name: '1:8 Fiber Splitter Module', serialNumber: 'SPL-990-441', status: 'VERIFIED', warrantyMonths: 24, date: new Date().toISOString() }
        ];

        return NextResponse.json(assets);
    } catch (error) {
        console.error('Error fetching commissioning assets:', error);
        return NextResponse.json({ error: 'Failed to fetch commissioned assets' }, { status: 500 });
    }
}

// POST: Log a commissioned asset
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { name, serialNumber, warrantyMonths, status } = body;

        if (!name || !serialNumber) {
            return NextResponse.json({ error: 'Asset name and serial number are required' }, { status: 400 });
        }

        // Return logged asset acknowledgement
        return NextResponse.json({
            success: true,
            asset: {
                id: `asset-${Math.random().toString(36).substr(2, 9)}`,
                projectId,
                name,
                serialNumber,
                warrantyMonths: Number(warrantyMonths || 12),
                status: status || 'COMMISSIONED',
                date: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error commissioning asset:', error);
        return NextResponse.json({ error: 'Failed to commission asset' }, { status: 500 });
    }
}
