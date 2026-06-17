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
];

/**
 * Stage-to-tab mapping. Each stage name maps to the tabs that are relevant
 * for work being done in that stage.
 */
export const STAGE_TAB_MAPPING: Record<string, TabDefinition[]> = {
    // ===== Simple stage name aliases (matches DB stage names from simulation) =====
    'survey': [
        { value: 'survey', label: 'Survey', description: 'Site survey and field verification' },
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
        { value: 'documents', label: 'Documents', description: 'Material and procurement documents' },
    ],
    'installation': [
        { value: 'tasks', label: 'Tasks', description: 'Installation tasks' },
        { value: 'resources', label: 'Resources', description: 'Resource allocation' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor management' },
        { value: 'hse', label: 'HSE', description: 'Health, safety and environment' },
        { value: 'expenses', label: 'Expenses', description: 'Installation expenses' },
        { value: 'documents', label: 'Documents', description: 'Installation documents' },
    ],
    'otdr': [
        { value: 'otdr', label: 'OTDR', description: 'OTDR testing and results' },
        { value: 'qa', label: 'QA/QC', description: 'Quality control' },
        { value: 'documents', label: 'Documents', description: 'Test reports and documentation' },
    ],
    'qa': [
        { value: 'qa', label: 'QA/QC', description: 'Quality assurance and control' },
        { value: 'kpis', label: 'KPIs', description: 'Quality and performance KPIs' },
        { value: 'commissioning', label: 'Commissioning', description: 'Network commissioning' },
        { value: 'documents', label: 'Documents', description: 'QA reports and documents' },
    ],
    'closure': [
        { value: 'closure', label: 'Closure', description: 'Project closure and handover' },
        { value: 'assets', label: 'Assets', description: 'Asset registration with NOC' },
        { value: 'documents', label: 'Documents', description: 'Handover and as-built documents' },
        { value: 'kpis', label: 'KPIs', description: 'Project completion KPIs' },
        { value: 'finance', label: 'Finance', description: 'Final financial closeout' },
    ],

    // ===== SSD / General Stages =====
    'survey & feasibility': [
        { value: 'survey', label: 'Survey', description: 'Site survey and feasibility assessment' },
        { value: 'gis', label: 'GIS Route', description: 'GIS route planning and mapping' },
        { value: 'documents', label: 'Documents', description: 'Survey reports and drawings' },
        { value: 'risks', label: 'Risks', description: 'Risk assessment' },
    ],
    'feasibility study': [
        { value: 'survey', label: 'Survey', description: 'Feasibility survey' },
        { value: 'gis', label: 'GIS Route', description: 'Route feasibility mapping' },
        { value: 'documents', label: 'Documents', description: 'Feasibility reports' },
        { value: 'risks', label: 'Risks', description: 'Feasibility risk assessment' },
        { value: 'kpis', label: 'KPIs', description: 'Feasibility KPIs' },
    ],
    'survey & route planning': [
        { value: 'survey', label: 'Survey', description: 'Detailed field survey' },
        { value: 'gis', label: 'GIS Route', description: 'Route design and planning' },
        { value: 'documents', label: 'Documents', description: 'Survey and route documents' },
        { value: 'risks', label: 'Risks', description: 'Route risk assessment' },
    ],
    'building survey': [
        { value: 'survey', label: 'Survey', description: 'Building assessment survey' },
        { value: 'documents', label: 'Documents', description: 'Building survey documents' },
        { value: 'risks', label: 'Risks', description: 'Building risk assessment' },
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
    ],
    'civil works': [
        { value: 'tasks', label: 'Tasks', description: 'Civil works tasks' },
        { value: 'resources', label: 'Resources', description: 'Civil works resources' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor management' },
        { value: 'hse', label: 'HSE', description: 'Safety during civil works' },
        { value: 'expenses', label: 'Expenses', description: 'Civil works expenses' },
    ],
    'cabling & splicing': [
        { value: 'tasks', label: 'Tasks', description: 'Cabling tasks' },
        { value: 'resources', label: 'Resources', description: 'Splicing resources' },
        { value: 'contractor', label: 'Contractor', description: 'Splicing contractor' },
        { value: 'hse', label: 'HSE', description: 'Cabling safety' },
        { value: 'field-tasks', label: 'Field Tasks', description: 'Field splicing tasks' },
    ],
    'riser & horizontal cabling': [
        { value: 'tasks', label: 'Tasks', description: 'Cabling tasks' },
        { value: 'resources', label: 'Resources', description: 'Installation resources' },
        { value: 'contractor', label: 'Contractor', description: 'Contractor' },
        { value: 'hse', label: 'HSE', description: 'Installation safety' },
    ],
    'splicing & termination': [
        { value: 'tasks', label: 'Tasks', description: 'Splicing tasks' },
        { value: 'resources', label: 'Resources', description: 'Splicing resources' },
        { value: 'contractor', label: 'Contractor', description: 'Splicing contractor' },
    ],

    // ===== Testing Stages =====
    'testing & otdr': [
        { value: 'otdr', label: 'OTDR', description: 'OTDR testing and results' },
        { value: 'qa', label: 'QA/QC', description: 'Quality control' },
        { value: 'documents', label: 'Documents', description: 'Test reports' },
    ],
    'otdr testing': [
        { value: 'otdr', label: 'OTDR', description: 'Fiber testing' },
        { value: 'qa', label: 'QA/QC', description: 'Quality control' },
        { value: 'documents', label: 'Documents', description: 'Test reports' },
    ],
    'testing': [
        { value: 'otdr', label: 'OTDR', description: 'Fiber testing' },
        { value: 'qa', label: 'QA/QC', description: 'Quality verification' },
        { value: 'documents', label: 'Documents', description: 'Test results' },
    ],

    // ===== QA/QC Stages =====
    'qa/qc inspection': [
        { value: 'qa', label: 'QA/QC', description: 'Quality inspection' },
        { value: 'kpis', label: 'KPIs', description: 'Quality KPIs' },
        { value: 'documents', label: 'Documents', description: 'Inspection reports' },
        { value: 'commissioning', label: 'Commissioning', description: 'Network commissioning' },
    ],
    'qa/qc & commissioning': [
        { value: 'qa', label: 'QA/QC', description: 'Quality inspection' },
        { value: 'commissioning', label: 'Commissioning', description: 'Network commissioning' },
        { value: 'kpis', label: 'KPIs', description: 'Quality and commissioning KPIs' },
        { value: 'documents', label: 'Documents', description: 'QA/QC documents' },
    ],
    'qa/qc': [
        { value: 'qa', label: 'QA/QC', description: 'Quality inspection' },
        { value: 'kpis', label: 'KPIs', description: 'Quality KPIs' },
        { value: 'documents', label: 'Documents', description: 'QC documents' },
    ],

    // ===== Detailed Engineering =====
    'detailed engineering': [
        { value: 'survey', label: 'Survey', description: 'Engineering survey data' },
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
    ],
};

/**
 * Get the tabs that should be visible for a given stage name.
 * Falls back to a default set if no mapping exists.
 */
export function getTabsForStage(stageName: string | null | undefined): TabDefinition[] {
    if (!stageName) {
        return getDefaultTabs();
    }

    const key = stageName.toLowerCase().trim();
    const mapped = STAGE_TAB_MAPPING[key];

    if (mapped) {
        // Always include overview and workflow-pipeline
        return [...ALWAYS_VISIBLE_TABS, ...mapped];
    }

    // Fallback: return default tabs
    return getDefaultTabs();
}

/**
 * Get the default set of tabs when no stage-specific mapping exists
 */
export function getDefaultTabs(): TabDefinition[] {
    return [
        ...ALWAYS_VISIBLE_TABS,
        { value: 'permits', label: 'Permits' },
        { value: 'gis', label: 'GIS Route' },
        { value: 'survey', label: 'Survey' },
        { value: 'otdr', label: 'OTDR' },
        { value: 'hse', label: 'HSE' },
        { value: 'contractor-perf', label: 'Contractor Perf' },
        { value: 'evm', label: 'EVM' },
        { value: 'assets', label: 'Assets' },
        { value: 'variations', label: 'Variations' },
        { value: 'boq', label: 'BOQ & Material' },
        { value: 'materials', label: 'Material Issues' },
        { value: 'milestones', label: 'Milestones' },
        { value: 'expenses', label: 'Expenses' },
        { value: 'tasks', label: 'Tasks' },
        { value: 'resources', label: 'Resources' },
        { value: 'documents', label: 'Documents' },
        { value: 'approvals', label: 'Approvals' },
        { value: 'risks', label: 'Risks' },
        { value: 'qa', label: 'QA/QC' },
        { value: 'contractor', label: 'Contractor' },
        { value: 'commissioning', label: 'Commissioning' },
        { value: 'kpis', label: 'KPIs' },
        { value: 'procurement', label: 'Procurement' },
        { value: 'finance', label: 'Finance' },
        { value: 'closure', label: 'Closure' },
    ];
}