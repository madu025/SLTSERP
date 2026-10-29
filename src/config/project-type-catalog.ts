/**
 * Project type catalog used by workflow seeding and the project-type API.
 *
 * Keep this catalog business-oriented: a project type selects a workflow
 * family, while the Project.parentId hierarchy allows a main project to own
 * any number of different sub-project types (for example CCTV under a
 * building development).  Roles below are existing database roles; this
 * avoids introducing a second, disconnected role system.
 */

export type ProjectPlanningSource = 'GIS' | 'CAD' | 'MANUAL';

export interface ProjectTypeCatalogEntry {
    name: string;
    description: string;
    defaultPlanningSource: ProjectPlanningSource;
    roleSummary: string[];
    workflowName: string;
    workflowDescription: string;
}

interface GenericWorkflowTask {
    code: string;
    name: string;
    taskType?: string;
    assignmentRole: string;
    assignmentTeamKey: string;
    dependsOnCode?: string;
}

interface GenericWorkflowStage {
    code: string;
    name: string;
    workstream: string;
    assignmentRole: string;
    assignmentTeamKey: string;
    description: string;
    reqApproval?: boolean;
    reqChecklist?: boolean;
    reqPhotos?: boolean;
    reqMaterials?: boolean;
    reqDocuments?: boolean;
    approvalRoles?: string[];
    checklistLabels?: string[];
    tasks: GenericWorkflowTask[];
}

export const PROJECT_TYPE_CATALOG: ProjectTypeCatalogEntry[] = [
    {
        name: 'SSD',
        description: 'Standard Service Delivery - FTTH installations',
        defaultPlanningSource: 'GIS',
        roleSummary: ['MANAGER', 'ENGINEER', 'AREA_MANAGER', 'QC_OFFICER'],
        workflowName: 'SSD Standard Workflow',
        workflowDescription: 'Standard workflow for FTTH/SSD service delivery projects',
    },
    {
        name: 'OPMC_SSD',
        description: 'OPMC-managed Standard Service Delivery',
        defaultPlanningSource: 'GIS',
        roleSummary: ['OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'QC_OFFICER'],
        workflowName: 'OPMC SSD Workflow',
        workflowDescription: 'OPMC-managed workflow for service delivery projects',
    },
    {
        name: 'CLUSTER_DEVELOPMENT',
        description: 'Greenfield/Brownfield cluster fiber development',
        defaultPlanningSource: 'GIS',
        roleSummary: ['MANAGER', 'ENGINEER', 'OSP_MANAGER', 'QC_OFFICER'],
        workflowName: 'Cluster Development Workflow',
        workflowDescription: 'Workflow for greenfield and brownfield cluster development',
    },
    {
        name: 'BUILDING_FIBER',
        description: 'Multi-dwelling building fiber rollout',
        defaultPlanningSource: 'CAD',
        roleSummary: ['MANAGER', 'ENGINEER', 'CIVIL_SUPERVISOR', 'QC_OFFICER'],
        workflowName: 'Building Fiber Workflow',
        workflowDescription: 'Workflow for multi-dwelling building fiber rollout',
    },
    {
        name: 'BUILDING_NETWORK',
        description: 'Building internal network cabling and structured network deployment',
        defaultPlanningSource: 'CAD',
        roleSummary: ['MANAGER', 'ENGINEER', 'CIVIL_SUPERVISOR', 'QC_OFFICER'],
        workflowName: 'Building Network Workflow',
        workflowDescription: 'Workflow for structured cabling and building network delivery',
    },
    {
        name: 'CCTV_SECURITY',
        description: 'CCTV, access-control and building security infrastructure',
        defaultPlanningSource: 'CAD',
        roleSummary: ['MANAGER', 'ENGINEER', 'CIVIL_SUPERVISOR', 'QC_OFFICER'],
        workflowName: 'CCTV Security Workflow',
        workflowDescription: 'Workflow for CCTV and related building security systems',
    },
    {
        name: 'PABX_TELEPHONY',
        description: 'PABX, voice, intercom and structured telephony systems',
        defaultPlanningSource: 'CAD',
        roleSummary: ['MANAGER', 'ENGINEER', 'OSP_ENGINEER', 'QC_OFFICER'],
        workflowName: 'PABX Telephony Workflow',
        workflowDescription: 'Workflow for PABX and building telephony deployments',
    },
    {
        name: 'NETWORK_INFRASTRUCTURE',
        description: 'LAN/WAN, Wi-Fi, network devices and enterprise connectivity',
        defaultPlanningSource: 'CAD',
        roleSummary: ['MANAGER', 'ENGINEER', 'OSP_ENGINEER', 'QC_OFFICER'],
        workflowName: 'Network Infrastructure Workflow',
        workflowDescription: 'Workflow for LAN/WAN and enterprise network infrastructure',
    },
    {
        name: 'DATA_CENTER_OPERATIONS',
        description: 'Data centre fit-out, migration, commissioning and operations readiness',
        defaultPlanningSource: 'MANUAL',
        roleSummary: ['MANAGER', 'SA_MANAGER', 'ENGINEER', 'QC_OFFICER'],
        workflowName: 'Data Center Operations Workflow',
        workflowDescription: 'Workflow for data centre delivery and operations readiness',
    },
    {
        name: 'RELATED_TELECOM',
        description: 'Related telecom infrastructure projects',
        defaultPlanningSource: 'CAD',
        roleSummary: ['MANAGER', 'ENGINEER', 'OSP_MANAGER', 'QC_OFFICER'],
        workflowName: 'Related Telecom Workflow',
        workflowDescription: 'Workflow for related telecom infrastructure projects',
    },
];

export function getProjectTypeCatalogEntry(name: string | null | undefined) {
    if (!name) return undefined;
    const normalized = name.trim().toUpperCase().replace(/\s+/g, '_');
    return PROJECT_TYPE_CATALOG.find((entry) => entry.name === normalized);
}

export function normalizeProjectTypeName(name: string) {
    return name.trim().toUpperCase().replace(/\s+/g, '_');
}

export const GENERIC_WORKFLOW_STAGES: GenericWorkflowStage[] = [
    {
        code: 'INITIATION',
        name: 'Project Initiation & Requirements',
        workstream: 'PLANNING',
        assignmentRole: 'MANAGER',
        assignmentTeamKey: 'PMO',
        description: 'Confirm scope, business need, stakeholders, delivery model and target dates.',
        reqApproval: true,
        approvalRoles: ['MANAGER', 'OSP_MANAGER'],
        tasks: [{ code: 'SCOPE_BASELINE', name: 'Baseline scope, stakeholders and delivery plan', assignmentRole: 'MANAGER', assignmentTeamKey: 'PMO' }],
    },
    {
        code: 'ASSESSMENT',
        name: 'Survey & Current-State Assessment',
        workstream: 'TECHNICAL',
        assignmentRole: 'ENGINEER',
        assignmentTeamKey: 'TECHNICAL',
        description: 'Capture site, asset, connectivity, safety and technical requirements. GIS is optional.',
        reqChecklist: true,
        reqPhotos: true,
        checklistLabels: ['Site/current-state assessment completed', 'Requirements and constraints recorded'],
        tasks: [{ code: 'TECHNICAL_ASSESSMENT', name: 'Complete technical assessment and requirements', assignmentRole: 'ENGINEER', assignmentTeamKey: 'TECHNICAL' }],
    },
    {
        code: 'DESIGN',
        name: 'Solution Design & Review',
        workstream: 'DESIGN',
        assignmentRole: 'ENGINEER',
        assignmentTeamKey: 'DESIGN',
        description: 'Prepare CAD, schematics, configuration design or equivalent technical package.',
        reqApproval: true,
        reqDocuments: true,
        approvalRoles: ['ENGINEER', 'AREA_MANAGER'],
        tasks: [{ code: 'SOLUTION_DESIGN', name: 'Prepare solution design package', assignmentRole: 'ENGINEER', assignmentTeamKey: 'DESIGN' }, { code: 'DESIGN_REVIEW', name: 'Review and approve design package', taskType: 'APPROVAL', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'DESIGN', dependsOnCode: 'SOLUTION_DESIGN' }],
    },
    {
        code: 'BOQ_BUDGET',
        name: 'BOQ & Budget Approval',
        workstream: 'COMMERCIAL',
        assignmentRole: 'MANAGER',
        assignmentTeamKey: 'PMO',
        description: 'Prepare or manually enter BOQ, budget and procurement requirements.',
        reqApproval: true,
        reqDocuments: true,
        approvalRoles: ['MANAGER', 'FINANCE_MANAGER'],
        tasks: [{ code: 'BOQ_BUDGET_PREP', name: 'Prepare BOQ and budget baseline', assignmentRole: 'MANAGER', assignmentTeamKey: 'PMO' }, { code: 'BOQ_BUDGET_APPROVAL', name: 'Review and approve BOQ and budget', taskType: 'APPROVAL', assignmentRole: 'FINANCE_MANAGER', assignmentTeamKey: 'FINANCE', dependsOnCode: 'BOQ_BUDGET_PREP' }],
    },
    {
        code: 'PROCUREMENT',
        name: 'Procurement & Material Readiness',
        workstream: 'SUPPLY',
        assignmentRole: 'PROCUREMENT_OFFICER',
        assignmentTeamKey: 'PROCUREMENT',
        description: 'Confirm stock, reservations, purchase requirements and delivery readiness.',
        reqMaterials: true,
        reqChecklist: true,
        checklistLabels: ['Material availability or procurement plan confirmed', 'Task/contractor allocation confirmed'],
        tasks: [{ code: 'MATERIAL_READINESS', name: 'Confirm material and procurement readiness', assignmentRole: 'PROCUREMENT_OFFICER', assignmentTeamKey: 'PROCUREMENT' }],
    },
    {
        code: 'IMPLEMENTATION',
        name: 'Implementation & Configuration',
        workstream: 'DELIVERY',
        assignmentRole: 'CIVIL_SUPERVISOR',
        assignmentTeamKey: 'DELIVERY',
        description: 'Execute child tasks, contractor work packages, installation or configuration.',
        reqChecklist: true,
        tasks: [{ code: 'DELIVERY_EXECUTION', name: 'Execute assigned work packages and record progress', assignmentRole: 'CIVIL_SUPERVISOR', assignmentTeamKey: 'DELIVERY' }],
    },
    {
        code: 'QA_COMMISSIONING',
        name: 'QA, Testing & Commissioning',
        workstream: 'QUALITY',
        assignmentRole: 'QC_OFFICER',
        assignmentTeamKey: 'QA_QC',
        description: 'Perform QA checks, tests, commissioning and defect closure.',
        reqApproval: true,
        reqChecklist: true,
        reqPhotos: true,
        approvalRoles: ['QC_OFFICER', 'AREA_MANAGER'],
        checklistLabels: ['Testing/commissioning evidence recorded', 'Open defects resolved or accepted'],
        tasks: [{ code: 'QA_COMMISSIONING', name: 'Complete QA and commissioning evidence', assignmentRole: 'QC_OFFICER', assignmentTeamKey: 'QA_QC' }],
    },
    {
        code: 'HANDOVER',
        name: 'Handover & As-Built Documentation',
        workstream: 'CLOSEOUT',
        assignmentRole: 'ENGINEER',
        assignmentTeamKey: 'AS_BUILT',
        description: 'Submit CAD, GIS where applicable, configuration records, warranties and handover pack.',
        reqApproval: true,
        reqDocuments: true,
        approvalRoles: ['ENGINEER', 'AREA_MANAGER'],
        tasks: [{ code: 'HANDOVER_PACKAGE', name: 'Prepare handover and as-built package', assignmentRole: 'ENGINEER', assignmentTeamKey: 'AS_BUILT' }, { code: 'HANDOVER_APPROVAL', name: 'Review and approve handover package', taskType: 'APPROVAL', assignmentRole: 'AREA_MANAGER', assignmentTeamKey: 'AS_BUILT', dependsOnCode: 'HANDOVER_PACKAGE' }],
    },
    {
        code: 'CLOSEOUT',
        name: 'Invoice Follow-up & Project Closure',
        workstream: 'CLOSURE',
        assignmentRole: 'INVOICE_MANAGER',
        assignmentTeamKey: 'PROJECT_FINANCE',
        description: 'Track contractor invoices, final acceptance, lessons learned and closure.',
        reqApproval: true,
        reqDocuments: true,
        approvalRoles: ['INVOICE_MANAGER', 'OSP_MANAGER'],
        tasks: [{ code: 'PROJECT_CLOSEOUT', name: 'Complete invoice follow-up and closure checklist', assignmentRole: 'INVOICE_MANAGER', assignmentTeamKey: 'PROJECT_FINANCE' }],
    },
];
