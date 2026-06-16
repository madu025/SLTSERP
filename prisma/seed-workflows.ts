import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding workflow templates...');

  // ============================================
  // 1. Create Project Types
  // ============================================
  const projectTypes = [
    { name: 'SSD', description: 'Standard Service Delivery - FTTH installations' },
    { name: 'OPMC_SSD', description: 'OPMC-managed Standard Service Delivery' },
    { name: 'CLUSTER_DEVELOPMENT', description: 'Greenfield/Brownfield cluster fiber development' },
    { name: 'BUILDING_FIBER', description: 'Multi-dwelling building fiber rollout' },
    { name: 'BUILDING_NETWORK', description: 'Building internal network cabling' },
    { name: 'RELATED_TELECOM', description: 'Related telecom infrastructure projects' },
  ];

  for (const pt of projectTypes) {
    await prisma.projectType.upsert({
      where: { name: pt.name },
      update: { description: pt.description },
      create: pt,
    });
  }
  console.log('✓ Project types created');

  // ============================================
  // 2. Create Workflow Templates
  // ============================================
  const ssdType = await prisma.projectType.findUnique({ where: { name: 'SSD' } });
  const clusterType = await prisma.projectType.findUnique({ where: { name: 'CLUSTER_DEVELOPMENT' } });
  const buildingFiberType = await prisma.projectType.findUnique({ where: { name: 'BUILDING_FIBER' } });

  if (!ssdType || !clusterType || !buildingFiberType) {
    throw new Error('Project types not found');
  }

  // --- SSD Standard Workflow (7 stages) ---
  const ssdWorkflow = await prisma.workflowTemplate.upsert({
    where: { name: 'SSD Standard Workflow' },
    update: {},
    create: {
      name: 'SSD Standard Workflow',
      description: 'Standard workflow for FTTH/SSD service delivery projects',
      projectTypeId: ssdType.id,
      stages: {
        create: [
          {
            name: 'Survey & Feasibility',
            description: 'Site survey and technical feasibility assessment',
            sequence: 1,
            reqApproval: true,
            reqChecklist: true,
            reqPhotos: true,
            reqGPS: true,
            checklistTemplates: {
              create: [
                { label: 'Customer premises accessible', isMandatory: true },
                { label: 'Drop wire route identified', isMandatory: true },
                { label: 'Pole/closure availability confirmed', isMandatory: true },
                { label: 'Photo of proposed route captured', isMandatory: true, reqPhoto: true },
              ],
            },
            approvalTemplates: {
              create: [
                { level: 1, role: 'ENGINEER' },
                { level: 2, role: 'AREA_MANAGER' },
              ],
            },
          },
          {
            name: 'Permit Acquisition',
            description: 'Obtain necessary permits and wayleave agreements',
            sequence: 2,
            reqApproval: true,
            reqDocuments: true,
            approvalTemplates: {
              create: [
                { level: 1, role: 'ENGINEER' },
                { level: 2, role: 'AREA_MANAGER' },
              ],
            },
          },
          {
            name: 'Material Issuance',
            description: 'Issue materials from store to contractor',
            sequence: 3,
            reqMaterials: true,
            reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'All materials verified against BOQ', isMandatory: true },
                { label: 'Serial numbers recorded', isMandatory: false, reqPhoto: true },
                { label: 'Material issued to contractor', isMandatory: true },
              ],
            },
          },
          {
            name: 'Installation & Cabling',
            description: 'Field installation, cabling and splicing',
            sequence: 4,
            reqPhotos: true,
            reqChecklist: true,
            reqGPS: true,
            checklistTemplates: {
              create: [
                { label: 'Cable routed per design', isMandatory: true, reqPhoto: true },
                { label: 'Splice closure properly sealed', isMandatory: true, reqPhoto: true },
                { label: 'Drop wire installed securely', isMandatory: true },
                { label: 'ONT installed at customer premises', isMandatory: true, reqPhoto: true },
              ],
            },
          },
          {
            name: 'Testing & OTDR',
            description: 'Fiber testing and OTDR acceptance',
            sequence: 5,
            reqOTDR: true,
            reqChecklist: true,
            approvalTemplates: {
              create: [
                { level: 1, role: 'QC_OFFICER' },
              ],
            },
            conditions: {
              create: [
                { field: 'otdrRequired', operator: 'EQUALS', value: 'true', action: 'REQUIRE' },
              ],
            },
          },
          {
            name: 'QA/QC Inspection',
            description: 'Quality inspection and sign-off',
            sequence: 6,
            reqApproval: true,
            reqChecklist: true,
            reqPhotos: true,
            checklistTemplates: {
              create: [
                { label: 'Visual inspection passed', isMandatory: true, reqPhoto: true },
                { label: 'All test results within limits', isMandatory: true },
                { label: 'Site clean and tidy', isMandatory: true, reqPhoto: true },
              ],
            },
            approvalTemplates: {
              create: [
                { level: 1, role: 'QC_OFFICER' },
                { level: 2, role: 'AREA_MANAGER' },
              ],
            },
          },
          {
            name: 'Handover & Closure',
            description: 'Project handover and closure documentation',
            sequence: 7,
            reqApproval: true,
            reqDocuments: true,
            reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'Customer acceptance signed', isMandatory: true },
                { label: 'As-built documents submitted', isMandatory: true },
                { label: 'All photos uploaded', isMandatory: true },
                { label: 'Material reconciliation complete', isMandatory: true },
              ],
            },
            approvalTemplates: {
              create: [
                { level: 1, role: 'AREA_MANAGER' },
                { level: 2, role: 'OSP_MANAGER' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('✓ SSD Standard Workflow created');

  // --- Cluster Development Workflow (10 stages) ---
  await prisma.workflowTemplate.upsert({
    where: { name: 'Cluster Development Workflow' },
    update: {},
    create: {
      name: 'Cluster Development Workflow',
      description: 'Complete workflow for greenfield/brownfield cluster fiber development',
      projectTypeId: clusterType.id,
      stages: {
        create: [
          {
            name: 'Feasibility Study',
            description: 'Technical and commercial feasibility assessment',
            sequence: 1, reqApproval: true, reqChecklist: true,
          },
          {
            name: 'Survey & Route Planning',
            description: 'Field survey and GIS route design',
            sequence: 2, reqPhotos: true, reqGPS: true, reqChecklist: true,
          },
          {
            name: 'Permit Management',
            description: 'All permits including RDA, LRA, etc.',
            sequence: 3, reqApproval: true, reqDocuments: true,
          },
          {
            name: 'Detailed Engineering',
            description: 'Detailed engineering and final BOQ',
            sequence: 4, reqApproval: true,
          },
          {
            name: 'Material Procurement',
            description: 'Procurement and store receiving',
            sequence: 5, reqMaterials: true, reqChecklist: true,
          },
          {
            name: 'Civil Works',
            description: 'Trenching, duct laying, chamber construction',
            sequence: 6, reqPhotos: true, reqChecklist: true, reqGPS: true,
          },
          {
            name: 'Cabling & Splicing',
            description: 'Cable installation, fusion splicing, closure assembly',
            sequence: 7, reqPhotos: true, reqChecklist: true,
          },
          {
            name: 'OTDR Testing',
            description: 'End-to-end fiber testing and acceptance',
            sequence: 8, reqOTDR: true, reqChecklist: true,
          },
          {
            name: 'QA/QC & Commissioning',
            description: 'Quality inspection and network commissioning',
            sequence: 9, reqApproval: true, reqChecklist: true, reqPhotos: true,
          },
          {
            name: 'Handover & Asset Registration',
            description: 'Final handover and asset registration with NOC',
            sequence: 10, reqApproval: true, reqDocuments: true, reqChecklist: true,
          },
        ],
      },
    },
  });
  console.log('✓ Cluster Development Workflow created');

  // --- Building Fiber Workflow (8 stages) ---
  await prisma.workflowTemplate.upsert({
    where: { name: 'Building Fiber Workflow' },
    update: {},
    create: {
      name: 'Building Fiber Workflow',
      description: 'Workflow for multi-dwelling building fiber rollout',
      projectTypeId: buildingFiberType.id,
      stages: {
        create: [
          { name: 'Building Survey', description: 'Building assessment and feasibility', sequence: 1, reqPhotos: true, reqChecklist: true },
          { name: 'Permit & Access', description: 'Building owner permit and access agreement', sequence: 2, reqApproval: true, reqDocuments: true },
          { name: 'Material Issuance', description: 'Issue materials for building work', sequence: 3, reqMaterials: true, reqChecklist: true },
          { name: 'Riser & Horizontal Cabling', description: 'Install riser and horizontal cabling', sequence: 4, reqPhotos: true, reqChecklist: true },
          { name: 'Splicing & Termination', description: 'Fiber splicing and termination at ODF', sequence: 5, reqPhotos: true, reqChecklist: true },
          { name: 'Testing', description: 'Fiber testing and OTDR', sequence: 6, reqOTDR: true },
          { name: 'QA/QC', description: 'Quality inspection', sequence: 7, reqApproval: true, reqChecklist: true },
          { name: 'Handover', description: 'Building handover with as-built docs', sequence: 8, reqApproval: true, reqDocuments: true },
        ],
      },
    },
  });
  console.log('✓ Building Fiber Workflow created');

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
