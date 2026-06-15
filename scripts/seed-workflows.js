const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Project Types and Workflows...');

  // 1. Create Project Types
  const types = [
    { name: 'SSD', description: 'Single Service Delivery (Standard Fiber connection)' },
    { name: 'OPMC SSD', description: 'OPMC local SSD connection' },
    { name: 'Cluster Development', description: 'Large FTTH Cluster rollout projects' },
    { name: 'Building Fiber', description: 'Multi-dwelling units (MDU) fiber layout' },
    { name: 'Building Network', description: 'Internal LAN / building network layout' },
    { name: 'Related Telecom', description: 'Miscellaneous telecom engineering works' },
    { name: 'Custom', description: 'Custom ad-hoc project workflow' },
  ];

  const typeMap = {};
  for (const type of types) {
    const record = await prisma.projectType.upsert({
      where: { name: type.name },
      update: { description: type.description },
      create: { name: type.name, description: type.description },
    });
    typeMap[type.name] = record.id;
    console.log(`Project Type Upserted: ${record.name} (${record.id})`);
  }

  // 2. Create standard template for Cluster Development
  const clusterDevType = typeMap['Cluster Development'];
  const clusterTemplate = await prisma.workflowTemplate.upsert({
    where: { name: 'Cluster Development Standard Workflow' },
    update: { isActive: true },
    create: {
      name: 'Cluster Development Standard Workflow',
      description: 'Standard multi-stage fiber deployment workflow with active gates.',
      projectTypeId: clusterDevType,
      isActive: true,
    },
  });

  console.log(`Workflow Template Upserted: ${clusterTemplate.name}`);

  // 3. Setup Stages for Cluster Development
  const stages = [
    {
      name: 'Survey',
      sequence: 1,
      reqChecklist: true,
      reqGPS: true,
      checklists: ['Perform route walkthrough', 'Confirm pole markers', 'Lodge survey diagram'],
      tasks: ['Conduct detailed site inspection', 'Draft survey CAD drawings'],
    },
    {
      name: 'Permit Approval',
      sequence: 2,
      reqApproval: true,
      reqDocuments: true,
      checklists: ['Verify local council approval', 'Lodge safety clearance certificate'],
      tasks: ['Lodge application to municipal council', 'Obtain right-of-way permit approval'],
    },
    {
      name: 'Material Allocation',
      sequence: 3,
      reqChecklist: true,
      checklists: ['Verify stock count in Sub Store', 'Issue MRN voucher'],
      tasks: ['Requisition drums and drop wire from store'],
    },
    {
      name: 'Civil Work',
      sequence: 4,
      reqChecklist: true,
      reqPhotos: true,
      checklists: ['Excavation to specifications', 'Verify duct depth (> 1.2m)', 'Backfilling audit'],
      tasks: ['Perform trenching and duct installation'],
    },
    {
      name: 'Fiber Installation',
      sequence: 5,
      reqChecklist: true,
      checklists: ['Confirm blowing pressure', 'Test tension flags'],
      tasks: ['Perform fiber cable blowing through ducts'],
    },
    {
      name: 'Splicing',
      sequence: 6,
      reqChecklist: true,
      reqApproval: true,
      checklists: ['Verify core alignment color matching', 'Install splice closure dome'],
      tasks: ['Splice fibers at distribution points'],
    },
    {
      name: 'OTDR Testing',
      sequence: 7,
      reqChecklist: true,
      reqDocuments: true,
      reqOTDR: true,
      checklists: ['Conduct bi-directional test', 'Log fiber loss metrics (< 0.3 dB/km)'],
      tasks: ['Run OTDR tests and upload log files'],
    },
    {
      name: 'QA Inspection',
      sequence: 8,
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      checklists: ['Verify visual neatness of poles', 'Inspect dome sealing ring', 'Approve inspection request (IR)'],
      tasks: ['Raise QA inspection request and sign off'],
    },
    {
      name: 'Closure',
      sequence: 9,
      reqApproval: true,
      reqDocuments: true,
      checklists: ['Verify As-Built handovers', 'Lodge final cost ledger', 'Generate operations handover sign-off'],
      tasks: ['Lodge final handover package'],
    },
  ];

  for (const stage of stages) {
    const stageRecord = await prisma.workflowStageTemplate.upsert({
      where: {
        workflowTemplateId_sequence: {
          workflowTemplateId: clusterTemplate.id,
          sequence: stage.sequence,
        },
      },
      update: {
        name: stage.name,
        reqApproval: stage.reqApproval ?? false,
        reqChecklist: stage.reqChecklist ?? false,
        reqPhotos: stage.reqPhotos ?? false,
        reqDocuments: stage.reqDocuments ?? false,
        reqOTDR: stage.reqOTDR ?? false,
        reqGPS: stage.reqGPS ?? false,
      },
      create: {
        workflowTemplateId: clusterTemplate.id,
        name: stage.name,
        sequence: stage.sequence,
        reqApproval: stage.reqApproval ?? false,
        reqChecklist: stage.reqChecklist ?? false,
        reqPhotos: stage.reqPhotos ?? false,
        reqDocuments: stage.reqDocuments ?? false,
        reqOTDR: stage.reqOTDR ?? false,
        reqGPS: stage.reqGPS ?? false,
      },
    });

    console.log(`  Stage [${stage.sequence}] Upserted: ${stageRecord.name}`);

    // Create checklists templates
    for (const label of stage.checklists) {
      await prisma.workflowChecklistTemplate.create({
        data: {
          stageTemplateId: stageRecord.id,
          label,
          isMandatory: true,
        },
      });
    }

    // Create tasks templates
    for (const name of stage.tasks) {
      await prisma.workflowTaskTemplate.create({
        data: {
          stageTemplateId: stageRecord.id,
          name,
          priority: 'MEDIUM',
        },
      });
    }

    // If approval required, add level 1 approval template for Project Manager
    if (stage.reqApproval) {
      await prisma.workflowApprovalTemplate.create({
        data: {
          stageTemplateId: stageRecord.id,
          level: 1,
          role: 'PROJECT_MANAGER',
        },
      });
    }
  }

  console.log('Seeding Completed Successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
