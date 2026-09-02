/**
 * One-off repair: KDL202609010060222 / KDL202609010061125 were bridge-sync
 * created on 2026-09-01 (pre-fix) with rtom=UNKNOWN and dumped into OPMC R-AD
 * by the old alphabetical fallback. Portal team "SLTSHO_T55 - Nimesh chamiditha"
 * was not registered; user confirmed the team belongs to R-KX.
 *
 * Steps: register contractor + team (idempotent), then reassign both SODs.
 */
import { primaryClient } from '../src/lib/prisma';

const RKX_OPMC_ID = '019fc74b-18b9-4e61-7cf4-910e79282af7';
const CONTRACTOR_NAME = 'Nimesh chamiditha';
const TEAM_SLT_CODE = 'SLTSHO_T55';
const TEAM_NAME = `${TEAM_SLT_CODE} - ${CONTRACTOR_NAME}`;
const SO_NUMS = ['KDL202609010060222', 'KDL202609010061125'];

async function main() {
    // 1. Contractor (SLTSHO pattern: one ACTIVE SOD contractor per person)
    let contractor = await primaryClient.contractor.findFirst({
        where: { name: { equals: CONTRACTOR_NAME, mode: 'insensitive' } },
    });
    if (!contractor) {
        contractor = await primaryClient.contractor.create({
            data: { name: CONTRACTOR_NAME, type: 'SOD', status: 'ACTIVE' },
        });
        console.log(`created contractor ${contractor.id} (${CONTRACTOR_NAME})`);
    } else {
        console.log(`contractor exists ${contractor.id}`);
    }

    // 2. Team (sltCode is the bridge-sync resolution key)
    let team = await primaryClient.contractorTeam.findFirst({
        where: { sltCode: TEAM_SLT_CODE },
    });
    if (!team) {
        team = await primaryClient.contractorTeam.create({
            data: {
                name: TEAM_NAME,
                sltCode: TEAM_SLT_CODE,
                contractorId: contractor.id,
                opmcId: RKX_OPMC_ID,
                status: 'ACTIVE',
            },
        });
        console.log(`created team ${team.id} (${TEAM_NAME} -> R-KX)`);
    } else {
        console.log(`team exists ${team.id}`);
    }

    // 3. Reassign the two orphaned SODs
    for (const soNum of SO_NUMS) {
        const updated = await primaryClient.serviceOrder.updateMany({
            where: { soNum, rtom: 'UNKNOWN' },
            data: {
                opmcId: RKX_OPMC_ID,
                rtom: 'R-KX',
                teamId: team.id,
                contractorId: contractor.id,
            },
        });
        console.log(`${soNum}: ${updated.count} row(s) moved to R-KX`);
    }
}

main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => primaryClient.$disconnect());
