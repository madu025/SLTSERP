import { prisma } from '../src/lib/prisma';

async function main() {
    // Check for Sanjewa
    const sanjewa = await prisma.user.findFirst({
        where: { OR: [
            { username: { contains: 'sanjewa', mode: 'insensitive' } },
            { name: { contains: 'sanjewa', mode: 'insensitive' } }
        ]},
        select: { id: true, username: true, name: true, role: true, email: true }
    });
    console.log('Sanjewa:', JSON.stringify(sanjewa, null, 2));

    // Check for Tiroshan
    const tiroshan = await prisma.user.findFirst({
        where: { OR: [
            { username: { contains: 'tiroshan', mode: 'insensitive' } },
            { name: { contains: 'tiroshan', mode: 'insensitive' } }
        ]},
        select: { id: true, username: true, name: true, role: true, email: true }
    });
    console.log('Tiroshan:', JSON.stringify(tiroshan, null, 2));

    // Check material codes
    const materials = await prisma.inventoryItem.findMany({
        where: { OR: [
            { code: { contains: 'OSP-NC', mode: 'insensitive' } },
            { code: { contains: 'DWRET', mode: 'insensitive' } },
            { code: { contains: 'HOOK', mode: 'insensitive' } },
            { code: { contains: 'NUT', mode: 'insensitive' } }
        ]},
        select: { id: true, code: true, name: true, category: true }
    });
    console.log('Materials:', JSON.stringify(materials, null, 2));

    await prisma.$disconnect();
}

main();
