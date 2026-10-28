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
  // Production stage-gate lifecycle: requirements -> survey -> design -> review ->
  // CAD -> review -> BOQ -> approval -> work packages -> delivery -> closure.
  // Semi-tasks are deliberate handoff points: each has a stable code, owner role,
  // team key, progress weight, and dependency so the UI can automate the plan.
  const buildingFiberStages = [
    {
      code: 'REQUIREMENTS_EVALUATION', name: 'Requirements Evaluation', workstream: 'DISCOVERY', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN',
      description: 'Evaluate the request, site constraints, building type, route scope, and acceptance requirements before planning.', sequence: 1,
      reqApproval: true, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'Requirement and scope evaluated', isMandatory: true }, { label: 'Building / LEA / outdoor context classified', isMandatory: true }] },
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
      taskTemplates: { create: [
        { code: 'EVAL_SCOPE', name: 'Evaluate request and scope', taskType: 'SEMI_TASK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN', isRequired: true, autoProgressWeight: 35 },
        { code: 'CLASSIFY_SITE', name: 'Classify building, LEA or outdoor site', taskType: 'SEMI_TASK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN', isRequired: true, autoProgressWeight: 35, dependsOnCode: 'EVAL_SCOPE' },
        { code: 'REQUIREMENTS_SIGNOFF', name: 'Record requirements sign-off', taskType: 'REVIEW', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 30, dependsOnCode: 'CLASSIFY_SITE' },
      ] },
    },
    {
      code: 'SURVEY_PLAN', name: 'Survey Plan & Field Survey', workstream: 'FIELD_OPERATIONS', assignmentRole: 'OSP_ENGINEER', assignmentTeamKey: 'FIELD_SURVEY',
      description: 'Create the survey plan, complete field/mobile survey, and record survey evidence.', sequence: 2,
      reqApproval: true, reqChecklist: true, reqPhotos: true,
      checklistTemplates: { create: [{ label: 'Survey plan and scope recorded', isMandatory: true }, { label: 'Field survey evidence uploaded', isMandatory: true, reqPhoto: true }] },
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
      taskTemplates: { create: [
        { code: 'SURVEY_PLAN', name: 'Prepare survey plan', taskType: 'SEMI_TASK', assignmentRole: 'OSP_ENGINEER', assignmentTeamKey: 'FIELD_SURVEY', isRequired: true, autoProgressWeight: 30 },
        { code: 'FIELD_SURVEY', name: 'Complete mobile / field survey', taskType: 'SEMI_TASK', assignmentRole: 'OSP_ENGINEER', assignmentTeamKey: 'FIELD_SURVEY', isRequired: true, autoProgressWeight: 50, dependsOnCode: 'SURVEY_PLAN' },
        { code: 'SURVEY_EVIDENCE', name: 'Attach survey evidence and submit', taskType: 'HANDOFF', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'FIELD_SURVEY' },
      ] },
    },
    {
      code: 'DESIGN_PLAN', name: 'Design Plan', workstream: 'DESIGN', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN',
      description: 'Turn evaluated requirements and survey evidence into a project-specific design plan.', sequence: 3,
      reqChecklist: true,
      checklistTemplates: { create: [{ label: 'Design basis and assumptions recorded', isMandatory: true }, { label: 'Project-specific design options evaluated', isMandatory: true }] },
      taskTemplates: { create: [
        { code: 'DESIGN_BASIS', name: 'Prepare design basis and assumptions', taskType: 'SEMI_TASK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN', isRequired: true, autoProgressWeight: 40 },
        { code: 'DESIGN_PLAN', name: 'Prepare project design plan', taskType: 'SEMI_TASK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN', isRequired: true, autoProgressWeight: 40, dependsOnCode: 'DESIGN_BASIS' },
        { code: 'DESIGN_SUBMIT', name: 'Submit design plan for review', taskType: 'HANDOFF', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'DESIGN_PLAN' },
      ] },
    },
    {
      code: 'DESIGN_REVIEW', name: 'Design Review & Approval', workstream: 'DESIGN_REVIEW', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'PM_REVIEW',
      description: 'Review design completeness, scope, constructability, cost assumptions, and request rework where needed.', sequence: 4,
      reqApproval: true, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'Design review comments resolved', isMandatory: true }, { label: 'Design revision submitted', isMandatory: true }] },
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
      taskTemplates: { create: [
        { code: 'DESIGN_TECH_REVIEW', name: 'Technical design review', taskType: 'REVIEW', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 45 },
        { code: 'DESIGN_REWORK', name: 'Resolve design comments and resubmit', taskType: 'REWORK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_DESIGN', isRequired: true, autoProgressWeight: 35, dependsOnCode: 'DESIGN_TECH_REVIEW' },
        { code: 'DESIGN_APPROVAL', name: 'Approve design plan', taskType: 'APPROVAL', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'DESIGN_REWORK' },
      ] },
    },
    {
      code: 'CAD_DRAWING', name: 'CAD Drawing Upload', workstream: 'CAD', assignmentRole: 'ENGINEER', assignmentTeamKey: 'CAD_TEAM',
      description: 'Prepare, version, upload, and submit CAD drawings based on the approved design plan.', sequence: 5,
      reqApproval: true, reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
      taskTemplates: { create: [
        { code: 'CAD_PREPARE', name: 'Prepare CAD drawing package', taskType: 'SEMI_TASK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'CAD_TEAM', isRequired: true, autoProgressWeight: 60 },
        { code: 'CAD_UPLOAD', name: 'Upload drawing revision and evidence', taskType: 'HANDOFF', assignmentRole: 'ENGINEER', assignmentTeamKey: 'CAD_TEAM', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'CAD_PREPARE' },
        { code: 'CAD_SUBMIT', name: 'Submit CAD package for review', taskType: 'HANDOFF', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'CAD_UPLOAD' },
      ] },
    },
    {
      code: 'CAD_REVIEW', name: 'CAD Review & Approval', workstream: 'CAD_REVIEW', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_REVIEW',
      description: 'Review drawing quality, constructability, quantities, and project-specific requirements; rework and resubmit when required.', sequence: 6,
      reqApproval: true, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'CAD drawing review completed', isMandatory: true }, { label: 'CAD comments resolved or accepted', isMandatory: true }] },
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
      taskTemplates: { create: [
        { code: 'CAD_TECH_REVIEW', name: 'Review CAD drawing package', taskType: 'REVIEW', assignmentRole: 'ENGINEER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 45 },
        { code: 'CAD_REWORK', name: 'Update CAD drawing and resubmit', taskType: 'REWORK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'CAD_TEAM', isRequired: true, autoProgressWeight: 35, dependsOnCode: 'CAD_TECH_REVIEW' },
        { code: 'CAD_APPROVAL', name: 'Approve final CAD drawing', taskType: 'APPROVAL', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'CAD_REWORK' },
      ] },
    },
    {
      code: 'BOQ_PREPARATION', name: 'BOQ Preparation', workstream: 'BOQ', assignmentRole: 'ENGINEER', assignmentTeamKey: 'BOQ_TEAM',
      description: 'Generate and validate the BOQ from the approved survey/design/CAD package.', sequence: 7, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'BOQ items generated or entered', isMandatory: true }, { label: 'Quantities and rates reviewed', isMandatory: true }] },
      taskTemplates: { create: [
        { code: 'BOQ_GENERATE', name: 'Generate BOQ from approved CAD/design', taskType: 'SEMI_TASK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'BOQ_TEAM', isRequired: true, autoProgressWeight: 55 },
        { code: 'BOQ_VALIDATE', name: 'Validate quantities, rates and scope', taskType: 'REVIEW', assignmentRole: 'ENGINEER', assignmentTeamKey: 'BOQ_REVIEW', isRequired: true, autoProgressWeight: 30, dependsOnCode: 'BOQ_GENERATE' },
        { code: 'BOQ_HANDOFF', name: 'Hand approved design package to BOQ owner', taskType: 'HANDOFF', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 15, dependsOnCode: 'BOQ_VALIDATE' },
      ] },
    },
    {
      code: 'BOQ_APPROVAL', name: 'BOQ Approval', workstream: 'BOQ_REVIEW', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'PM_REVIEW',
      description: 'Record technical, project, and finance BOQ approval or rejection with a traceable revision.', sequence: 8, reqApproval: true, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'BOQ approval decision recorded', isMandatory: true }] },
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }, { level: 3, role: 'FINANCE_MANAGER' }] },
      taskTemplates: { create: [
        { code: 'BOQ_TECH_REVIEW', name: 'Technical BOQ review', taskType: 'REVIEW', assignmentRole: 'ENGINEER', assignmentTeamKey: 'BOQ_REVIEW', isRequired: true, autoProgressWeight: 40 },
        { code: 'BOQ_REWORK', name: 'Resolve BOQ comments and resubmit', taskType: 'REWORK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'BOQ_TEAM', isRequired: true, autoProgressWeight: 30, dependsOnCode: 'BOQ_TECH_REVIEW' },
        { code: 'BOQ_SIGNOFF', name: 'Record final BOQ approval', taskType: 'APPROVAL', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'PM_REVIEW', isRequired: true, autoProgressWeight: 30, dependsOnCode: 'BOQ_REWORK' },
      ] },
    },
    {
      code: 'CHILD_TASK_ALLOCATION', name: 'Child Task & Contractor Allocation', workstream: 'PLANNING', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PMO',
      description: 'Split approved BOQ scope into executable child tasks and allocate contractors per package.', sequence: 9, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'Approved BOQ scope split into child tasks', isMandatory: true }, { label: 'Each executable child task has a contractor', isMandatory: true }] },
      taskTemplates: { create: [
        { code: 'SPLIT_SCOPE', name: 'Split approved BOQ into child tasks', taskType: 'SEMI_TASK', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PMO', isRequired: true, autoProgressWeight: 50 },
        { code: 'ALLOCATE_CONTRACTORS', name: 'Allocate contractor per work package', taskType: 'SEMI_TASK', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PMO', isRequired: true, autoProgressWeight: 50, dependsOnCode: 'SPLIT_SCOPE' },
      ] },
    },
    {
      code: 'PERMIT_ACCESS', name: 'Permit & Access', workstream: 'PRE_CONSTRUCTION', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'FIELD_OPERATIONS', description: 'Obtain building access, wayleave, and related permits before implementation.', sequence: 10, reqApproval: true, reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'AREA_MANAGER' }] },
      taskTemplates: { create: [{ code: 'ACCESS_CLEARANCE', name: 'Confirm site access and permits', taskType: 'SEMI_TASK', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'FIELD_OPERATIONS', isRequired: true, autoProgressWeight: 100 }] },
    },
    {
      code: 'IMPLEMENTATION', name: 'Implementation', workstream: 'DELIVERY', assignmentRole: 'CONTRACTOR_SUPERVISOR', assignmentTeamKey: 'CONTRACTOR_TEAMS', description: 'Execute contractor-assigned child tasks and record field progress/evidence.', sequence: 11, reqChecklist: true, reqPhotos: true,
      checklistTemplates: { create: [{ label: 'Implementation child tasks completed', isMandatory: true }, { label: 'Field completion evidence uploaded', isMandatory: true, reqPhoto: true }] },
      taskTemplates: { create: [{ code: 'EXECUTE_CHILD_TASKS', name: 'Execute allocated child tasks', taskType: 'SEMI_TASK', assignmentRole: 'CONTRACTOR_SUPERVISOR', assignmentTeamKey: 'CONTRACTOR_TEAMS', isRequired: true, autoProgressWeight: 80 }, { code: 'FIELD_CLOSEOUT', name: 'Submit field completion evidence', taskType: 'HANDOFF', assignmentRole: 'CONTRACTOR_SUPERVISOR', assignmentTeamKey: 'CONTRACTOR_TEAMS', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'EXECUTE_CHILD_TASKS' }] },
    },
    {
      code: 'INHOUSE_PAT', name: 'In-house PAT', workstream: 'QUALITY', assignmentRole: 'QC_OFFICER', assignmentTeamKey: 'QA_QC', description: 'Complete the internal/pre-acceptance test and resolve failed points.', sequence: 12, reqApproval: true, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'In-house PAT session passed', isMandatory: true }] }, approvalTemplates: { create: [{ level: 1, role: 'QC_OFFICER' }] },
      taskTemplates: { create: [{ code: 'PRE_PAT', name: 'Run in-house PAT and resolve failures', taskType: 'REVIEW', assignmentRole: 'QC_OFFICER', assignmentTeamKey: 'QA_QC', isRequired: true, autoProgressWeight: 100 }] },
    },
    {
      code: 'SLT_PAT', name: 'SLT PAT', workstream: 'ACCEPTANCE', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'QA_QC', description: 'Complete SLT acceptance testing and record the final acceptance result.', sequence: 13, reqApproval: true, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'SLT PAT session passed', isMandatory: true }] }, approvalTemplates: { create: [{ level: 1, role: 'AREA_MANAGER' }, { level: 2, role: 'OSP_MANAGER' }] },
      taskTemplates: { create: [{ code: 'SLT_ACCEPTANCE', name: 'Run SLT PAT and record acceptance', taskType: 'REVIEW', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'QA_QC', isRequired: true, autoProgressWeight: 100 }] },
    },
    {
      code: 'AS_BUILT', name: 'As-Built (GIS + CAD or CAD Only)', workstream: 'CLOSEOUT', assignmentRole: 'ENGINEER', assignmentTeamKey: 'AS_BUILT', description: 'Submit approved GIS plus CAD as-built, or CAD-only as-built where GIS is unavailable.', sequence: 14, reqApproval: true, reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'ENGINEER' }, { level: 2, role: 'AREA_MANAGER' }] },
      taskTemplates: { create: [{ code: 'AS_BUILT_PACKAGE', name: 'Prepare GIS/CAD or CAD-only as-built package', taskType: 'SEMI_TASK', assignmentRole: 'ENGINEER', assignmentTeamKey: 'AS_BUILT', isRequired: true, autoProgressWeight: 80 }, { code: 'AS_BUILT_APPROVAL', name: 'Review and approve as-built package', taskType: 'APPROVAL', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'AS_BUILT', isRequired: true, autoProgressWeight: 20, dependsOnCode: 'AS_BUILT_PACKAGE' }] },
    },
    {
      code: 'INVOICE_SUBMISSION', name: 'Invoice Submission', workstream: 'FINANCE', assignmentRole: 'CONTRACTOR_FINANCE', assignmentTeamKey: 'PROJECT_FINANCE', description: 'Submit contractor-specific invoices linked to completed tasks and BOQ items.', sequence: 15, reqDocuments: true,
      taskTemplates: { create: [{ code: 'CONTRACTOR_INVOICE', name: 'Submit contractor invoice by completed package', taskType: 'SEMI_TASK', assignmentRole: 'CONTRACTOR_FINANCE', assignmentTeamKey: 'PROJECT_FINANCE', isRequired: true, autoProgressWeight: 100 }] },
    },
    {
      code: 'INVOICE_FOLLOW_UP', name: 'Invoice Follow-up', workstream: 'FINANCE', assignmentRole: 'INVOICE_MANAGER', assignmentTeamKey: 'PROJECT_FINANCE', description: 'Track invoice review, payment progress, and contractor follow-up actions.', sequence: 16, reqChecklist: true,
      checklistTemplates: { create: [{ label: 'Invoice follow-up action recorded', isMandatory: true }] },
      taskTemplates: { create: [{ code: 'INVOICE_TRACKING', name: 'Track invoice review and payment follow-up', taskType: 'SEMI_TASK', assignmentRole: 'INVOICE_MANAGER', assignmentTeamKey: 'PROJECT_FINANCE', isRequired: true, autoProgressWeight: 100 }] },
    },
    {
      code: 'PROJECT_CLOSURE', name: 'Invoice Completed & Closure', workstream: 'CLOSURE', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PMO', description: 'Confirm all contractor invoices are completed, archive evidence, and close the project.', sequence: 17, reqApproval: true, reqDocuments: true,
      approvalTemplates: { create: [{ level: 1, role: 'AREA_MANAGER' }, { level: 2, role: 'OSP_MANAGER' }] },
      taskTemplates: { create: [{ code: 'CLOSE_PROJECT', name: 'Verify invoice completion and close project', taskType: 'APPROVAL', assignmentRole: 'OSP_MANAGER', assignmentTeamKey: 'PMO', isRequired: true, autoProgressWeight: 100 }] },
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
