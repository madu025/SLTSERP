import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const assetsCount = await prisma.iTAsset.count();
  console.log(`Total ITAssets in DB: ${assetsCount}`);
  
  const assets = await prisma.iTAsset.findMany({ take: 5 });
  console.log('Sample Assets:', JSON.stringify(assets, null, 2));

  const staffCount = await prisma.staff.count();
  console.log(`Total Staff in DB: ${staffCount}`);

  const userCount = await prisma.user.count();
  console.log(`Total Users in DB: ${userCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
