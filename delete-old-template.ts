import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // Delete old Cluster Dev template (upsert with empty update won't add nested relations)
  await p.workflowStageTemplate.deleteMany({ 
    where: { workflowTemplate: { name: 'Cluster Development Workflow' } } 
  });
  await p.workflowTemplate.deleteMany({ 
    where: { name: 'Cluster Development Workflow' } 
  });
  console.log('Old Cluster Development Workflow template deleted.');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });