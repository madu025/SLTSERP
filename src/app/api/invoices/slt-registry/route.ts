import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REGISTRY_FILE = path.join(process.cwd(), 'src/data/slt-boms.json');

export async function GET() {
    try {
        if (!fs.existsSync(REGISTRY_FILE)) {
            return NextResponse.json({ success: true, boms: [] });
        }
        const fileContent = fs.readFileSync(REGISTRY_FILE, 'utf-8');
        const boms = JSON.parse(fileContent);
        return NextResponse.json({ success: true, boms });
    } catch (error: unknown) {
        console.error('Failed to read BOM registry:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to read BOM registry' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { boms } = body;

        if (!boms || !Array.isArray(boms)) {
            return NextResponse.json(
                { success: false, message: 'Invalid payload: boms must be an array' },
                { status: 400 }
            );
        }

        // Ensure data directory exists
        const dir = path.dirname(REGISTRY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(boms, null, 2), 'utf-8');
        return NextResponse.json({ success: true, count: boms.length });
    } catch (error: unknown) {
        console.error('Failed to save BOM registry:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to save BOM registry' },
            { status: 500 }
        );
    }
}
