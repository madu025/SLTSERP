// ============================================================================
// WORKFLOW DEFINITIONS - Project Type to Workflow Template Mapping
// ============================================================================
// Defines standard OSP workflow templates for each project type
// ============================================================================

import {
  WorkflowDefinition,
  WorkflowStageDefinition,
  DetectedProjectType,
} from '@/types/gis';

/**
 * SSD Workflow Template
 * Stages: Survey, Permit, Material, Installation, OTDR, QA, Closure
 */
const SSD_WORKFLOW: WorkflowDefinition = {
  templateName: 'SSD_STANDARD',
  stages: [
    {
      name: 'Survey',
      sequence: 1,
      tasks: [
        'Route Verification',
        'Pole Verification',
        'GPS Capture',
        'Photo Collection',
        'Obstruction Assessment',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: false,
      reqOTDR: false,
      reqGPS: true,
    },
    {
      name: 'Permit',
      sequence: 2,
      tasks: [
        'Permit Submission',
        'Permit Approval',
        'Authority Follow-up',
        'Permit Fee Payment',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Material',
      sequence: 3,
      tasks: [
        'Material Requisition',
        'Material Issue',
        'Material Verification',
        'Cable Drum Inspection',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Installation',
      sequence: 4,
      tasks: [
        'Pole Installation',
        'Cable Laying',
        'FDP Installation',
        'Splicing',
        'Joint Closure',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: false,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'OTDR',
      sequence: 5,
      tasks: [
        'OTDR Testing',
        'Loss Analysis',
        'Pass/Fail Validation',
        'Trace File Upload',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: true,
      reqGPS: false,
    },
    {
      name: 'QA',
      sequence: 6,
      tasks: [
        'Quality Inspection',
        'NCR Resolution',
        'GPS Verification',
        'Photo Verification',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: true,
    },
    {
      name: 'Closure',
      sequence: 7,
      tasks: [
        'Document Compilation',
        'As-built Drawing',
        'Asset Transfer to NOC',
        'Project Handover',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
  ],
};

/**
 * Cluster Development Workflow Template
 * Stages: Feasibility, Survey, Permit, Engineering, Procurement, Civil, Splicing, OTDR, QA, Closure
 */
const CLUSTER_WORKFLOW: WorkflowDefinition = {
  templateName: 'CLUSTER_STANDARD',
  stages: [
    {
      name: 'Feasibility',
      sequence: 1,
      tasks: [
        'Site Visit',
        'Route Feasibility Study',
        'Pole Feasibility',
        'Cost Estimation',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Survey',
      sequence: 2,
      tasks: [
        'Route Survey',
        'Pole Marking',
        'GPS Survey',
        'Photo Documentation',
        'Traffic Assessment',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: false,
      reqOTDR: false,
      reqGPS: true,
    },
    {
      name: 'Permit',
      sequence: 3,
      tasks: [
        'Road Cutting Permit',
        'Wayleave Agreement',
        'Railway Crossing (if applicable)',
        'Municipal Approvals',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Engineering',
      sequence: 4,
      tasks: [
        'Detailed Design',
        'BOM Generation',
        'Cable Route Profile',
        'Splicing Schedule',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Procurement',
      sequence: 5,
      tasks: [
        'Material Indent',
        'Vendor Selection',
        'PO Placement',
        'Material Delivery',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Civil',
      sequence: 6,
      tasks: [
        'Pole Installation',
        'Trenching/HDD',
        'Duct Installation',
        'Chamber Installation',
        'Road Restoration',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: false,
      reqOTDR: false,
      reqGPS: true,
    },
    {
      name: 'Installation',
      sequence: 7,
      tasks: [
        'Cable Blowing/Pulling',
        'Fiber Routing',
        'FDP Mounting',
        'Splitter Installation',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: false,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Splicing',
      sequence: 8,
      tasks: [
        'Ribbon Splicing',
        'Individual Splicing',
        'Closure Management',
        'Pigtail Termination',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: false,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'OTDR Testing',
      sequence: 9,
      tasks: [
        'Pre-Installation OTDR',
        'Post-Installation OTDR',
        'Loss Budget Analysis',
        'Trace Archiving',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: true,
      reqGPS: false,
    },
    {
      name: 'QA',
      sequence: 10,
      tasks: [
        'Quality Audit',
        'NCR Close-out',
        'GPS Verification',
        'Photo Audit',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: true,
    },
    {
      name: 'Closure',
      sequence: 11,
      tasks: [
        'As-built Documentation',
        'Asset Register Update',
        'NOC Transfer',
        'Project Handover',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
  ],
};

/**
 * Building Fiber Workflow Template
 * Stages: Survey, Access, Materials, Installation, Testing, QA, Closure
 */
const BUILDING_FIBER_WORKFLOW: WorkflowDefinition = {
  templateName: 'BUILDING_FIBER_STANDARD',
  stages: [
    {
      name: 'Survey',
      sequence: 1,
      tasks: [
        'Building Survey',
        'Riser Route Survey',
        'Floor Plan Review',
        'Existing Cable Assessment',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Access',
      sequence: 2,
      tasks: [
        'Building Access Permission',
        'Riser Space Agreement',
        'Landlord Approval',
        'Tenant Notification',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Materials',
      sequence: 3,
      tasks: [
        'Material Requisition',
        'Cable Drum Inspection',
        'FDP Verification',
        'Splitter Verification',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Installation',
      sequence: 4,
      tasks: [
        'Riser Cable Installation',
        'FDP Mounting',
        'Splitter Installation',
        'Floor Distribution',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: false,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Testing',
      sequence: 5,
      tasks: [
        'OTDR Testing',
        'Power Meter Test',
        'Return Loss Test',
        'End-to-End Loss Verification',
      ],
      reqApproval: false,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: true,
      reqGPS: false,
    },
    {
      name: 'QA',
      sequence: 6,
      tasks: [
        'Installation Audit',
        'Labeling Verification',
        'Photo Verification',
        'NCR Resolution',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: true,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
    {
      name: 'Closure',
      sequence: 7,
      tasks: [
        'As-built Drawings',
        'Asset Registration',
        'NOC Transfer',
        'Building Handover',
      ],
      reqApproval: true,
      reqChecklist: true,
      reqPhotos: false,
      reqDocuments: true,
      reqOTDR: false,
      reqGPS: false,
    },
  ],
};

/**
 * Workflow Definition Registry
 * Maps project types to their workflow templates
 */
export const WORKFLOW_REGISTRY: Record<
  DetectedProjectType,
  WorkflowDefinition
> = {
  SSD: SSD_WORKFLOW,
  CLUSTER_DEVELOPMENT: CLUSTER_WORKFLOW,
  BUILDING_FIBER: BUILDING_FIBER_WORKFLOW,
  UNKNOWN: SSD_WORKFLOW, // Default to SSD for unknown types
};

/**
 * Get workflow definition for a project type
 */
export function getWorkflowForProjectType(
  projectType: DetectedProjectType
): WorkflowDefinition {
  return WORKFLOW_REGISTRY[projectType] || WORKFLOW_REGISTRY.UNKNOWN;
}
