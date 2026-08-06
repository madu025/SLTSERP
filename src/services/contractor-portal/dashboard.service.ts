import { prisma } from '@/lib/prisma';

/**
 * Empty dashboard payload for unresolvable contractor identities (e.g. a staff
 * JWT without contractorId when no ACTIVE contractor row exists). Returning
 * this shape instead of throwing keeps the portal route from 500-ing; genuine
 * contractor sessions always resolve a real contractor below.
 */
const EMPTY_DASHBOARD = {
    contractor: null,
    teams: [] as never[],
    stats: {
        dropWireMeters: 0,
        ontCount: 0,
        facCount: 0,
        pendingAcceptances: 0,
        activeSodsCount: 0,
        totalTeamsCount: 0
    }
};

export class ContractorDashboardService {
    static async getDashboardData(contractorId?: string) {
        // Fallback: If no contractorId from token, find first ACTIVE contractor
        if (!contractorId) {
            const defaultContractor = await prisma.contractor.findFirst({
                where: { status: 'ACTIVE' }
            });
            contractorId = defaultContractor?.id;
        }

        if (!contractorId) {
            return EMPTY_DASHBOARD;
        }

        // Fetch Contractor profile with ALL teams
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId },
            include: {
                opmc: { select: { id: true, name: true, rtom: true, region: true, province: true } },
                teams: {
                    include: {
                        opmc: { select: { id: true, name: true, rtom: true } },
                        members: true,
                        storeAssignments: {
                            include: { store: true }
                        }
                    }
                }
            }
        });

        if (!contractor) {
            return EMPTY_DASHBOARD;
        }

        const teamIds = contractor.teams.map(t => t.id);
        const teamCodes = contractor.teams.map(t => t.name);

        // Fetch real SODs count for all of contractor's teams
        const [sodCount, pendingDispatchesCount, vanStocks] = await Promise.all([
            prisma.serviceOrder.count({
                where: {
                    OR: [
                        { contractorId: contractor.id },
                        { teamId: { in: teamIds } },
                        { directTeam: { in: teamCodes } },
                        { woroTaskName: { in: teamCodes } }
                    ]
                }
            }),
            prisma.contractorMaterialIssue.count({
                where: {
                    contractorId: contractor.id,
                    status: 'ISSUED' // Pending contractor sign-off
                }
            }),
            prisma.contractorBatchStock.findMany({
                where: { contractorId: contractor.id },
                include: { item: true }
            })
        ]);

        // Aggregate real Van Stock metrics
        let dropWireMeters = 0;
        let ontCount = 0;
        let facCount = 0;

        vanStocks.forEach(s => {
            const itemCode = s.item?.code?.toUpperCase() || '';
            const itemName = s.item?.name?.toUpperCase() || '';

            if (itemCode.includes('DROP') || itemName.includes('DROP WIRE')) {
                dropWireMeters += Number(s.quantity);
            } else if (itemCode.includes('ONT') || itemName.includes('ONT')) {
                ontCount += Number(s.quantity);
            } else if (itemCode.includes('FAC') || itemName.includes('FAST') || itemName.includes('CONNECTOR')) {
                facCount += Number(s.quantity);
            }
        });

        return {
            contractor: {
                id: contractor.id,
                name: contractor.name,
                registrationNumber: contractor.registrationNumber,
                contactNumber: contractor.contactNumber,
                nic: contractor.nic,
                opmc: contractor.opmc
            },
            teams: contractor.teams,
            stats: {
                dropWireMeters: dropWireMeters || 0,
                ontCount: ontCount || 0,
                facCount: facCount || 0,
                pendingAcceptances: pendingDispatchesCount,
                activeSodsCount: sodCount,
                totalTeamsCount: contractor.teams.length
            }
        };
    }
}
