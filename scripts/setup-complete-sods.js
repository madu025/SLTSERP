const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Find qa_contractor user and R-KX OPMC
    const qaContractor = await prisma.user.findFirst({ where: { username: 'qa_contractor' } });
    if (!qaContractor) throw new Error('qa_contractor user not found');
    console.log('qa_contractor:', qaContractor.id, qaContractor.role);

    // Find the OPMC for R-KX SODs
    const rkxSod = await prisma.serviceOrder.findFirst({
        where: { rtom: { contains: 'R-KX' } },
        select: { opmcId: true, opmc: { select: { name: true } } }
    });
    
    if (!rkxSod?.opmcId) {
        console.log('No OPMC found for R-KX SODs - checking if OPMC check will pass...');
    } else {
        console.log('R-KX OPMC:', rkxSod.opmcId, rkxSod.opmc?.name);
        
        // Assign OPMC to qa_contractor if not already
        const existing = await prisma.user.findFirst({
            where: { id: qaContractor.id, accessibleOpmcs: { some: { id: rkxSod.opmcId } } }
        });
        
        if (!existing) {
            await prisma.user.update({
                where: { id: qaContractor.id },
                data: {
                    accessibleOpmcs: { connect: { id: rkxSod.opmcId } }
                }
            });
            console.log('Assigned R-KX OPMC to qa_contractor');
        } else {
            console.log('qa_contractor already has R-KX OPMC access');
        }
    }

    // 2. Get all 10 INPROGRESS SODs assigned to the contractor
    const sods = await prisma.serviceOrder.findMany({
        where: {
            contractorId: qaContractor.contractorId,
            sltsStatus: 'INPROGRESS'
        },
        select: { id: true, soNum: true, rtom: true, opmcId: true, dropWireDistance: true }
    });
    
    console.log(`\nFound ${sods.length} INPROGRESS SODs to complete`);

    // 3. Get item IDs for material usage
    const dropWire = await prisma.inventoryItem.findFirst({ where: { code: 'OSPFTA003' } });
    const jointClosure = await prisma.inventoryItem.findFirst({ where: { code: 'OSP-JNT-001' } });
    
    if (!dropWire) throw new Error('Fiber Drop Wire item not found');
    if (!jointClosure) throw new Error('Fiber Optic Joint Closure item not found');
    
    console.log('\nMaterial items:');
    console.log(`  Drop Wire: ${dropWire.id} (${dropWire.name}, ${dropWire.unit})`);
    console.log(`  Joint Closure: ${jointClosure.id} (${jointClosure.name}, ${jointClosure.unit})`);

    // Output SOD IDs and item IDs for the API calls
    console.log('\n--- SOD DATA FOR API CALLS ---');
    for (const sod of sods) {
        console.log(JSON.stringify({
            id: sod.id,
            soNum: sod.soNum,
            rtom: sod.rtom,
            opmcId: sod.opmcId,
            items: {
                dropWire: { itemId: dropWire.id, quantity: '0.05', usageType: 'USED' },
                jointClosure: { itemId: jointClosure.id, quantity: '2', usageType: 'USED' }
            }
        }));
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
