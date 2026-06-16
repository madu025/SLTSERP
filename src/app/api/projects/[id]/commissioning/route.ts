import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch commissioned assets for a project
// Uses ProjectAsset records and inventory serials to build real commissioning data
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // Query real project assets from database
        const assets = await prisma.projectAsset.findMany({
            where: { projectId },
            include: {
                _count: {
                    select: { inspections: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Also query inventory serials linked to this project (commissioned items)
        // Check if there's a relation via inspections or directly
        const commissionedItems = assets.map((asset) => ({
            id: asset.id,
            name: asset.assetName,
            serialNumber: asset.assetCode,
            status: asset.status,
            type: asset.assetType,
            warrantyMonths: asset.warrantyMonths || 12,
            date: asset.installationDate || asset.createdAt.toISOString(),
            location: asset.latitude ? `${asset.latitude}, ${asset.longitude}` : null,
            inspections: asset._count.inspections
        }));

        return NextResponse.json(commissionedItems);
    } catch (error) {
        console.error('Error fetching commissioning assets:', error);
        return NextResponse.json({ error: 'Failed to fetch commissioned assets' }, { status: 500 });
    }
}

// POST: Log a commissioned asset (persists to ProjectAsset table)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { name, serialNumber, warrantyMonths, status, assetType, latitude, longitude } = body;

        if (!name || !serialNumber) {
            return NextResponse.json({ error: 'Asset name and serial number are required' }, { status: 400 });
        }

        // Create a real ProjectAsset record in the database
        const asset = await prisma.projectAsset.create({
            data: {
                projectId,
                assetType: assetType || 'COMMISSIONED_EQUIPMENT',
                assetCode: serialNumber,
                assetName: name,
                status: status || 'COMMISSIONED',
                warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : 12,
                latitude: latitude || null,
                longitude: longitude || null,
                sourceType: 'MANUAL',
                createdById: body.createdById || null,
                installationDate: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            asset: {
                id: asset.id,
                name: asset.assetName,
                serialNumber: asset.assetCode,
                status: asset.status,
                type: asset.assetType,
                warrantyMonths: asset.warrantyMonths,
                date: asset.installationDate,
                location: asset.latitude ? `${asset.latitude}, ${asset.longitude}` : null,
            }
        });
    } catch (error) {
        console.error('Error commissioning asset:', error);
        return NextResponse.json({ error: 'Failed to commission asset' }, { status: 500 });
    }
}