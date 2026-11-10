/** Short workflow description shown in the Create Project dialog when the project type row has none. */
const HELP: Record<string, string> = {
    CUSTOMER_REQUEST: 'Customer request: survey, BOQ preparation and approval, implementation, PAT, as-built, then invoice submission and follow-up.',
    REHABILITATION_SHIFTING: 'Rehabilitation / shifting: survey, BOQ, implementation, PAT, as-built and invoicing.',
    MARKETING: 'Marketing project: survey, BOQ, implementation, PAT, as-built and invoicing.',
    CLUSTER_DEVELOPMENT: 'Cluster / apartment development: feasibility, route planning, permits, engineering, civil and cabling works, testing, handover and invoicing.',
    BUILDING_FIBER: 'Building fibre: design and CAD review, BOQ, implementation, PAT and as-built, then invoicing.',
    SSD: 'Survey, permit, material, installation, OTDR, QA and closure.',
};
const GENERIC = 'Initiation, survey and assessment, design, BOQ and budget approval, procurement, implementation, QA and commissioning, handover and invoice follow-up.';

export function projectTypeHelp(name: string): string {
    return HELP[name] ?? GENERIC;
}
