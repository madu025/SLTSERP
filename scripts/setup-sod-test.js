const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Link qa_contractor to Sanjewa FTTH Contractor
    const contractor = await prisma.contractor.findFirst({
        where: { name: { contains: 'Sanjewa FTTH', mode: 'insensitive' } }
    });
    
    if (!contractor) {
        console.log('Sanjewa FTTH Contractor not found');
        return;
    }
    console.log('Found contractor:', contractor.id, contractor.name);

    const qaUser = await prisma.user.findFirst({
        where: { username: 'qa_contractor' }
    });

    if (!qaUser) {
        console.log('qa_contractor user not found');
        return;
    }
    console.log('Found qa_contractor:', qaUser.id, qaUser.name);

    await prisma.user.update({
        where: { id: qaUser.id },
        data: { contractorId: contractor.id }
    });
    console.log('Linked qa_contractor to Sanjewa FTTH Contractor');

    // 2. Create Fiber Joint item if not exists
    const existingJoint = await prisma.inventoryItem.findFirst({
        where: { name: { contains: 'Joint', mode: 'insensitive' } }
    });
    
    if (existingJoint) {
        console.log('Fiber Joint item already exists:', existingJoint.id, existingJoint.name);
    } else {
        const joint = await prisma.inventoryItem.create({
            data: {
                name: 'Fiber Optic Joint Closure',
                code: 'OSP-JNT-001',
                unit: 'Nos',
                category: 'CABLE_ACCESSORIES',
                description: 'Fiber optic joint closure for outdoor use'
            }
        });
        console.log('Created Fiber Joint item:', joint.id, joint.name);
    }

    // 3. Add stock for Fiber Joint to Kaduwela Store
    const jointItem = await prisma.inventoryItem.findFirst({
        where: { name: { contains: 'Joint', mode: 'insensitive' } }
    });
    
    const kaduwelaStore = await prisma.inventoryStore.findFirst({
        where: { name: { contains: 'Kaduwela', mode: 'insensitive' } }
    });

    if (jointItem && kaduwelaStore) {
        const existingStock = await prisma.inventoryStock.findUnique({
            where: { storeId_itemId: { storeId: kaduwelaStore.id, itemId: jointItem.id } }
        });
        
        if (!existingStock) {
            await prisma.inventoryStock.create({
                data: {
                    storeId: kaduwelaStore.id,
                    itemId: jointItem.id,
                    quantity: 100
                }
            });
            console.log('Added 100 Fiber Joints to Kaduwela Store');
        } else {
            console.log('Fiber Joint stock already exists:', existingStock.quantity);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
