
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const [teams, contractor] = await prisma.$transaction([
            prisma.contractorTeam.findMany({
                where: { contractorId: params.id },
                include: {
                    members: true,
                    storeAssignments: {
                        include: {
                            store: { select: { id: true, name: true, type: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.contractor.findUnique({
                where: { id: params.id },
                select: {
                    name: true,
                    contactNumber: true,
                    address: true,
                    nic: true,
                    photoUrl: true,
                    nicFrontUrl: true,
                    policeReportUrl: true,
                    gramaCertUrl: true
                }
            })
        ]);

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
        const contractorId = params.id;

        const existingTeams = await prisma.contractorTeam.findMany({
            where: { contractorId },
            select: { id: true }
        });
        const existingIds = existingTeams.map(t => t.id);
        const incomingIds = teams.filter((t: any) => !t.id.startsWith('temp')).map((t: any) => t.id);

        const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

        await prisma.$transaction(async (tx) => {
            // 1. Delete removed teams
            if (idsToDelete.length > 0) {
                await tx.contractorTeam.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
            }

            // 2. Upsert teams
            for (const team of teams) {
                const teamData = {
                    name: team.name,
                    status: team.status,
                    contractorId: contractorId,
                };

                let teamId = team.id;

                if (team.id.startsWith('temp')) {
                    // Create New Team
                    const newTeam = await tx.contractorTeam.create({
                        data: teamData
                    });
                    teamId = newTeam.id;
                } else {
                    // Update Existing Team
                    await tx.contractorTeam.update({
                        where: { id: team.id },
                        data: teamData
                    });
                }

                // 3. Handle Store Assignments
                await tx.teamStoreAssignment.deleteMany({ where: { teamId } });

                if (team.storeAssignments && team.storeAssignments.length > 0) {
                    await tx.teamStoreAssignment.createMany({
                        data: team.storeAssignments.map((sa: any) => ({
                            teamId,
                            storeId: sa.storeId,
                            isPrimary: sa.isPrimary || false
                        }))
                    });
                }

                // 4. Handle Members
                const currentMembers = await tx.teamMember.findMany({
                    where: { teamId },
                    select: { id: true }
                });
                const curMemIds = currentMembers.map(m => m.id);
                const incMemIds = team.members
                    .filter((m: any) => !m.id.startsWith('mem'))
                    .map((m: any) => m.id);

                const memsToDelete = curMemIds.filter(id => !incMemIds.includes(id));
                if (memsToDelete.length > 0) {
                    await tx.teamMember.deleteMany({ where: { id: { in: memsToDelete } } });
                }

                for (const member of (team.members || [])) {
                    // Prevent 'contractor' related errors by strictly defining scalar fields
                    const memData = {
                        name: member.name,
                        idCopyNumber: member.idCopyNumber,
                        contactNumber: member.contactNumber,
                        address: member.address,
                        photoUrl: member.photoUrl,
                        nicUrl: member.nicUrl,
                        policeReportUrl: member.policeReportUrl,
                        gramaCertUrl: member.gramaCertUrl,
                        contractorId: contractorId, // Explicitly set foreign key
                        teamId: teamId,
                        shoeSize: member.shoeSize,
                        tshirtSize: member.tshirtSize,
                        passportPhotoUrl: member.passportPhotoUrl
                    };

                    if (member.id && member.id.startsWith('mem')) {
                        await tx.teamMember.create({ data: memData });
                    } else if (member.id) {
                        await tx.teamMember.update({
                            where: { id: member.id },
                            data: memData
                        });
                    }
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving teams:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to save teams",
            details: String(error)
        }, { status: 500 });
    }
}
