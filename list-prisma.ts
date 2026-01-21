import { prisma } from './src/lib/prisma';

async function listPrismaModels() {
    const keys = Object.keys(prisma);
    console.log('Prisma keys:', keys.filter(k => !k.startsWith('_')).sort());
}

listPrismaModels().finally(() => prisma.$disconnect());
