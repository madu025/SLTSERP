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
            reqChecklist: false,
            reqPhotos: false,
            reqGPS: true,
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
            sequence: 2,
            reqMaterials: true,
            reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'All materials verified against BOQ', isMandatory: true },
                { label: 'Material issued to contractor', isMandatory: true },
              ],
            },
          },
          {
            name: 'Installation & Cabling',
            description: 'Field installation, cabling and splicing',
            sequence: 3,
            reqPhotos: true,
            reqChecklist: true,
            reqGPS: true,
            checklistTemplates: {
              create: [
                { label: 'Cable routed per design', isMandatory: true, reqPhoto: true },
                { label: 'ONT installed at customer premises', isMandatory: true, reqPhoto: true },
              ],
            },
          },
          {
            name: 'Testing & QA/QC',
            description: 'Fiber testing, OTDR acceptance, and quality inspection',
            sequence: 4,
            reqOTDR: true,
            reqApproval: true,
            reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'OTDR traces saved and within limits', isMandatory: true },
                { label: 'Visual inspection passed', isMandatory: true, reqPhoto: true },
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
            sequence: 5,
            reqApproval: true,
            reqDocuments: true,
            reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'Customer acceptance signed', isMandatory: true },
                { label: 'As-built documents submitted', isMandatory: true },
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
            checklistTemplates: {
              create: [
                { label: 'Demand forecast completed', isMandatory: true },
                { label: 'ROI analysis done', isMandatory: true },
                { label: 'Infrastructure availability confirmed', isMandatory: true },
              ],
            },
            approvalTemplates: {
              create: [
                { level: 1, role: 'OSP_MANAGER' },
              ],
            },
          },
          {
            name: 'Survey & Route Planning',
            description: 'Field survey and GIS route design',
            sequence: 2, reqPhotos: true, reqGPS: true, reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'GIS route data uploaded', isMandatory: true },
                { label: 'Field verification complete', isMandatory: true, reqPhoto: true },
                { label: 'GPS coordinates confirmed', isMandatory: true },
                { label: 'Pole/chamber locations marked', isMandatory: true },
              ],
            },
          },
          {
            name: 'Permit Management',
            description: 'All permits including RDA, LRA, etc.',
            sequence: 3, reqApproval: true, reqDocuments: true,
            approvalTemplates: {
              create: [
                { level: 1, role: 'AREA_MANAGER' },
              ],
            },
          },
          {
            name: 'Detailed Engineering',
            description: 'Detailed engineering and final BOQ',
            sequence: 4, reqApproval: true,
            approvalTemplates: {
              create: [
                { level: 1, role: 'ENGINEER' },
                { level: 2, role: 'AREA_MANAGER' },
              ],
            },
          },
          {
            name: 'Material Procurement',
            description: 'Procurement and store receiving',
            sequence: 5, reqMaterials: true, reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'BOQ finalized and approved', isMandatory: true },
                { label: 'PR created from BOQ', isMandatory: true },
                { label: 'PO issued to vendor', isMandatory: true },
                { label: 'Materials received at store', isMandatory: true },
              ],
            },
          },
          {
            name: 'Civil Works',
            description: 'Trenching, duct laying, chamber construction',
            sequence: 6, reqPhotos: true, reqChecklist: true, reqGPS: true,
            checklistTemplates: {
              create: [
                { label: 'Trenching completed per design', isMandatory: true, reqPhoto: true },
                { label: 'Duct laid and backfilled', isMandatory: true, reqPhoto: true },
                { label: 'Chambers constructed', isMandatory: true, reqPhoto: true },
                { label: 'GPS of chambers and duct path recorded', isMandatory: true },
                { label: 'HSE compliance verified', isMandatory: true },
              ],
            },
          },
          {
            name: 'Cabling & Splicing',
            description: 'Cable installation, fusion splicing, closure assembly',
            sequence: 7, reqPhotos: true, reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'Cable blown/pulled through ducts', isMandatory: true, reqPhoto: true },
                { label: 'Fusion splicing completed', isMandatory: true, reqPhoto: true },
                { label: 'Closure assembled and sealed', isMandatory: true, reqPhoto: true },
                { label: 'Slack cable stored properly', isMandatory: true },
                { label: 'Splice loss within spec', isMandatory: true },
              ],
            },
          },
          {
            name: 'OTDR Testing',
            description: 'End-to-end fiber testing and acceptance',
            sequence: 8, reqOTDR: true, reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'All fibers tested end-to-end', isMandatory: true },
                { label: 'OTDR traces saved', isMandatory: true },
                { label: 'Bi-directional testing done', isMandatory: true },
                { label: 'All results within acceptance criteria', isMandatory: true },
              ],
            },
          },
          {
            name: 'QA/QC & Commissioning',
            description: 'Quality inspection and network commissioning',
            sequence: 9, reqApproval: true, reqChecklist: true, reqPhotos: true,
            checklistTemplates: {
              create: [
                { label: 'Visual inspection passed', isMandatory: true, reqPhoto: true },
                { label: 'All test results within spec', isMandatory: true },
                { label: 'Site clean and tidy', isMandatory: true, reqPhoto: true },
                { label: 'NOC commissioning checklist completed', isMandatory: true },
              ],
            },
            approvalTemplates: {
              create: [
                { level: 1, role: 'QC_OFFICER' },
                { level: 2, role: 'OSP_MANAGER' },
              ],
            },
          },
          {
            name: 'Handover & Asset Registration',
            description: 'Final handover and asset registration with NOC',
            sequence: 10, reqApproval: true, reqDocuments: true, reqChecklist: true,
            checklistTemplates: {
              create: [
                { label: 'As-built documents completed', isMandatory: true },
                { label: 'Asset register created in NOC', isMandatory: true },
                { label: 'Customer acceptance signed', isMandatory: true },
                { label: 'All invoices processed', isMandatory: true },
                { label: 'Project closure report submitted', isMandatory: true },
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
