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
  await prisma.workflowTemplate.upsert({
    where: { name: 'SSD Standard Workflow' },
    update: {
      description: 'Standard workflow for FTTH/SSD service delivery projects',
      projectTypeId: ssdType.id,
      isActive: true,
    },
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
    update: {
      description: 'Complete workflow for greenfield/brownfield cluster fiber development',
      projectTypeId: clusterType.id,
      isActive: true,
    },
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

  // --- Building Fiber / Project Delivery Workflow ---
  // This is the canonical end-to-end lifecycle used by the Project Module:
  // survey -> CAD -> BOQ -> approval -> child work packages -> implementation
  // -> in-house PAT -> SLT PAT -> as-built -> invoicing -> closure.
  const buildingFiberStages = [
    {
      name: 'Survey Plan & Field Survey',
      description: 'Create the survey plan, complete field/mobile survey, and record survey evidence',
      sequence: 1,
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      checklistTemplates: {
        create: [
          { label: 'Survey plan and scope recorded', isMandatory: true },
          { label: 'Field survey evidence uploaded', isMandatory: true, reqPhoto: true },
        ],
      },
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
    },
    {
      name: 'CAD Drawing Upload',
      description: 'Upload, version, review, and approve the CAD drawing package',
      sequence: 2,
      reqApproval: true,
      reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
    },
    {
      name: 'BOQ Preparation',
      description: 'Generate and validate the BOQ from the approved survey/CAD design',
      sequence: 3,
      reqChecklist: true,
      checklistTemplates: {
        create: [
          { label: 'BOQ items generated or entered', isMandatory: true },
          { label: 'Quantities and rates reviewed', isMandatory: true },
        ],
      },
    },
    {
      name: 'BOQ Approval',
      description: 'Technical, project, and finance BOQ approval or rejection',
      sequence: 4,
      reqChecklist: true,
      checklistTemplates: { create: [{ label: 'BOQ approval decision recorded', isMandatory: true }] },
    },
    {
      name: 'Child Task & Contractor Allocation',
      description: 'Split the approved scope into child tasks and allocate one or more contractors',
      sequence: 5,
      reqChecklist: true,
      checklistTemplates: {
        create: [
          { label: 'Approved BOQ scope split into child tasks', isMandatory: true },
          { label: 'Each executable child task has a contractor', isMandatory: true },
        ],
      },
    },
    {
      name: 'Permit & Access',
      description: 'Obtain building access, wayleave, and related permits before implementation',
      sequence: 6,
      reqApproval: true,
      reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'AREA_MANAGER' }] },
    },
    {
      name: 'Implementation',
      description: 'Execute contractor-assigned child tasks and record field progress/evidence',
      sequence: 7,
      reqChecklist: true,
      reqPhotos: true,
      checklistTemplates: {
        create: [
          { label: 'Implementation child tasks completed', isMandatory: true },
          { label: 'Field completion evidence uploaded', isMandatory: true, reqPhoto: true },
        ],
      },
    },
    {
      name: 'In-house PAT',
      description: 'Complete the internal/pre-acceptance test and resolve failed points',
      sequence: 8,
      reqApproval: true,
      reqChecklist: true,
      checklistTemplates: { create: [{ label: 'In-house PAT session passed', isMandatory: true }] },
      approvalTemplates: { create: [{ level: 1, role: 'QC_OFFICER' }] },
    },
    {
      name: 'SLT PAT',
      description: 'Complete SLT acceptance testing and record the final acceptance result',
      sequence: 9,
      reqApproval: true,
      reqChecklist: true,
      checklistTemplates: { create: [{ label: 'SLT PAT session passed', isMandatory: true }] },
      approvalTemplates: { create: [{ level: 1, role: 'AREA_MANAGER' }, { level: 2, role: 'OSP_MANAGER' }] },
    },
    {
      name: 'As-Built (GIS + CAD or CAD Only)',
      description: 'Submit approved GIS plus CAD as-built, or CAD-only as-built where GIS is unavailable',
      sequence: 10,
      reqApproval: true,
      reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
    },
    {
      name: 'Invoice Submission',
      description: 'Submit contractor-specific invoices linked to completed tasks and BOQ items',
      sequence: 11,
      reqDocuments: true,
    },
    {
      name: 'Invoice Follow-up',
      description: 'Track invoice review, payment progress, and contractor follow-up actions',
      sequence: 12,
      reqChecklist: true,
      checklistTemplates: { create: [{ label: 'Invoice follow-up action recorded', isMandatory: true }] },
    },
    {
      name: 'Invoice Completed & Closure',
      description: 'Confirm all contractor invoices are completed and close the project',
      sequence: 13,
      reqApproval: true,
      reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'AREA_MANAGER' }, { level: 2, role: 'OSP_MANAGER' }] },
    },
  ];

  await prisma.workflowTemplate.upsert({
    where: { name: 'Building Fiber Workflow' },
    update: {
      description: 'Workflow for multi-dwelling building fiber rollout',
      projectTypeId: buildingFiberType.id,
      isActive: true,
      // Keep the template aligned for deployments that already have the project type.
      // Project workflow instances are snapshots, so existing projects remain stable.
      stages: { deleteMany: {}, create: buildingFiberStages },
    },
    create: {
      name: 'Building Fiber Workflow',
      description: 'Workflow for multi-dwelling building fiber rollout',
      projectTypeId: buildingFiberType.id,
      stages: { create: buildingFiberStages },
    },
  });
  console.log('✓ Building Fiber Workflow created');

  // Fail loudly if a deployment has a project type without a usable workflow.
  // This keeps a partial/failed seed from presenting an empty workflow selector.
  const requiredTemplates = [
    'SSD Standard Workflow',
    'Cluster Development Workflow',
    'Building Fiber Workflow',
  ];
  const seededTemplates = await prisma.workflowTemplate.findMany({
    where: { name: { in: requiredTemplates }, isActive: true },
    select: { name: true, projectTypeId: true, stages: { select: { id: true } } },
  });
  const missingTemplates = requiredTemplates.filter((name) => {
    const template = seededTemplates.find((candidate) => candidate.name === name);
    return !template || !template.projectTypeId || template.stages.length === 0;
  });
  if (missingTemplates.length > 0) {
    throw new Error(`Workflow seed verification failed: ${missingTemplates.join(', ')}`);
  }

  console.log(`\n✅ Seeding complete! Verified ${seededTemplates.length} active workflow templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
