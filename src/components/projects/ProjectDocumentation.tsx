"use client";

import React, { useState } from 'react';
import {
    BookOpen, Search, ChevronDown, ChevronRight,
    FileText, ListChecks, ClipboardList, GanttChart,
    Calculator, Package, DollarSign, Users,
    FileCheck, Shield, Activity, BarChart3,
    MapPin, HardHat, AlertTriangle, Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Documentation Data ─────────────────────────────────────────────
interface DocSection {
    id: string;
    icon: React.ReactNode;
    title: string;
    content: string;
    subsections: DocSubSection[];
}

interface DocSubSection {
    id: string;
    title: string;
    steps: string[];
    notes?: string;
}

const DOCUMENTATION: DocSection[] = [
    {
        id: 'getting-started',
        icon: <BookOpen className="w-5 h-5" />,
        title: 'Getting Started',
        content: 'This guide walks you through the complete Project Management workflow in the SLT SERP system. Each section explains what a feature does and how to use it step by step.',
        subsections: [
            {
                id: 'gs-overview',
                title: 'System Overview',
                steps: [
                    'SLT SERP (Service & Resource Planning) is a comprehensive project management system for Sri Lanka Telecom\'s OSP (Outside Plant) projects.',
                    'Projects are organized by type: SSD, OPMC_SSD, CLUSTER_DEVELOPMENT, BUILDING_FIBER, BUILDING_NETWORK, and RELATED_TELECOM.',
                    'Each project progresses through workflow stages controlled by Stage Gates (checkpoints). Different tabs/modules become available depending on the current stage.',
                    'The system covers the full project lifecycle: Survey → Design → Permits → Procurement → Installation → Testing → QA/QC → Handover → Closure.'
                ]
            },
            {
                id: 'gs-access',
                title: 'Accessing the Project Module',
                steps: [
                    'Log in to the SLT SERP system using your credentials.',
                    'From the sidebar menu, click on "Projects" to view the Projects List.',
                    'The Projects List shows all projects with their status, progress, budget, and key metrics.',
                    'Click the "View" button on any project to open its detailed view page.'
                ]
            },
            {
                id: 'gs-create',
                title: 'Creating a New Project',
                steps: [
                    'On the Projects List page, click the "New Project" button (top right corner).',
                    'Fill in the dialog form with the required details:',
                    '  • Project Code - Unique identifier (e.g., PRJ-2026-001)',
                    '  • Project Type (Workflow) - Select the workflow template (SSD, OPMC_SSD, etc.)',
                    '  • Project Name - Full project name',
                    '  • Description - Brief project description',
                    '  • Location - Physical location of the project',
                    '  • OSP Type - Type of OSP work (FTTH, Copper, Fiber, etc.)',
                    '  • Budget (LKR) - Total project budget',
                    '  • Start Date / End Date - Project timeline',
                    'Click "Create Project" to save. The system automatically creates a workflow instance.',
                    'You will be redirected to the project detail page where you can manage all aspects.'
                ]
            }
        ]
    },
    {
        id: 'overview-dashboard',
        icon: <Activity className="w-5 h-5" />,
        title: 'Overview Dashboard',
        content: 'The Overview tab is the first thing you see when opening a project. It provides a high-level summary of the project status, progress, and key metrics.',
        subsections: [
            {
                id: 'ov-summary',
                title: 'Project Summary',
                steps: [
                    'Top bar shows: Project Name, Code, Status, and Workflow Type.',
                    'Team Info section displays: Area Manager, Contractor, and Timeline.',
                    'Current Stage indicator shows which workflow stage the project is in.',
                    'The progress bar shows overall project completion percentage.'
                ]
            },
            {
                id: 'ov-metrics',
                title: 'Key Metrics',
                steps: [
                    'Budget vs Actual Cost comparison - shows if project is within budget.',
                    'BOQ Item Count - total number of bill of quantity items.',
                    'Milestone completion status.',
                    'Expense tracking summary.',
                    'Each metric card shows a visual indicator (green = on track, yellow = warning, red = over budget).'
                ]
            },
            {
                id: 'ov-quick',
                title: 'Quick Actions',
                steps: [
                    'Edit Details - Update project information (name, dates, budget).',
                    'Navigate to any module using the tab bar below the header.',
                    'Use the Workflow Pipeline tab to view and manage stage gates.'
                ]
            }
        ]
    },
    {
        id: 'workflow-pipeline',
        icon: <GanttChart className="w-5 h-5" />,
        title: 'Workflow Pipeline',
        content: 'The Workflow Pipeline shows the project lifecycle stages and allows you to control stage transitions through Stage Gates (approval checkpoints).',
        subsections: [
            {
                id: 'wp-understand',
                title: 'Understanding Stages',
                steps: [
                    'Each project type has a predefined workflow with stages (e.g., Survey, Design, Permits, etc.).',
                    'Stages appear as cards in a pipeline view, arranged in order.',
                    'Each stage shows: name, status (PENDING, IN_PROGRESS, COMPLETED, REJECTED), and assigned users.',
                    'Only one stage is active (IN_PROGRESS) at a time.'
                ]
            },
            {
                id: 'wp-stage-gate',
                title: 'Stage Gate Approvals',
                steps: [
                    'When work in a stage is complete, click "Submit for Gate Approval".',
                    'The assigned approver reviews the stage completion.',
                    'If approved: The stage status changes to COMPLETED, and the next stage becomes IN_PROGRESS.',
                    'New tabs/modules become available based on the current stage.',
                    'If rejected: The stage stays IN_PROGRESS. Review feedback and make necessary changes before resubmitting.'
                ]
            },
            {
                id: 'wp-tasks',
                title: 'Stage Tasks',
                steps: [
                    'Each stage can have multiple completion tasks defined.',
                    'Check off tasks as they are completed.',
                    'All required tasks must be completed before the stage gate can be approved.',
                    'Task completion progress is shown on each stage card.'
                ]
            }
        ]
    },
    {
        id: 'boq',
        icon: <Calculator className="w-5 h-5" />,
        title: 'BOQ & Material',
        content: 'The Bill of Quantities (BOQ) module manages all material items, quantities, rates, and costs for the project. Items are selected from the centralized Inventory/Material database.',
        subsections: [
            {
                id: 'boq-add',
                title: 'Adding BOQ Items',
                steps: [
                    'Go to the "BOQ & Material" tab.',
                    'Click "Add Item" button to open the Add Item dialog.',
                    'Use the "Search Inventory Item" dropdown to search and select items from the inventory database.',
                    '  • Type to filter items by code, name, or description.',
                    '  • Select an item - it will auto-fill: Item Code, Description, Unit, Category, and Unit Rate.',
                    'Adjust quantity and other fields as needed.',
                    'Click "Add" to save the item to the BOQ.',
                    'You can edit or delete items using the action buttons in the table.'
                ]
            },
            {
                id: 'boq-view',
                title: 'Viewing BOQ Summary',
                steps: [
                    'The BOQ table shows: Item Code, Description, Unit, Quantity, Unit Rate, and Total Cost.',
                    'The total estimated cost is displayed at the bottom of the table.',
                    'BOQ data is used for procurement planning and budget tracking.',
                    'Items with materialId are linked to the inventory system for stock tracking.'
                ]
            }
        ]
    },
    {
        id: 'procurement',
        icon: <Package className="w-5 h-5" />,
        title: 'Procurement',
        content: 'The Procurement module manages purchase requisitions (PR) and purchase orders (PO). Items are selected from the Inventory database, ensuring consistency with the BOQ.',
        subsections: [
            {
                id: 'pr-create',
                title: 'Creating a Purchase Requisition (PR)',
                steps: [
                    'Go to the "Procurement" tab.',
                    'Under the "Requisitions" section, click "New Requisition".',
                    'Enter Requisition Title, Priority (High/Medium/Low), and Type.',
                    'Add items by clicking "Add Item" - use the Search Inventory Item dropdown to select items.',
                    '  • The dropdown shows item code, name, unit, and category.',
                    '  • Auto-fills: item code, description, and estimated price.',
                    'Enter quantities and review estimated prices.',
                    'Click "Submit" to save the requisition.',
                    'Requisitions go through an approval workflow before becoming purchase orders.'
                ]
            },
            {
                id: 'po-create',
                title: 'Creating a Purchase Order (PO)',
                steps: [
                    'Under the "Purchase Orders" section, click "New Purchase Order".',
                    'Select a Vendor/Supplier.',
                    'Add PO items using the same Search Inventory Item dropdown.',
                    'Enter quantities, unit prices, and delivery dates.',
                    'The system calculates the total order value.',
                    'Click "Create PO" to generate the purchase order.',
                    'POs can be tracked for delivery and payment status.'
                ]
            },
            {
                id: 'pr-po-status',
                title: 'Tracking Status',
                steps: [
                    'Both PRs and POs have status indicators: DRAFT, PENDING, APPROVED, REJECTED, COMPLETED.',
                    'Use the tabs to switch between Requisitions, Purchase Orders, and Goods Receipts.',
                    'Click the "Eye" icon to view details of any PR or PO.',
                    'Monitor delivery and payment progress from the procurement dashboard.'
                ]
            }
        ]
    },
    {
        id: 'milestones',
        icon: <ListChecks className="w-5 h-5" />,
        title: 'Milestones',
        content: 'Milestones track key deliverables and payment triggers throughout the project lifecycle.',
        subsections: [
            {
                id: 'ms-create',
                title: 'Creating Milestones',
                steps: [
                    'Go to the "Milestones" tab.',
                    'Click "Add Milestone" to create a new milestone.',
                    'Enter: Milestone Name, Description, Due Date, and Budgeted Amount.',
                    'Select the milestone type (e.g., Payment Gate, Delivery Gate).',
                    'Click "Save" to add the milestone to the project.'
                ]
            },
            {
                id: 'ms-track',
                title: 'Tracking Milestone Progress',
                steps: [
                    'Each milestone shows its status: PENDING, IN_PROGRESS, COMPLETED, or OVERDUE.',
                    'Mark milestones as complete when the deliverable is achieved.',
                    'The milestone progress bar shows overall completion percentage.',
                    'Payment milestones are linked to the Finance module for invoicing.',
                    'Overdue milestones appear with a warning indicator.'
                ]
            }
        ]
    },
    {
        id: 'expenses',
        icon: <DollarSign className="w-5 h-5" />,
        title: 'Expenses',
        content: 'Track all project expenses including labor, materials, equipment, and other costs.',
        subsections: [
            {
                id: 'ex-add',
                title: 'Adding Expenses',
                steps: [
                    'Go to the "Expenses" tab.',
                    'Click "Add Expense" to record a new expense.',
                    'Select: Expense Category (Labor, Material, Equipment, Transport, etc.), Description, Amount, and Date.',
                    'Attach receipts or supporting documents if needed.',
                    'Click "Save" to record the expense.'
                ]
            },
            {
                id: 'ex-view',
                title: 'Expense Tracking',
                steps: [
                    'Expenses are shown in a table with date, category, description, and amount.',
                    'The total expenses and budget remaining are displayed at the top.',
                    'Expenses are categorized for reporting and budget analysis.',
                    'Budget vs Actual comparison helps track financial health.'
                ]
            }
        ]
    },
    {
        id: 'tasks',
        icon: <ClipboardList className="w-5 h-5" />,
        title: 'Tasks & Resources',
        content: 'Create and assign tasks to team members, track progress, and manage resources efficiently.',
        subsections: [
            {
                id: 'ts-create',
                title: 'Creating & Assigning Tasks',
                steps: [
                    'Go to the "Tasks" tab.',
                    'Click "Add Task" to create a new task.',
                    'Enter: Task Title, Description, Assigned To, Priority, Start Date, and Due Date.',
                    'Link the task to a milestone if applicable.',
                    'Set dependencies if this task depends on another task being completed first.',
                    'Click "Save" to create the task.'
                ]
            },
            {
                id: 'ts-track',
                title: 'Tracking Task Progress',
                steps: [
                    'Each task shows status: OPEN, IN_PROGRESS, COMPLETED, or BLOCKED.',
                    'Update task progress percentage as work is completed.',
                    'Tasks can be viewed in List view or Gantt chart view.',
                    'Gantt chart shows task dependencies and timeline visualization.',
                    'Use the filter options to view tasks by status, assignee, or priority.'
                ]
            },
            {
                id: 'rs-manage',
                title: 'Managing Resources',
                steps: [
                    'Go to the "Resources" tab to manage equipment and labor resources.',
                    'Add resources with name, type, quantity, cost rate, and availability.',
                    'Assign resources to specific tasks.',
                    'Track resource utilization to avoid over-allocation.'
                ]
            }
        ]
    },
    {
        id: 'permits',
        icon: <FileCheck className="w-5 h-5" />,
        title: 'Permits & Approvals',
        content: 'Manage permits, wayleves, and regulatory approvals required for OSP construction work.',
        subsections: [
            {
                id: 'pm-add',
                title: 'Adding Permits',
                steps: [
                    'Go to the "Permits" tab.',
                    'Click "Add Permit" to register a new permit or wayleave.',
                    'Enter: Permit Type (LGA, RDA, SLT, etc.), Reference Number, Issuing Authority, and Expiry Date.',
                    'Upload permit documents (PDF, images).',
                    'Click "Save" to record the permit.'
                ]
            },
            {
                id: 'pm-track',
                title: 'Permit Tracking',
                steps: [
                    'Permits are shown with status: ACTIVE, EXPIRING_SOON, or EXPIRED.',
                    'The system alerts you when permits are close to expiry.',
                    'Track approval status for each permit application.',
                    'Renew permits through the interface when needed.'
                ]
            }
        ]
    },
    {
        id: 'quality',
        icon: <Shield className="w-5 h-5" />,
        title: 'QA/QC & Inspection',
        content: 'Quality Assurance and Quality Control module for tracking inspections, test results, and compliance.',
        subsections: [
            {
                id: 'qc-forms',
                title: 'QA/QC Inspections',
                steps: [
                    'Go to the "QA/QC" tab.',
                    'Create inspection checklists for different work types (cabling, splicing, termination).',
                    'Fill in inspection results and observations.',
                    'Attach photos as evidence of quality.',
                    'Mark items as PASS or FAIL with corrective actions noted.'
                ]
            },
            {
                id: 'qc-commission',
                title: 'Commissioning',
                steps: [
                    'Go to the "Commissioning" tab for final network commissioning.',
                    'Record commissioning test results.',
                    'Verify that all QA/QC items are resolved before commissioning.',
                    'Generate commissioning reports for handover.'
                ]
            }
        ]
    },
    {
        id: 'survey',
        icon: <MapPin className="w-5 h-5" />,
        title: 'Survey & GIS',
        content: 'Manage site surveys, GIS route mapping, and OTDR testing for fiber networks.',
        subsections: [
            {
                id: 'sv-conduct',
                title: 'Conducting Surveys',
                steps: [
                    'Go to the "Survey" tab to view survey data.',
                    'Record survey findings including route measurements and site conditions.',
                    'Upload survey reports and field drawings.',
                    'Mark survey status as COMPLETED when done.'
                ]
            },
            {
                id: 'sv-gis',
                title: 'GIS Route Mapping',
                steps: [
                    'Go to the "GIS Route" tab.',
                    'View the fiber route on the map.',
                    'Upload GIS data (KML/KMZ files) for route visualization.',
                    'Generate BOQ from GIS route data (distance-based calculations).',
                    'Update route information as design changes.'
                ]
            },
            {
                id: 'sv-otdr',
                title: 'OTDR Testing',
                steps: [
                    'Go to the "OTDR" tab.',
                    'Upload OTDR trace files from field testing.',
                    'View fiber length, loss, and event analysis.',
                    'Mark test results as PASS/FAIL based on acceptance criteria.',
                    'Generate OTDR test reports for documentation.'
                ]
            }
        ]
    },
    {
        id: 'contractor',
        icon: <Users className="w-5 h-5" />,
        title: 'Contractor Management',
        content: 'Manage contractor assignments, performance tracking, and coordination.',
        subsections: [
            {
                id: 'ct-assign',
                title: 'Assigning Contractors',
                steps: [
                    'Go to the "Contractor" tab.',
                    'View the currently assigned contractor for this project.',
                    'Assign or change contractors from the registered contractor list.',
                    'Set contract terms, rates, and scope of work.'
                ]
            },
            {
                id: 'ct-perf',
                title: 'Performance Evaluation',
                steps: [
                    'Go to the "Contractor Perf" tab.',
                    'Rate contractor performance on each completed work package.',
                    'Record feedback and observations.',
                    'Performance history is tracked for future contractor selection.',
                    'KPI dashboards show contractor performance metrics.'
                ]
            }
        ]
    },
    {
        id: 'documents',
        icon: <FileText className="w-5 h-5" />,
        title: 'Documents',
        content: 'Central document repository for all project-related files, drawings, reports, and correspondence.',
        subsections: [
            {
                id: 'doc-upload',
                title: 'Uploading Documents',
                steps: [
                    'Go to the "Documents" tab.',
                    'Click "Upload Document" to add a new file.',
                    'Select: Document Category (Drawing, Report, Contract, Photo, etc.), Title, and Description.',
                    'Choose the file from your computer and upload.',
                    'Documents are organized by category for easy retrieval.',
                    'Supported formats: PDF, Images, MS Office, CAD files.'
                ]
            },
            {
                id: 'doc-manage',
                title: 'Managing Documents',
                steps: [
                    'Browse documents by category using the filter tabs.',
                    'Search for documents by title or description.',
                    'Download any document by clicking the download button.',
                    'Delete outdated documents (with confirmation).',
                    'Document upload history is tracked with timestamps and uploader info.'
                ]
            }
        ]
    },
    {
        id: 'finance',
        icon: <BarChart3 className="w-5 h-5" />,
        title: 'Finance & EVM',
        content: 'Financial management including budget tracking, cost control, invoices, and Earned Value Management (EVM).',
        subsections: [
            {
                id: 'fn-budget',
                title: 'Budget & Cost Tracking',
                steps: [
                    'Go to the "Finance" tab.',
                    'View budget allocation vs actual spending.',
                    'Track committed costs from POs and contracts.',
                    'View cost breakdown by category (labor, material, equipment).',
                    'Generate financial reports for management review.'
                ]
            },
            {
                id: 'fn-evm',
                title: 'Earned Value Management (EVM)',
                steps: [
                    'Go to the "EVM" tab.',
                    'View Planned Value (PV), Earned Value (EV), and Actual Cost (AC).',
                    'Calculate performance indices: SPI (Schedule) and CPI (Cost).',
                    'SPI > 1 = ahead of schedule. SPI < 1 = behind schedule.',
                    'CPI > 1 = under budget. CPI < 1 = over budget.',
                    'EVM provides early warning of project performance issues.'
                ]
            },
            {
                id: 'fn-closure',
                title: 'Project Closure',
                steps: [
                    'Go to the "Closure" tab for final project closeout.',
                    'Verify all deliverables are completed.',
                    'Finalize all financial transactions.',
                    'Complete the handover checklist.',
                    'Submit for final project closure approval.',
                    'Once closed, the project is archived and marked COMPLETED.'
                ]
            }
        ]
    },
    {
        id: 'hse',
        icon: <HardHat className="w-5 h-5" />,
        title: 'HSE (Health, Safety & Environment)',
        content: 'Manage safety inspections, incident reporting, and environmental compliance.',
        subsections: [
            {
                id: 'hse-safety',
                title: 'Safety Management',
                steps: [
                    'Go to the "HSE" tab.',
                    'Record daily safety briefings and toolbox talks.',
                    'Log safety inspections and observations.',
                    'Report any incidents or near-misses with details.',
                    'Track corrective actions for safety issues.',
                    'View safety statistics and compliance status.'
                ]
            }
        ]
    },
    {
        id: 'variations',
        icon: <AlertTriangle className="w-5 h-5" />,
        title: 'Variation Orders',
        content: 'Manage scope changes, variation orders (VO), and change requests.',
        subsections: [
            {
                id: 'vo-create',
                title: 'Creating Variation Orders',
                steps: [
                    'Go to the "Variations" tab.',
                    'Click "New Variation Order" to document a scope change.',
                    'Describe the change, reason, and impact on cost/schedule.',
                    'Attach supporting documents.',
                    'Submit for approval. VOs go through an approval workflow.',
                    'Approved VOs update the project budget and timeline automatically.'
                ]
            }
        ]
    },
    {
        id: 'risks',
        icon: <AlertTriangle className="w-5 h-5" />,
        title: 'Risk Management',
        content: 'Identify, assess, and track project risks with mitigation plans.',
        subsections: [
            {
                id: 'rk-add',
                title: 'Managing Risks',
                steps: [
                    'Go to the "Risks" tab.',
                    'Click "Add Risk" to register a new risk.',
                    'Enter: Risk Description, Category, Likelihood (1-5), Impact (1-5), and Risk Owner.',
                    'The system calculates Risk Score = Likelihood × Impact.',
                    'Define mitigation measures and contingency plans.',
                    'Monitor risks and update status as mitigation actions are completed.'
                ]
            }
        ]
    },
    {
        id: 'kpis',
        icon: <BarChart3 className="w-5 h-5" />,
        title: 'KPIs & Reports',
        content: 'Key Performance Indicators and reports for project performance measurement.',
        subsections: [
            {
                id: 'kp-view',
                title: 'Viewing KPIs',
                steps: [
                    'Go to the "KPIs" tab.',
                    'View project performance KPIs: Schedule Performance, Cost Performance, Quality Score, Safety Score.',
                    'KPI dashboards update automatically based on project data.',
                    'Export reports for management meetings.',
                    'Track trends over time to identify improvement areas.'
                ]
            }
        ]
    }
];

// ─── Component ──────────────────────────────────────────────────────
export default function ProjectDocumentation({ project }: { project?: any }) {
    const [search, setSearch] = useState('');
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        setExpandedSections(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setSidebarOpen(false);
        setTimeout(() => {
            document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    // Filter documentation based on search
    const filteredDocs = DOCUMENTATION.filter(section => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const matchesTitle = section.title.toLowerCase().includes(q);
        const matchesContent = section.content.toLowerCase().includes(q);
        const matchesSub = section.subsections.some(sub =>
            sub.title.toLowerCase().includes(q) ||
            sub.steps.some(s => s.toLowerCase().includes(q))
        );
        return matchesTitle || matchesContent || matchesSub;
    });

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Mobile sidebar toggle */}
            <button
                className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 mb-4"
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                <Menu className="w-4 h-4" />
                Documentation Menu
            </button>

            {/* Sidebar Navigation */}
            <div className={cn(
                'lg:w-64 shrink-0',
                sidebarOpen ? 'block' : 'hidden lg:block'
            )}>
                <div className="lg:sticky lg:top-4 space-y-1 bg-white rounded-xl border border-slate-200 p-3">
                    <div className="px-3 py-2 mb-2">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Guide</h3>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full h-9 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                            placeholder="Search documentation..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Section Links */}
                    {DOCUMENTATION.map(section => {
                        const isActive = activeSection === section.id;
                        const q = search.toLowerCase();
                        const isVisible = !search.trim() ||
                            section.title.toLowerCase().includes(q) ||
                            section.content.toLowerCase().includes(q) ||
                            section.subsections.some(sub =>
                                sub.title.toLowerCase().includes(q) ||
                                sub.steps.some(s => s.toLowerCase().includes(q))
                            );

                        if (!isVisible) return null;

                        return (
                            <button
                                key={section.id}
                                className={cn(
                                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-slate-600 hover:bg-slate-50'
                                )}
                                onClick={() => scrollToSection(section.id)}
                            >
                                <span className="shrink-0">{section.icon}</span>
                                <span className="truncate">{section.title}</span>
                            </button>
                        );
                    })}

                    {/* Version info */}
                    <div className="px-3 pt-3 mt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400">SLT SERP v2.0</p>
                        <p className="text-xs text-slate-400">Project Module Guide</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-8">
                {/* Hero */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 md:p-8 text-white">
                    <BookOpen className="w-10 h-10 mb-4 opacity-80" />
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">
                        Project Management Guide
                    </h1>
                    <p className="text-blue-100 text-sm md:text-base max-w-2xl">
                        Complete A-to-Z documentation for managing Telecom OSP Projects in SLT SERP.
                        Use the navigation menu or search to find specific topics.
                    </p>
                </div>

                {search.trim() && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                        Showing results for &ldquo;{search}&rdquo; &mdash; {filteredDocs.length} sections found
                    </div>
                )}

                {filteredDocs.length === 0 && (
                    <div className="text-center py-12">
                        <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No documentation found for &ldquo;{search}&rdquo;</p>
                        <p className="text-slate-400 text-sm mt-1">Try searching for &ldquo;BOQ&rdquo;, &ldquo;Permits&rdquo;, or &ldquo;Tasks&rdquo;</p>
                    </div>
                )}

                {/* Sections */}
                {filteredDocs.map(section => (
                    <section
                        key={section.id}
                        id={`doc-${section.id}`}
                        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                    >
                        {/* Section Header */}
                        <button
                            className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-slate-50/50 transition-colors"
                            onClick={() => toggleSection(section.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    {section.icon}
                                </div>
                                <div className="text-left">
                                    <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                                    <p className="text-sm text-slate-500 mt-0.5">{section.content}</p>
                                </div>
                            </div>
                            {expandedSections.has(section.id) ? (
                                <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                            )}
                        </button>

                        {/* Sub Sections */}
                        {expandedSections.has(section.id) && (
                            <div className="px-4 md:px-6 pb-6 space-y-6 border-t border-slate-100 pt-4">
                                {section.subsections.map(sub => (
                                    <div key={sub.id} id={`doc-${sub.id}`}>
                                        <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                                            {sub.title}
                                        </h3>
                                        <div className="ml-4 space-y-2">
                                            {sub.steps.map((step, idx) => (
                                                <div key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                                                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="leading-relaxed">{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {sub.notes && (
                                            <div className="ml-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                                                <strong>💡 Tip:</strong> {sub.notes}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                ))}

                {/* Footer */}
                <div className="text-center py-8 border-t border-slate-200">
                    <p className="text-sm text-slate-400">
                        Need help? Contact your system administrator or refer to the SLT SERP training materials.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        SLT SERP Project Management Module &bull; Sri Lanka Telecom
                    </p>
                </div>
            </div>
        </div>
    );
}
