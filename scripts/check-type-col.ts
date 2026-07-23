import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumnType() {
    const res: any = await prisma.$queryRaw`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'ChartOfAccount' AND column_name = 'type';
    `;
    console.log('PostgreSQL Column Type Info for ChartOfAccount.type:', res);
}

checkColumnType().finally(() => prisma.$disconnect());
