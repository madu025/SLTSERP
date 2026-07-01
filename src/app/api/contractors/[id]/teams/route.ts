import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const { teams, contractor } = await ContractorService.getContractorTeams(params.id);
        return NextResponse.json({ teams, contractor });
    } catch (error) {
        console.error("Error fetching teams:", error);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const { teams } = await request.json();
        await ContractorService.saveContractorTeams(params.id, teams);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving teams:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to save teams",
            details: String(error)
        }, { status: 500 });
    }
}
