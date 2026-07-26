import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.gLMappingConfig.deleteMany({});
  console.log('Cleared GLMappingConfig');
}
main().catch(console.error).finally(() => prisma.$disconnect());
