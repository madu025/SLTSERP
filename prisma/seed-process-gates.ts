import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Process Gate Policies...');

  // MRN Gate 1: Initial Approval (Area Manager)
  const mrnGate1 = await prisma.processGatePolicy.upsert({
    where: {
      entityType_fromStatus_toStatus: {
        entityType: 'MATERIAL_REQUEST',
        fromStatus: 'ARM_APPROVAL',
        toStatus: 'STORES_MANAGER_APPROVAL',
      }
    },
    update: {},
    create: {
      entityType: 'MATERIAL_REQUEST',
      fromStatus: 'ARM_APPROVAL',
      toStatus: 'STORES_MANAGER_APPROVAL',
      label: 'MRN Initial Approval',
      isEnabled: true,
      rolesToNotify: ['STORES_MANAGER'],
      domainAction: null,
      approvalLevels: {
        create: [
          {
            level: 1,
            requiredRole: 'AREA_MANAGER',
            description: 'Approve Material Request creation',
          }
        ]
      }
    },
  });

  // MRN Gate 2: Stores Manager Approval
  const mrnGate2 = await prisma.processGatePolicy.upsert({
    where: {
      entityType_fromStatus_toStatus: {
        entityType: 'MATERIAL_REQUEST',
        fromStatus: 'STORES_MANAGER_APPROVAL',
        toStatus: 'OSP_MANAGER_APPROVAL',
      }
    },
    update: {},
    create: {
      entityType: 'MATERIAL_REQUEST',
      fromStatus: 'STORES_MANAGER_APPROVAL',
      toStatus: 'OSP_MANAGER_APPROVAL',
      label: 'MRN Stores Manager Approval',
      isEnabled: true,
      rolesToNotify: ['OSP_MANAGER'],
      domainAction: null,
      approvalLevels: {
        create: [
          {
            level: 1,
            requiredRole: 'STORES_MANAGER',
            description: 'Verify store capacity before OSP final approval',
          }
        ]
      }
    },
  });

  // MRN Gate 3: OSP Manager Approval
  const mrnGate3 = await prisma.processGatePolicy.upsert({
    where: {
      entityType_fromStatus_toStatus: {
        entityType: 'MATERIAL_REQUEST',
        fromStatus: 'OSP_MANAGER_APPROVAL',
        toStatus: 'PROCUREMENT', // default next stage
      }
    },
    update: {},
    create: {
      entityType: 'MATERIAL_REQUEST',
      fromStatus: 'OSP_MANAGER_APPROVAL',
      toStatus: 'PROCUREMENT',
      label: 'MRN OSP Manager Final Approval',
      isEnabled: true,
      rolesToNotify: ['STORES_MANAGER'],
      domainAction: 'TRIGGER_PROCUREMENT',
      approvalLevels: {
        create: [
          {
            level: 1,
            requiredRole: 'OSP_MANAGER',
            description: 'Final Approval for MRN',
          }
        ]
      }
    },
  });

  
  // SOD Gate 1: PENDING to INPROGRESS (Engineer Assignment)
  await prisma.processGatePolicy.upsert({
    where: {
      entityType_fromStatus_toStatus: {
        entityType: 'SERVICE_ORDER',
        fromStatus: 'PENDING',
        toStatus: 'INPROGRESS',
      }
    },
    update: {},
    create: {
      entityType: 'SERVICE_ORDER',
      fromStatus: 'PENDING',
      toStatus: 'INPROGRESS',
      label: 'SOD Assignment',
      isEnabled: true,
      rolesToNotify: ['CONTRACTOR'],
      domainAction: 'HANDLE_SOD_ASSIGNED',
      approvalLevels: {
        create: [
          {
            level: 1,
            requiredRole: 'ENGINEER',
            description: 'Assign SOD to Contractor',
          }
        ]
      }
    },
  });

  // SOD Gate 2: INPROGRESS to COMPLETED (PAT Approval)
  await prisma.processGatePolicy.upsert({
    where: {
      entityType_fromStatus_toStatus: {
        entityType: 'SERVICE_ORDER',
        fromStatus: 'INPROGRESS',
        toStatus: 'COMPLETED',
      }
    },
    update: {},
    create: {
      entityType: 'SERVICE_ORDER',
      fromStatus: 'INPROGRESS',
      toStatus: 'COMPLETED',
      label: 'SOD Completion (PAT)',
      isEnabled: true,
      rolesToNotify: ['OSP_MANAGER'],
      domainAction: 'HANDLE_SOD_COMPLETED',
      approvalLevels: {
        create: [
          {
            level: 1,
            requiredRole: 'CONTRACTOR',
            description: 'Contractor submits work',
          },
          {
            level: 2,
            requiredRole: 'ENGINEER',
            description: 'Engineer verifies PAT',
          }
        ]
      }
    },
  });

  console.log('Process Gate Policies seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
