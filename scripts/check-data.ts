import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    const count = await prisma.serviceOrder.count();
    console.log('Total service orders:', count);

    if (count > 0) {
        const sample = await prisma.serviceOrder.findFirst();
        console.log('Sample record sltsStatus:', sample?.sltsStatus);
        console.log('Sample record opmcId:', sample?.opmcId);
    }

    await prisma.$disconnect();
}

checkData();
