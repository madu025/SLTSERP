import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch a single asset by ID
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; assetId: string }> }
) {
    try {
        const { assetId } = await params;

        const asset = await prisma.projectAsset.findUnique({
            where: { id: assetId },
            include: {
                cables: true,
                connections: true,
                documents: true
            }
        });

        if (!asset) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        return NextResponse.json(asset);
    } catch (error) {
        console.error('Error fetching asset:', error);
        return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 });
    }
}

// PATCH: Update asset details
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; assetId: string }> }
) {
    try {
        const { assetId } = await params;
        const body = await request.json();
        const { assetType, assetCode, assetName, description, address, latitude, longitude, status } = body;

        const asset = await prisma.projectAsset.update({
            where: { id: assetId },
            data: {
                assetType: assetType ?? undefined,
                assetCode: assetCode ?? undefined,
                assetName: assetName ?? undefined,
                description: description ?? undefined,
                address: address ?? undefined,
                latitude: latitude ?? undefined,
                longitude: longitude ?? undefined,
                status: status ?? undefined
            },
            include: {
                cables: true,
                connections: true
            }
        });

        return NextResponse.json(asset);
    } catch (error) {
        console.error('Error updating asset:', error);
        return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
    }
}

// DELETE: Remove an asset registration
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; assetId: string }> }
) {
    try {
        const { assetId } = await params;

        await prisma.projectAsset.delete({ where: { id: assetId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting asset:', error);
        return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }
}