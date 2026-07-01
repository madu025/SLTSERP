import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const banks = await prisma.bank.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(banks);
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : "Failed to fetch banks";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, name } = body;

        if (!code || !name) {
            return NextResponse.json({ error: "Bank Code and Name are required" }, { status: 400 });
        }

        const existing = await prisma.bank.findUnique({
            where: { code }
        });

        if (existing) {
            return NextResponse.json({ error: "Bank with this code already exists" }, { status: 400 });
        }

        const bank = await prisma.bank.create({
            data: { code, name }
        });

        return NextResponse.json(bank, { status: 201 });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : "Failed to create bank";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
