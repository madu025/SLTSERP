import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const assetsCount = await prisma.iTAsset.count();
  console.log(`Total ITAssets in DB: ${assetsCount}`);
  
  const assets = await prisma.iTAsset.findMany({ take: 5 });
  console.log('Sample Assets:', JSON.stringify(assets, null, 2));

  const staff = await prisma.staff.findMany({ take: 5, select: { id: true, name: true, employeeId: true } });
  console.log('Sample Staff:', JSON.stringify(staff, null, 2));

  const userCount = await prisma.user.count();
  console.log(`Total Users in DB: ${userCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
