import { prisma } from '../src/lib/prisma';

async function fixPatRejectedReturns() {
    console.log('Checking for PAT Rejected SODs incorrectly categorized as sltsStatus="RETURN"...');

    try {
        const miscategorized = await prisma.serviceOrder.findMany({
            where: {
                sltsStatus: 'RETURN',
                OR: [
                    { opmcPatStatus: 'REJECTED' },
                    { hoPatStatus: 'REJECTED' },
                    { sltsPatStatus: 'REJECTED' },
                    { status: { contains: 'PAT_REJECTED' } },
                    { status: { contains: 'OPMC_REJECTED' } },
                    { status: { contains: 'HO_REJECTED' } }
                ]
            },
            select: { id: true, soNum: true, status: true }
        });

        console.log(`Found ${miscategorized.length} PAT Rejected SODs incorrectly set to sltsStatus="RETURN".`);

        if (miscategorized.length > 0) {
            const res = await prisma.serviceOrder.updateMany({
                where: {
                    id: { in: miscategorized.map(m => m.id) }
                },
                data: {
                    sltsStatus: 'COMPLETED'
                }
            });
            console.log(`SUCCESS: Restored ${res.count} PAT Rejected SODs back to sltsStatus="COMPLETED".`);
        } else {
            console.log('Zero PAT Rejected SODs were found in RETURN state.');
        }
    } catch (error) {
        console.error('Error fixing PAT rejected returns:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixPatRejectedReturns();
