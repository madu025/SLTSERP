import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all registered assets for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const assets = await prisma.projectAsset.findMany({
            where: { projectId },
            include: {
                cables: true,
                connections: true,
                documents: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(assets);
    } catch (error) {
        console.error('Error fetching project assets:', error);
        return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
}

// POST: Register a new asset
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { assetType, assetCode, assetName, description, address, latitude, longitude, status } = body;

        if (!assetType || !assetName) {
            return NextResponse.json({ error: 'Missing required fields: assetType, assetName' }, { status: 400 });
        }

        const asset = await prisma.projectAsset.create({
            data: {
                projectId,
                assetType,
                assetCode: assetCode || null,
                assetName,
                description: description || null,
                address: address || null,
                latitude: latitude || null,
                longitude: longitude || null,
                status: status || 'ACTIVE',
                createdById: 'system'
            },
            include: {
                cables: true,
                connections: true
            }
        });

        return NextResponse.json(asset, { status: 201 });
    } catch (error) {
        console.error('Error registering asset:', error);
        return NextResponse.json({ error: 'Failed to register asset' }, { status: 500 });
    }
}