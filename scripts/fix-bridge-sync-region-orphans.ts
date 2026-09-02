/**
 * One-off repair: reassign bridge-sync SODs that were dumped into OPMC R-AD
 * by the old "first OPMC alphabetically" fallback. Verified mappings:
 *   AN202609020081604 -> team SLTSKON_T14 -> OPMC R-KX (status DISAPPEARED was spurious)
 *   KDL202608220088754 -> team SLTSKON_T25 -> OPMC R-KX (completion left to periodic sync)
 */
import { primaryClient } from '../src/lib/prisma';

const RKX_OPMC_ID = '019fc74b-18b9-4e61-7cf4-910e79282af7';
const TEAM_T14 = { teamId: '01a0009c-b967-ca6c-477b-5c5faa3dfac5', contractorId: '01a0009c-b8d3-a6f6-91d9-14f9ac102a9d' };
const TEAM_T25 = { teamId: '01a0009c-bfdb-3e47-1230-0a865e8e7ccc', contractorId: '01a0009c-bf17-e6d5-c494-d14a98c9796d' };

async function main() {
    const an = await primaryClient.serviceOrder.update({
        where: { soNum: 'AN202609020081604' },
        data: {
            opmcId: RKX_OPMC_ID,
            rtom: 'R-KX',
            teamId: TEAM_T14.teamId,
            contractorId: TEAM_T14.contractorId,
            // DISAPPEARED was spurious: SOD was wrongly filed under R-AD whose
            // portal feed never contains it. Restore workflow status to match
            // the portal-mirrored sltsStatus (INPROGRESS).
            status: 'INPROGRESS',
        },
        select: { soNum: true, rtom: true, status: true, sltsStatus: true }
    });
    console.log('Repaired AN202609020081604:', an);

    const kdl = await primaryClient.serviceOrder.update({
        where: { soNum: 'KDL202608220088754' },
        data: {
            opmcId: RKX_OPMC_ID,
            rtom: 'R-KX',
            teamId: TEAM_T25.teamId,
            contractorId: TEAM_T25.contractorId,
            // status/sltsStatus untouched: the R-KX 15-min periodic sync pulls
            // the portal COMPLETED state and runs the proper completion pipeline.
        },
        select: { soNum: true, rtom: true, status: true, sltsStatus: true }
    });
    console.log('Repaired KDL202608220088754:', kdl);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => primaryClient.$disconnect());
