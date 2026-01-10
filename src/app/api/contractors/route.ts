import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET
export async function GET() {
    try {
        const contractors = await prisma.contractor.findMany({
            include: {
                store: { select: { id: true, name: true } },
                teams: {
                    include: {
                        opmc: { select: { id: true, name: true } },
                        members: true,
                        storeAssignments: true // Includes storeId and isPrimary
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(contractors);
    } catch (error) {
        console.error('Error fetching contractors:', error);
        return NextResponse.json({ message: 'Error fetching contractors' }, { status: 500 });
    }
}

// POST
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            name, address, registrationNumber, brNumber, status,
            registrationFeePaid, agreementSigned, agreementDate,
            bankAccountNumber, bankBranch, storeId,
            teams = []
        } = body;

        if (!name || !registrationNumber) {
            return NextResponse.json({ message: 'Name and Registration Number required' }, { status: 400 });
        }

        // 1. Create Contractor
        const contractor = await prisma.contractor.create({
            data: {
                name,
                address,
                registrationNumber,
                brNumber,
                status: status || 'PENDING',
                registrationFeePaid,
                agreementSigned,
                agreementDate: agreementDate ? new Date(agreementDate) : null,
                bankAccountNumber,
                bankBranch,
                storeId: storeId || null
            }
        });

        // 2. Create Teams & Members (if any)
        if (teams.length > 0) {
            for (const team of teams) {
                await prisma.contractorTeam.create({
                    data: {
                        name: team.name,
                        contractorId: contractor.id,
                        opmcId: team.opmcId || null,
                        // Create store assignments if provided
                        storeAssignments: team.storeIds && team.storeIds.length > 0 ? {
                            create: team.storeIds.map((storeId: string) => ({
                                storeId,
                                isPrimary: storeId === team.primaryStoreId
                            }))
                        } : undefined,
                        members: {
                            create: team.members.map((m: any) => ({
                                name: m.name,
                                idCopyNumber: m.idCopyNumber || '',
                                contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                                contractorId: contractor.id // Explicitly link to contractor
                            }))
                        }
                    }
                });
            }
        }

        return NextResponse.json(contractor);

    } catch (error) {
        console.error('Error creating contractor:', error);
        return NextResponse.json({ message: 'Error creating contractor' }, { status: 500 });
    }
}

// PUT
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            id, name, address, registrationNumber, brNumber, status,
            registrationFeePaid, agreementSigned, agreementDate,
            bankAccountNumber, bankBranch, storeId,
            teams // Assume teams is passed for full update or handled separately?
            // For simplicity, let's just update Basic Info here. 
            // Teams management might be complex via PUT.
            // If teams array is provided, we can handle it smart-ly, but risk deleting existing data.
            // Valid strategy: Update basic info. Sync teams?
            // User requirement: "Contractor function build karanna".
            // Let's support basic update here.
        } = body;

        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        const updated = await prisma.contractor.update({
            where: { id },
            data: {
                name, address, registrationNumber, brNumber, status,
                registrationFeePaid, agreementSigned,
                agreementDate: agreementDate ? new Date(agreementDate) : null,
                bankAccountNumber, bankBranch,
                storeId: storeId || null
            }
        });

        // If teams are passed, handle them? 
        // Ideally we should use separate API for team management for simpler logic and safety,
        // or clear and recreate (dangerous for IDs).
        // Let's stick to basic update and rely on Sub-components for Team mgmt if needed, 
        // OR implement FULL sync (Delete all teams, recreate).
        // Given the request complexity, let's implement FULL SYNC for teams if provided.
        if (teams) {
            // Delete existing teams/members?
            await prisma.contractorTeam.deleteMany({ where: { contractorId: id } });
            await prisma.teamMember.deleteMany({ where: { contractorId: id } }); // Cleanup direct members too if any left

            for (const team of teams) {
                await prisma.contractorTeam.create({
                    data: {
                        name: team.name,
                        contractorId: id,
                        opmcId: team.opmcId || null,
                        storeAssignments: team.storeIds && team.storeIds.length > 0 ? {
                            create: team.storeIds.map((storeId: string) => ({
                                storeId,
                                isPrimary: storeId === team.primaryStoreId
                            }))
                        } : undefined,
                        members: {
                            create: team.members.map((m: any) => ({
                                name: m.name,
                                idCopyNumber: m.idCopyNumber || '',
                                contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                                contractorId: id
                            }))
                        }
                    }
                });
            }
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating contractor:', error);
        return NextResponse.json({ message: 'Error updating contractor' }, { status: 500 });
    }
}

// DELETE
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        await prisma.contractor.delete({ where: { id } });
        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Error deleting contractor:', error);
        return NextResponse.json({ message: 'Error deleting contractor' }, { status: 500 });
    }
}
