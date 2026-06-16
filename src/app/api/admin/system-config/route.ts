
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Use raw query to fetch configs (model not in client)
        const configs: any[] = await prisma.$queryRaw`SELECT * FROM "SystemConfig"`;

        // Convert array to object
        const configMap = configs.reduce((acc: Record<string, string>, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);

        return NextResponse.json(configMap);
    } catch (error) {
        console.error("Config fetch error:", error);
        return NextResponse.json({ message: 'Error fetching configs' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { key, value, description } = body;

        if (!key || value === undefined) {
            return NextResponse.json({ message: 'Key and Value required' }, { status: 400 });
        }

        // Upsert using raw SQL standard for Postgres
        // Note: Manual handling of updatedAt since Prisma middleware won't run
        const result: any[] = await prisma.$queryRaw`
            INSERT INTO "SystemConfig" ("key", "value", "description", "updatedAt")
            VALUES (${key}, ${value}, ${description}, NOW())
            ON CONFLICT ("key") 
            DO UPDATE SET "value" = ${value}, "description" = ${description}, "updatedAt" = NOW()
            RETURNING *
        `;

        return NextResponse.json(result[0]);
    } catch (error) {
        console.error("Config update error:", error);
        return NextResponse.json({ message: 'Error updating config' }, { status: 500 });
    }
}
