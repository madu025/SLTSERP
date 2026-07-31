import { PrismaClient } from '@prisma/client';
import { MODULE_STATUS_REGISTRY } from '../src/config/process-gate-statuses';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Workflow Statuses...');
  for (const [entityType, statuses] of Object.entries(MODULE_STATUS_REGISTRY)) {
    for (const status of statuses) {
      await prisma.workflowStatus.upsert({
        where: {
          entityType_value: {
            entityType,
            value: status.value
          }
        },
        update: {
          label: status.label,
          badgeColor: status.badgeColor
        },
        create: {
          entityType,
          value: status.value,
          label: status.label,
          badgeColor: status.badgeColor
        }
      });
    }
  }
  console.log('Workflow Statuses seeded successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
