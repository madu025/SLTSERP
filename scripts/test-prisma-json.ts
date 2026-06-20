import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma JSON path filtering...');
  
  // Try querying with JSON path filtering
  try {
    const point = await prisma.surveyPoint.findFirst({
      where: {
        attributes: {
          path: ['qfield_uuid'],
          equals: 'non-existent-uuid-for-test-purposes'
        }
      }
    });
    console.log('✅ JSON path filtering is supported! Query succeeded without error.');
  } catch (e: any) {
    console.error('❌ JSON path filtering failed:', e.message || e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
