/**
 * Module Visibility Mapping
 * 
 * Maps each workflow stage to the tabs/modules that should be visible
 * during that stage of the project lifecycle.
 * 
 * Key: Stage name (lowercase, trimmed)
 * Value: Array of tab values that should be visible during this stage
 * 
 * "always" tabs are shown at all stages (overview, workflow-pipeline)
 */

export interface TabDefinition {
    value: string;
    label: string;
    icon?: string;
    description?: string;
}

export const ALWAYS_VISIBLE_TABS: TabDefinition[] = [
    { value: 'overview', label: 'Overview', description: 'Project summary and key metrics' },
    { value: 'workflow-pipeline', label: 'Workflow Pipeline', description: 'Stage gate control and workflow tracking' },
    { value: 'tasks', label: 'Tasks', description: 'Parent and child task planning and tracking' },
];

function uniqueTabs(tabs: TabDefinition[]): TabDefinition[] {
    return tabs.filter((tab, index, allTabs) => allTabs.findIndex(candidate => candidate.value === tab.value) === index);
}

/**
 * Stage-to-tab mapping. Each stage name maps to the tabs that are relevant
 * for work being done in that stage.
 */
export const STAGE_TAB_MAPPING: Record<string, TabDefinition[]> = {
    // ===== Cross-domain project workflow stages =====
    'project initiation & requirements': [
        { value: 'documents', label: 'Documents', description: 'Scope, requirements and approvals' },
        { value: 'approvals', label: 'Approvals', description: 'Project initiation approvals' },
        { value: 'risks', label: 'Risks', description: 'Initial project risk register' },
    ],
    'survey & current-state assessment': [
        { value: 'documents', label: 'Assessment Documents', description: 'Site/current-state evidence and requirements' },
        { value: 'risks', label: 'Risks', description: 'Assessment risks and constraints' },
    ],
    'solution design & review': [
        { value: 'documents', label: 'Design Documents', description: 'CAD, schematics and design evidence' },
        { value: 'approvals', label: 'Design Approval', description: 'Technical design review and approval' },
    ],
    'boq & budget approval': [
        { value: 'boq', label: 'BOQ & Material', description: 'Bill of quantities and material requirements' },
        { value: 'budget', label: 'Budget Tracking', description: 'Budget baseline and variance monitoring' },
        { value: 'approvals', label: 'BOQ Approval', description: 'Commercial and budget approvals' },
        { value: 'documents', label: 'Documents', description: 'BOQ and budget evidence' },
    ],
    'procurement & material readiness': [
        { value: 'procurement', label: 'Procurement', description: 'Procurement and purchasing' },
        { value: 'materials', label: 'Material Issues', description: 'Material readiness and issue tracking' },
        { value: 'documents', label: 'Documents', description: 'Supply and delivery evidence' },
    ],
    'implementation & configuration': [
        { value: 'tasks', label: 'Tasks', description: 'Child work packages and progress' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor assignments and performance' },
        { value: 'resources', label: 'Resources', description: 'Resource allocation' },
        { value: 'hse', label: 'HSE', description: 'Health, safety and environment' },
        { value: 'documents', label: 'Documents', description: 'Implementation evidence' },
    ],
    'qa, testing & commissioning': [
        { value: 'qa', label: 'QA/QC', description: 'Quality assurance and control' },
        { value: 'commissioning', label: 'Commissioning', description: 'Testing and commissioning evidence' },
        { value: 'pat', label: 'PAT', description: 'Pre-acceptance testing' },
        { value: 'documents', label: 'Documents', description: 'Test reports and evidence' },
    ],
    'handover & as-built documentation': [
        { value: 'as-built', label: 'As-Built Output', description: 'CAD, GIS where applicable, and handover outputs' },
        { value: 'assets', label: 'Assets', description: 'Asset registration and handover' },
        { value: 'approvals', label: 'Handover Approval', description: 'Final handover approval' },
        { value: 'documents', label: 'Documents', description: 'Warranties and handover pack' },
    ],
    'invoice follow-up & project closure': [
        { value: 'finance', label: 'Finance', description: 'Invoice follow-up and financial closeout' },
        { value: 'closure', label: 'Closure', description: 'Project closure and lessons learned' },
        { value: 'documents', label: 'Documents', description: 'Final closure evidence' },
    ],
    // ===== Simple stage name aliases (matches DB stage names from simulation) =====
    'survey': [
        { value: 'survey', label: 'Survey', description: 'Site survey and field verification' },
        { value: 'survey-approval', label: 'Survey Approval', description: '12-layer QGIS survey point approval workflow' },
        { value: 'gis', label: 'GIS Route', description: 'GIS route planning and mapping' },
        { value: 'documents', label: 'Documents', description: 'Survey reports and drawings' },
        { value: 'risks', label: 'Risks', description: 'Risk assessment' },
    ],
    'permit': [
        { value: 'permits', label: 'Permits', description: 'Permit and wayleave management' },
        { value: 'documents', label: 'Documents', description: 'Permit documentation' },
        { value: 'approvals', label: 'Approvals', description: 'Permit approvals' },
    ],
    'material': [
        { value: 'boq', label: 'BOQ & Material', description: 'Bill of quantities and material management' },
        { value: 'materials', label: 'Material Issues', description: 'Material issue tracking' },
        { value: 'procurement', label: 'Procurement', description: 'Procurement and purchasing' },
        { value: 'budget', label: 'Budget Tracking', description: 'Real-time cost vs budget monitoring' },
        { value: 'documents', label: 'Documents', description: 'Material and procurement documents' },
    ],
    'installation': [
        { value: 'tasks', label: 'Tasks', description: 'Installation tasks' },
        { value: 'resources', label: 'Resources', description: 'Resource allocation' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor management' },
        { value: 'hse', label: 'HSE', description: 'Health, safety and environment' },
        { value: 'expenses', label: 'Expenses', description: 'Installation expenses' },
        { value: 'gis', label: 'GIS Route', description: 'Field design changes' },
        { value: 'gis-audit', label: 'GIS Audit', description: 'GIS change history and audit trail' },
        { value: 'variations', label: 'Variations', description: 'Variation orders' },
        { value: 'change-requests', label: 'Change Requests', description: 'Scope and route change requests with approval workflow' },
        { value: 'budget', label: 'Budget Tracking', description: 'Real-time cost vs budget monitoring' },
        { value: 'boq', label: 'BOQ & Material', description: 'Recalculated BOQ' },
        { value: 'documents', label: 'Documents', description: 'Installation documents' },
    ],
    'otdr': [
        { value: 'otdr', label: 'OTDR', description: 'OTDR testing and results' },
        { value: 'qa', label: 'QA/QC', description: 'Quality control' },
        { value: 'gis', label: 'GIS Route', description: 'As-built route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'Final BOQ' },
        { value: 'documents', label: 'Documents', description: 'Test reports and documentation' },
    ],
    'qa': [
        { value: 'qa', label: 'QA/QC', description: 'Quality assurance and control' },
        { value: 'pat', label: 'PAT', description: 'Pre-Acceptance Testing sessions' },
        { value: 'kpis', label: 'KPIs', description: 'Quality and performance KPIs' },
        { value: 'commissioning', label: 'Commissioning', description: 'Network commissioning' },
        { value: 'gis', label: 'GIS Route', description: 'SLT requested route adjustments' },
        { value: 'gis-audit', label: 'GIS Audit', description: 'GIS change history and audit trail' },
        { value: 'as-built', label: 'As-Built Export', description: 'QGIS, CAD and comparison exports' },
        { value: 'boq', label: 'BOQ & Material', description: 'SLT requested BOQ adjustments' },
        { value: 'variations', label: 'Variations', description: 'SLT requested variations' },
        { value: 'change-requests', label: 'Change Requests', description: 'Scope and route change requests' },
        { value: 'budget', label: 'Budget Tracking', description: 'Real-time cost vs budget monitoring' },
        { value: 'documents', label: 'Documents', description: 'QA reports and documents' },
    ],
    'closure': [
        { value: 'closure', label: 'Closure', description: 'Project closure and handover' },
        { value: 'assets', label: 'Assets', description: 'Asset registration with NOC' },
        { value: 'as-built', label: 'As-Built Export', description: 'QGIS, CAD and comparison exports' },
        { value: 'gis-audit', label: 'GIS Audit', description: 'Complete GIS change history' },
        { value: 'budget', label: 'Budget Tracking', description: 'Final budget vs actual reconciliation' },
        { value: 'change-requests', label: 'Change Requests', description: 'All approved change requests' },
        { value: 'documents', label: 'Documents', description: 'Handover and as-built documents' },
        { value: 'kpis', label: 'KPIs', description: 'Project completion KPIs' },
        { value: 'finance', label: 'Finance', description: 'Final financial closeout' },
    ],

    // ===== SSD / General Stages =====
    'survey & feasibility': [
        { value: 'survey', label: 'Survey', description: 'Site survey and feasibility assessment' },
        { value: 'survey-approval', label: 'Survey Approval', description: 'Map-based QField data approval workflow' },
        { value: 'gis', label: 'GIS Route', description: 'GIS route planning and mapping' },
        { value: 'documents', label: 'Documents', description: 'Survey reports and drawings' },
        { value: 'risks', label: 'Risks', description: 'Risk assessment' },
    ],
    'survey plan & field survey': [
        { value: 'survey', label: 'Survey Plan', description: 'Survey planning and field/mobile survey' },
        { value: 'survey-approval', label: 'Survey Approval', description: 'Survey evidence and approval' },
        { value: 'documents', label: 'Survey Documents', description: 'Survey reports and supporting files' },
        { value: 'risks', label: 'Risks', description: 'Survey risk assessment' },
    ],
    'feasibility study': [
        { value: 'survey', label: 'Survey', description: 'Feasibility survey' },
        { value: 'survey-approval', label: 'Survey Approval', description: 'Map-based QField data approval workflow' },
        { value: 'gis', label: 'GIS Route', description: 'Route feasibility mapping' },
        { value: 'documents', label: 'Documents', description: 'Feasibility reports' },
        { value: 'risks', label: 'Risks', description: 'Feasibility risk assessment' },
        { value: 'kpis', label: 'KPIs', description: 'Feasibility KPIs' },
    ],
    'survey & route planning': [
        { value: 'survey', label: 'Survey', description: 'Detailed field survey' },
        { value: 'survey-approval', label: 'Survey Approval', description: 'Map-based QField data approval workflow' },
        { value: 'gis', label: 'GIS Route', description: 'Route design and planning' },
        { value: 'documents', label: 'Documents', description: 'Survey and route documents' },
        { value: 'risks', label: 'Risks', description: 'Route risk assessment' },
    ],
    'building survey': [
        { value: 'survey', label: 'Survey', description: 'Building assessment survey' },
        { value: 'documents', label: 'Documents', description: 'Building survey documents' },
        { value: 'risks', label: 'Risks', description: 'Building risk assessment' },
    ],
    'cad drawing & design': [
        { value: 'documents', label: 'CAD Drawings', description: 'Drawing upload, revision and approval' },
        { value: 'approvals', label: 'Drawing Approval', description: 'Technical drawing approval or rejection' },
        { value: 'tasks', label: 'Design Tasks', description: 'Design review and correction tasks' },
    ],
    'cad drawing upload': [
        { value: 'documents', label: 'CAD Drawings', description: 'Drawing upload, revision and approval' },
        { value: 'approvals', label: 'Drawing Approval', description: 'Technical drawing approval or rejection' },
        { value: 'tasks', label: 'Design Tasks', description: 'Design review and correction tasks' },
    ],
    'cad review & approval': [
        { value: 'documents', label: 'CAD Drawings', description: 'Drawing upload, revision and approval' },
        { value: 'approvals', label: 'Drawing Approval', description: 'Technical drawing approval or rejection' },
        { value: 'tasks', label: 'Design Tasks', description: 'Design review and correction tasks' },
    ],
    'boq preparation': [
        { value: 'boq', label: 'BOQ & Material', description: 'BOQ linked to task and contractor scope' },
        { value: 'tasks', label: 'BOQ Tasks', description: 'Child task and quantity planning' },
        { value: 'contractor', label: 'Contractor Scope', description: 'Contractor-wise work package allocation' },
    ],
    'boq approval': [
        { value: 'boq', label: 'BOQ & Material', description: 'Technical and commercial BOQ approval' },
        { value: 'approvals', label: 'BOQ Approval', description: 'Approval or rejection with audit trail' },
    ],
    'child task & contractor allocation': [
        { value: 'tasks', label: 'Child Tasks', description: 'Split approved scope into executable child tasks' },
        { value: 'contractor', label: 'Contractors', description: 'Assign one or more contractors by work package' },
        { value: 'boq', label: 'BOQ & Material', description: 'Link BOQ quantities to tasks and contractors' },
        { value: 'documents', label: 'Documents', description: 'Scope and allocation records' },
    ],
    'implementation': [
        { value: 'tasks', label: 'Tasks', description: 'Contractor-wise implementation tasks' },
        { value: 'contractor', label: 'Contractors', description: 'Contractor scope and performance' },
        { value: 'documents', label: 'Documents', description: 'Implementation evidence' },
        { value: 'risks', label: 'Risks', description: 'Implementation risk tracking' },
    ],
    'pat': [
        { value: 'pat', label: 'PAT', description: 'Pre-acceptance testing and corrections' },
        { value: 'qa', label: 'QA/QC', description: 'Quality review and acceptance' },
        { value: 'documents', label: 'Documents', description: 'PAT reports and evidence' },
    ],
    'in-house pat': [
        { value: 'pat', label: 'In-house PAT', description: 'Internal pre-acceptance testing and corrections' },
        { value: 'qa', label: 'QA/QC', description: 'Internal quality review' },
        { value: 'documents', label: 'PAT Documents', description: 'Internal PAT reports and evidence' },
    ],
    'slt pat': [
        { value: 'pat', label: 'SLT PAT', description: 'SLT acceptance testing and final result' },
        { value: 'qa', label: 'QA/QC', description: 'SLT quality acceptance review' },
        { value: 'documents', label: 'PAT Documents', description: 'SLT PAT reports and evidence' },
    ],
    'qgis or cad as-built': [
        { value: 'as-built', label: 'As-Built', description: 'QGIS or CAD as-built submission' },
        { value: 'documents', label: 'Documents', description: 'As-built files and revisions' },
        { value: 'approvals', label: 'As-Built Approval', description: 'As-built technical approval' },
    ],
    'as-built (gis + cad or cad only)': [
        { value: 'as-built', label: 'As-Built', description: 'GIS plus CAD, or CAD-only as-built submission' },
        { value: 'documents', label: 'As-Built Documents', description: 'As-built files and revisions' },
        { value: 'approvals', label: 'As-Built Approval', description: 'As-built technical approval' },
    ],
    'invoice submission': [
        { value: 'finance', label: 'Invoices', description: 'Contractor-specific invoice submission' },
        { value: 'documents', label: 'Invoice Documents', description: 'Invoice support documents' },
        { value: 'tasks', label: 'Task Completion', description: 'Verify invoices against completed tasks' },
    ],
    'invoice follow-up': [
        { value: 'finance', label: 'Invoice Follow-up', description: 'Track review and payment follow-up' },
        { value: 'contractor', label: 'Contractors', description: 'Contractor-wise payment status' },
        { value: 'documents', label: 'Invoice Documents', description: 'Follow-up records and correspondence' },
    ],
    'invoice & follow-up': [
        { value: 'finance', label: 'Invoices', description: 'Contractor-wise invoice submission' },
        { value: 'approvals', label: 'Invoice Approval', description: 'Invoice review and approval' },
        { value: 'documents', label: 'Documents', description: 'Invoice support documents' },
    ],
    'invoice completed & closure': [
        { value: 'finance', label: 'Invoice Completion', description: 'Payment follow-up and completion' },
        { value: 'closure', label: 'Closure', description: 'Project financial and technical closeout' },
        { value: 'documents', label: 'Documents', description: 'Final closure documents' },
    ],

    // ===== Permit Stages =====
    'permit acquisition': [
        { value: 'permits', label: 'Permits', description: 'Permit and wayleave management' },
        { value: 'documents', label: 'Documents', description: 'Permit documentation' },
        { value: 'approvals', label: 'Approvals', description: 'Permit approvals' },
    ],
    'permit management': [
        { value: 'permits', label: 'Permits', description: 'Permit management' },
        { value: 'documents', label: 'Documents', description: 'Permit documents' },
        { value: 'approvals', label: 'Approvals', description: 'Permit approvals' },
    ],
    'permit & access': [
        { value: 'permits', label: 'Permits', description: 'Building access permits' },
        { value: 'documents', label: 'Documents', description: 'Access agreements' },
        { value: 'approvals', label: 'Approvals', description: 'Access approvals' },
    ],

    // ===== Material Stages =====
    'material issuance': [
        { value: 'boq', label: 'BOQ & Material', description: 'Bill of quantities' },
        { value: 'materials', label: 'Material Issues', description: 'Material issue tracking' },
        { value: 'procurement', label: 'Procurement', description: 'Procurement management' },
        { value: 'documents', label: 'Documents', description: 'Material documents' },
    ],
    'material procurement': [
        { value: 'boq', label: 'BOQ & Material', description: 'Bill of quantities' },
        { value: 'materials', label: 'Material Issues', description: 'Material management' },
        { value: 'procurement', label: 'Procurement', description: 'Procurement and purchasing' },
        { value: 'finance', label: 'Finance', description: 'Procurement finance' },
        { value: 'documents', label: 'Documents', description: 'Procurement documents' },
    ],

    // ===== Installation Stages =====
    'installation & cabling': [
        { value: 'tasks', label: 'Tasks', description: 'Installation tasks' },
        { value: 'resources', label: 'Resources', description: 'Resource allocation' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor management' },
        { value: 'hse', label: 'HSE', description: 'Health, safety and environment' },
        { value: 'field-tasks', label: 'Field Tasks', description: 'Field mobile tasks' },
        { value: 'expenses', label: 'Expenses', description: 'Installation expenses' },
        { value: 'gis', label: 'GIS Route', description: 'Field design changes' },
        { value: 'variations', label: 'Variations', description: 'Variation orders' },
        { value: 'boq', label: 'BOQ & Material', description: 'Recalculated BOQ' },
    ],
    'civil works': [
        { value: 'tasks', label: 'Tasks', description: 'Civil works tasks' },
        { value: 'resources', label: 'Resources', description: 'Civil works resources' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor management' },
        { value: 'hse', label: 'HSE', description: 'Safety during civil works' },
        { value: 'expenses', label: 'Expenses', description: 'Civil works expenses' },
        { value: 'gis', label: 'GIS Route', description: 'Civil works route modifications' },
        { value: 'variations', label: 'Variations', description: 'Civil variations' },
        { value: 'boq', label: 'BOQ & Material', description: 'Civil BOQ recalculations' },
    ],
    'cabling & splicing': [
        { value: 'tasks', label: 'Tasks', description: 'Cabling tasks' },
        { value: 'resources', label: 'Resources', description: 'Splicing resources' },
        { value: 'contractor', label: 'Contractor', description: 'Splicing contractor' },
        { value: 'hse', label: 'HSE', description: 'Cabling safety' },
        { value: 'field-tasks', label: 'Field Tasks', description: 'Field splicing tasks' },
        { value: 'gis', label: 'GIS Route', description: 'Cabling route changes' },
        { value: 'variations', label: 'Variations', description: 'Splicing variations' },
        { value: 'boq', label: 'BOQ & Material', description: 'Splicing BOQ update' },
    ],
    'riser & horizontal cabling': [
        { value: 'tasks', label: 'Tasks', description: 'Cabling tasks' },
        { value: 'resources', label: 'Resources', description: 'Installation resources' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor' },
        { value: 'hse', label: 'HSE', description: 'Installation safety' },
        { value: 'gis', label: 'GIS Route', description: 'Riser route adjustments' },
        { value: 'variations', label: 'Variations', description: 'Riser variations' },
        { value: 'boq', label: 'BOQ & Material', description: 'Riser BOQ update' },
    ],
    'splicing & termination': [
        { value: 'tasks', label: 'Tasks', description: 'Splicing tasks' },
        { value: 'resources', label: 'Resources', description: 'Splicing resources' },
        { value: 'contractor', label: 'Contractor', description: 'Splicing contractor' },
        { value: 'gis', label: 'GIS Route', description: 'Termination route changes' },
        { value: 'variations', label: 'Variations', description: 'Termination variations' },
        { value: 'boq', label: 'BOQ & Material', description: 'Termination BOQ recalculations' },
    ],

    // ===== Testing Stages =====
    'testing & otdr': [
        { value: 'otdr', label: 'OTDR', description: 'OTDR testing and results' },
        { value: 'qa', label: 'QA/QC', description: 'Quality control' },
        { value: 'gis', label: 'GIS Route', description: 'OTDR route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'Final BOQ' },
        { value: 'documents', label: 'Documents', description: 'Test reports' },
    ],
    'otdr testing': [
        { value: 'otdr', label: 'OTDR', description: 'Fiber testing' },
        { value: 'qa', label: 'QA/QC', description: 'Quality control' },
        { value: 'gis', label: 'GIS Route', description: 'OTDR route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'Final BOQ' },
        { value: 'documents', label: 'Documents', description: 'Test reports' },
    ],
    'testing': [
        { value: 'otdr', label: 'OTDR', description: 'Fiber testing' },
        { value: 'qa', label: 'QA/QC', description: 'Quality verification' },
        { value: 'gis', label: 'GIS Route', description: 'Testing route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'Final BOQ' },
        { value: 'documents', label: 'Documents', description: 'Test results' },
    ],
    'testing & qa/qc': [
        { value: 'otdr', label: 'OTDR', description: 'OTDR testing and results' },
        { value: 'qa', label: 'QA/QC', description: 'Quality control' },
        { value: 'commissioning', label: 'Commissioning', description: 'Network commissioning' },
        { value: 'gis', label: 'GIS Route', description: 'Route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'Final BOQ check' },
        { value: 'documents', label: 'Documents', description: 'Test & QA reports' },
    ],

    // ===== QA/QC Stages =====
    'qa/qc inspection': [
        { value: 'qa', label: 'QA/QC', description: 'Quality inspection' },
        { value: 'kpis', label: 'KPIs', description: 'Quality KPIs' },
        { value: 'commissioning', label: 'Commissioning', description: 'Network commissioning' },
        { value: 'gis', label: 'GIS Route', description: 'Inspection route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'Inspection BOQ check' },
        { value: 'variations', label: 'Variations', description: 'Inspection variations' },
        { value: 'documents', label: 'Documents', description: 'Inspection reports' },
    ],
    'qa/qc & commissioning': [
        { value: 'qa', label: 'QA/QC', description: 'Quality inspection' },
        { value: 'commissioning', label: 'Commissioning', description: 'Network commissioning' },
        { value: 'kpis', label: 'KPIs', description: 'Quality and commissioning KPIs' },
        { value: 'gis', label: 'GIS Route', description: 'Commissioning route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'Commissioning BOQ check' },
        { value: 'variations', label: 'Variations', description: 'Commissioning variations' },
        { value: 'documents', label: 'Documents', description: 'QA/QC documents' },
    ],
    'qa/qc': [
        { value: 'qa', label: 'QA/QC', description: 'Quality inspection' },
        { value: 'kpis', label: 'KPIs', description: 'Quality KPIs' },
        { value: 'gis', label: 'GIS Route', description: 'QA route verification' },
        { value: 'boq', label: 'BOQ & Material', description: 'QA BOQ check' },
        { value: 'variations', label: 'Variations', description: 'QA variations' },
        { value: 'documents', label: 'Documents', description: 'QC documents' },
    ],

    // ===== Detailed Engineering =====
    'detailed engineering': [
        { value: 'survey', label: 'Survey', description: 'Engineering survey data' },
        { value: 'survey-approval', label: 'Survey Approval', description: 'Map-based QField data approval workflow' },
        { value: 'gis', label: 'GIS Route', description: 'Detailed GIS design' },
        { value: 'boq', label: 'BOQ & Material', description: 'Engineering BOQ' },
        { value: 'documents', label: 'Documents', description: 'Engineering drawings' },
        { value: 'approvals', label: 'Approvals', description: 'Engineering approvals' },
    ],

    // ===== Handover / Closure Stages =====
    'handover & closure': [
        { value: 'closure', label: 'Closure', description: 'Project closure' },
        { value: 'assets', label: 'Assets', description: 'Asset registration' },
        { value: 'documents', label: 'Documents', description: 'Handover documents' },
        { value: 'commissioning', label: 'Commissioning', description: 'Final commissioning' },
        { value: 'kpis', label: 'KPIs', description: 'Project KPIs' },
        { value: 'finance', label: 'Finance', description: 'Final financials' },
    ],
    'handover & asset registration': [
        { value: 'closure', label: 'Closure', description: 'Project closure' },
        { value: 'assets', label: 'Assets', description: 'Asset registration with NOC' },
        { value: 'documents', label: 'Documents', description: 'Handover documents' },
        { value: 'commissioning', label: 'Commissioning', description: 'Final commissioning' },
        { value: 'kpis', label: 'KPIs', description: 'Project KPIs' },
        { value: 'finance', label: 'Finance', description: 'Final financials' },
        { value: 'evm', label: 'EVM', description: 'Earned value analysis' },
    ],
    'handover': [
        { value: 'closure', label: 'Closure', description: 'Building handover' },
        { value: 'assets', label: 'Assets', description: 'Asset registration' },
        { value: 'documents', label: 'Documents', description: 'As-built documents' },
        { value: 'kpis', label: 'KPIs', description: 'Project KPIs' },
    ],

    // ===== General / Always-relevant tabs =====
    'always': [
        { value: 'overview', label: 'Overview' },
        { value: 'workflow-pipeline', label: 'Workflow Pipeline' },
        { value: 'documents', label: 'Documents' },
        { value: 'risks', label: 'Risks' },
        { value: 'contractor', label: 'Contractor' },
        { value: 'contractor-perf', label: 'Contractor Perf' },
        { value: 'kpis', label: 'KPIs' },
        { value: 'ai-forecasting', label: 'AI Forecasting' },
    ],
};

const STAGE_NAME_ALIASES: Record<string, string> = {
    // Map simplified template stage names -> keys present in STAGE_TAB_MAPPING
    feasibility: 'feasibility study',
    permit: 'permit acquisition',
    engineering: 'detailed engineering',
    procurement: 'material procurement',
    civil: 'civil works',
    splicing: 'cabling & splicing',
    otdr: 'otdr',
    
    // Database lifecycle statuses mapped to appropriate generic stages
    planning: 'survey',
    survey_in_progress: 'survey',
    survey_complete: 'survey',
    boq_pending: 'material',
    boq_approved: 'material',
    material_requested: 'material',
    material_issued: 'material',
    installation_in_progress: 'installation',
    installation_complete: 'installation',
    pre_pat_pending: 'qa',
    pre_pat_in_progress: 'qa',
    pre_pat_passed: 'qa',
    slt_pat_pending: 'qa',
    slt_pat_in_progress: 'qa',
    slt_pat_passed: 'qa',
    completed: 'closure',

    // New database status mappings
    approved: 'material',
    in_progress: 'installation',
    on_hold: 'installation',
    cancelled: 'closure'
};

/**
 * Get the tabs that should be visible for a given stage name.
 * Falls back to a default set if no mapping exists.
 */
function filterTabsForProjectCapabilities(
    tabs: TabDefinition[],
    planningSource?: string | null,
    projectTypeName?: string | null,
) {
    const source = planningSource?.toUpperCase();
    const spatialTabs = new Set(['gis', 'survey', 'survey-approval', 'gis-audit']);
    const fiberTypes = new Set(['SSD', 'OPMC_SSD', 'CLUSTER_DEVELOPMENT', 'BUILDING_FIBER']);
    const isFiberProject = !!projectTypeName && fiberTypes.has(projectTypeName.toUpperCase());

    return tabs.filter((tab) => {
        if (source !== 'GIS' && spatialTabs.has(tab.value)) return false;
        // OTDR is a fiber acceptance instrument workflow, not a generic
        // building/network/data-centre project capability.
        if (!isFiberProject && tab.value === 'otdr') return false;
        return true;
    });
}

export function getTabsForStage(
    stageName: string | null | undefined,
    planningSource?: string | null,
    projectTypeName?: string | null,
): TabDefinition[] {
    if (!stageName) {
        return getDefaultTabs(planningSource, projectTypeName);
    }

    const key = stageName.toLowerCase().trim();
    const aliasedKey = STAGE_NAME_ALIASES[key] ?? key;
    const mapped = STAGE_TAB_MAPPING[aliasedKey];

    if (mapped) {
        const sourceAware = filterTabsForProjectCapabilities(mapped, planningSource, projectTypeName);
        // Always include overview and workflow-pipeline
        return uniqueTabs([...ALWAYS_VISIBLE_TABS, ...sourceAware]);
    }

    // Fallback: return default tabs
    return getDefaultTabs(planningSource, projectTypeName);
}

/**
 * Get the default set of tabs when no stage-specific mapping exists
 */
export function getDefaultTabs(planningSource?: string | null, projectTypeName?: string | null): TabDefinition[] {
    return uniqueTabs(filterTabsForProjectCapabilities([
        ...ALWAYS_VISIBLE_TABS,
        { value: 'gis', label: 'GIS Route', description: 'GIS route planning and mapping' },
        { value: 'documents', label: 'Documents', description: 'Project files and documentation' },
        { value: 'guide', label: 'Guide', description: 'Project module guide' }
    ], planningSource, projectTypeName));
}
