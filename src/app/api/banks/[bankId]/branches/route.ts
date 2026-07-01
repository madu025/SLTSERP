import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ bankId: string }> }
) {
    try {
        const { bankId } = await params;
        const branches = await prisma.bankBranch.findMany({
            where: { bankId },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(branches);
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : "Failed to fetch branches";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ bankId: string }> }
) {
    try {
        const { bankId } = await params;
        const body = await request.json();
        const { code, name } = body;

        if (!code || !name) {
            return NextResponse.json({ error: "Branch Code and Name are required" }, { status: 400 });
        }

        const existing = await prisma.bankBranch.findUnique({
            where: {
                bankId_code: {
                    bankId,
                    code
                }
            }
        });

        if (existing) {
            return NextResponse.json({ error: "Branch with this code already exists under this bank" }, { status: 400 });
        }

        const branch = await prisma.bankBranch.create({
            data: {
                bankId,
                code,
                name
            }
        });

        return NextResponse.json(branch, { status: 201 });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : "Failed to create branch";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
