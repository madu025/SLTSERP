"use client";

import React, { use, useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, Building2, User, Workflow, BookOpen, Loader2, Edit2, HardHat, Cloud, Download, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import ProjectOverview from '@/components/projects/ProjectOverview';
import ProjectBOQ from '@/components/projects/ProjectBOQ';
import ProjectMilestones from '@/components/projects/ProjectMilestones';
import ProjectExpenses from '@/components/projects/ProjectExpenses';
import ProjectMaterialIssues from '@/components/projects/ProjectMaterialIssues';
import ProjectTasks from '@/components/projects/ProjectTasks';
import ProjectProcurement from '@/components/projects/ProjectProcurement';
import ProjectFinance from '@/components/projects/ProjectFinance';
import ProjectClosure from '@/components/projects/ProjectClosure';
import ProjectResources from '@/components/projects/ProjectResources';
import ProjectDocuments from '@/components/projects/ProjectDocuments';
import ProjectApprovals from '@/components/projects/ProjectApprovals';
import ProjectRisks from '@/components/projects/ProjectRisks';
import ProjectQA from '@/components/projects/ProjectQA';
import ProjectContractors from '@/components/projects/ProjectContractors';
import ProjectCommissioning from '@/components/projects/ProjectCommissioning';
import ProjectKPIs from '@/components/projects/ProjectKPIs';
import ProjectWorkflowTracker from '@/components/projects/ProjectWorkflowTracker';
import ProjectPermits from '@/components/projects/ProjectPermits';
import ProjectGISRoute from '@/components/projects/ProjectGISRoute';
import ProjectSurvey from '@/components/projects/ProjectSurvey';
import ProjectOTDR from '@/components/projects/ProjectOTDR';
import ProjectHSE from '@/components/projects/ProjectHSE';
import ProjectContractorPerformance from '@/components/projects/ProjectContractorPerformance';
import ProjectEVM from '@/components/projects/ProjectEVM';
import ProjectAssetRegister from '@/components/projects/ProjectAssetRegister';
import ProjectVariationOrders from '@/components/projects/ProjectVariationOrders';
import ProjectDocumentation from '@/components/projects/ProjectDocumentation';
import ProjectFieldTasks from '@/components/projects/ProjectFieldTasks';
import ProjectSurveyApproval from '@/components/projects/ProjectSurveyApproval';
import ProjectPAT from '@/components/projects/ProjectPAT';
import ProjectAIForecasting from '@/components/projects/ProjectAIForecasting';
import { getTabsForStage, TabDefinition } from '@/config/stage-tab-mapping';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectStaff {
    id: string;
    name: string;
}

interface ProjectContractorRef {
    id: string;
    name: string;
    contactNumber?: string;
}

interface ProjectTypeRef {
    id: string;
    name: string;
}

interface ProjectOPMC {
    id: string;
    rtom: string;
    region?: string;
}

interface WorkflowStage {
    id: string;
    name: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
}

interface WorkflowInstance {
    id: string;
    stages: WorkflowStage[];
}

interface Project {
    id: string;
    projectCode: string;
    name: string;
    description?: string;
    type: string;
    location?: string;
    status: string;
    progress: number;
    budget?: number;
    actualCost: number;
    startDate?: string;
    endDate?: string;
    estimatedDuration?: number;
    actualDuration?: number;
    opmcId?: string;
    contractorId?: string;
    areaManagerId?: string;
    opmc?: ProjectOPMC;
    contractor?: ProjectContractorRef;
    areaManager?: ProjectStaff;
    projectType?: ProjectTypeRef;
    workflowInstance?: WorkflowInstance;
}

interface OPMCOption {
    id: string;
    rtom: string;
    region: string;
}

interface ContractorOption {
    id: string;
    name: string;
}

interface EditFormState {
    name: string;
    projectCode: string;
    description: string;
    status: string;
    progress: string;
    startDate: string;
    endDate: string;
    location: string;
    estimatedDuration: string;
    actualDuration: string;
}

// Shared tab prop type — permissive at the map level; individual components enforce their own props
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTabComponent = React.ComponentType<any>;

// ─── Tab component map ────────────────────────────────────────────────────────

const TAB_COMPONENTS: Record<string, AnyTabComponent> = {
    overview: ProjectOverview,
    'workflow-pipeline': ProjectWorkflowTracker,
    permits: ProjectPermits,
    gis: ProjectGISRoute,
    survey: ProjectSurvey,
    otdr: ProjectOTDR,
    hse: ProjectHSE,
    'contractor-perf': ProjectContractorPerformance,
    evm: ProjectEVM,
    assets: ProjectAssetRegister,
    variations: ProjectVariationOrders,
    boq: ProjectBOQ,
    materials: ProjectMaterialIssues,
    milestones: ProjectMilestones,
    expenses: ProjectExpenses,
    tasks: ProjectTasks,
    resources: ProjectResources,
    documents: ProjectDocuments,
    approvals: ProjectApprovals,
    risks: ProjectRisks,
    qa: ProjectQA,
    contractor: ProjectContractors,
    commissioning: ProjectCommissioning,
    kpis: ProjectKPIs,
    procurement: ProjectProcurement,
    finance: ProjectFinance,
    closure: ProjectClosure,
    'field-tasks': ProjectFieldTasks,
    guide: ProjectDocumentation,
    'survey-approval': ProjectSurveyApproval,
    pat: ProjectPAT,
    'ai-forecasting': ProjectAIForecasting,
};

// Tabs whose mutations require refreshing the parent project data
const REFRESH_TABS = new Set([
    'boq', 'materials', 'milestones', 'expenses',
    'tasks', 'procurement', 'finance', 'closure',
]);

const PROJECT_STATUSES = ['PLANNING', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

// ─── Error Boundary ───────────────────────────────────────────────────────────

class TabErrorBoundary extends React.Component<
    { children: React.ReactNode; tabLabel: string },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; tabLabel: string }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                    <p className="font-medium">Failed to load {this.props.tabLabel}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => this.setState({ hasError: false })}
                    >
                        Retry
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [guideDialogOpen, setGuideDialogOpen] = useState(false);

    // Edit Details dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState<EditFormState>({
        name: '',
        projectCode: '',
        description: '',
        status: '',
        progress: '',
        startDate: '',
        endDate: '',
        location: '',
        estimatedDuration: '',
        actualDuration: '',
    });

    const [opmcs, setOpmcs] = useState<OPMCOption[]>([]);
    const [contractors, setContractors] = useState<ContractorOption[]>([]);
    const [editOpmcId, setEditOpmcId] = useState('');
    const [editContractorId, setEditContractorId] = useState('');

    // ── Data fetching ────────────────────────────────────────────────────────

    const fetchProjectDetails = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data: Project = await res.json();
            setProject(data);
        } catch {
            toast.error('Failed to load project details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchProjectDetails();
    }, [fetchProjectDetails]);

    // ── Stage-driven tab visibility ──────────────────────────────────────────

    const currentStageName = useMemo(() => {
        if (!project?.workflowInstance?.stages) return null;
        const activeStage =
            project.workflowInstance.stages.find((s) => s.status === 'IN_PROGRESS') ||
            project.workflowInstance.stages.find((s) => s.status === 'PENDING');
        return activeStage?.name ?? null;
    }, [project]);

    const visibleTabs = useMemo(() => getTabsForStage(currentStageName), [currentStageName]);

    // Reset active tab if it's no longer visible after stage change
    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.value === activeTab)) {
            setActiveTab(visibleTabs[0]?.value ?? 'overview');
        }
    }, [visibleTabs, activeTab]);

    // Group tabs for sidebar
    const groupedTabs = useMemo(() => {
        const groups: Record<string, TabDefinition[]> = {
            'Core': [],
            'Field Operations': [],
            'Finance & Resources': [],
            'Quality & Closure': [],
            'Other': []
        };
        visibleTabs.forEach(tab => {
            const v = tab.value;
            if (['overview', 'workflow-pipeline', 'guide'].includes(v)) groups['Core'].push(tab);
            else if (['gis', 'survey', 'field-tasks', 'pat', 'otdr', 'hse', 'survey-approval', 'permits'].includes(v)) groups['Field Operations'].push(tab);
            else if (['boq', 'materials', 'expenses', 'procurement', 'finance', 'resources', 'contractor', 'contractor-perf'].includes(v)) groups['Finance & Resources'].push(tab);
            else if (['qa', 'commissioning', 'closure', 'milestones', 'tasks', 'kpis', 'ai-forecasting', 'variations', 'risks', 'assets'].includes(v)) groups['Quality & Closure'].push(tab);
            else groups['Other'].push(tab);
        });
        return Object.entries(groups).filter(([_, tabs]) => tabs.length > 0);
    }, [visibleTabs]);

    // ── Edit dialog ──────────────────────────────────────────────────────────

    const handleOpenEdit = useCallback(async () => {
        if (!project) return;
        setEditForm({
            name: project.name ?? '',
            projectCode: project.projectCode ?? '',
            description: project.description ?? '',
            status: project.status ?? 'PLANNING',
            progress: project.progress?.toString() ?? '0',
            startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
            endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
            location: project.location ?? '',
            estimatedDuration: project.estimatedDuration?.toString() ?? '',
            actualDuration: project.actualDuration?.toString() ?? '',
        });
        setEditOpmcId(project.opmcId ?? '');
        setEditContractorId(project.contractorId ?? '');

        try {
            const [opmcRes, contractorRes] = await Promise.all([
                fetch('/api/opmcs'),
                fetch('/api/contractors'),
            ]);
            if (opmcRes.ok) setOpmcs(await opmcRes.json());
            if (contractorRes.ok) setContractors(await contractorRes.json());
        } catch {
            toast.error('Failed to load dropdown options');
        }

        setEditDialogOpen(true);
    }, [project]);

    const handleSaveEdit = useCallback(async () => {
        if (!editForm.name.trim()) {
            toast.error('Project name is required');
            return;
        }

        setSaving(true);
        try {
            const body = {
                id: project?.id,
                name: editForm.name,
                projectCode: editForm.projectCode,
                description: editForm.description,
                status: editForm.status,
                progress: parseFloat(editForm.progress) || 0,
                location: editForm.location,
                startDate: editForm.startDate || null,
                endDate: editForm.endDate || null,
                estimatedDuration: editForm.estimatedDuration ? parseInt(editForm.estimatedDuration) : null,
                actualDuration: editForm.actualDuration ? parseInt(editForm.actualDuration) : null,
                opmcId: editOpmcId || null,
                contractorId: editContractorId || null,
            };

            const res = await fetch('/api/projects', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'Failed to update project');
                return;
            }

            toast.success('Project updated successfully');
            setEditDialogOpen(false);
            fetchProjectDetails();
        } catch {
            toast.error('Failed to update project');
        } finally {
            setSaving(false);
        }
    }, [editForm, editOpmcId, editContractorId, project?.id, fetchProjectDetails]);

    // ── Render states ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
                </main>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <p className="text-slate-500">Project not found</p>
                    <Button onClick={() => router.back()}>Go Back</Button>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
                <Header />

                {/* Page Header */}
                <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-500 hover:text-slate-900 -ml-2"
                                onClick={() => router.push('/projects')}
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to Projects
                            </Button>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{project.name}</h1>
                                    <Badge variant="outline" className="text-sm border-slate-300">
                                        {project.projectCode}
                                    </Badge>
                                    <Badge
                                        className={
                                            project.status === 'COMPLETED'
                                                ? 'bg-green-100 text-green-700'
                                                : project.status === 'IN_PROGRESS'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                        }
                                    >
                                        {project.status.replace(/_/g, ' ')}
                                    </Badge>
                                    {project.projectType && (
                                        <Badge variant="outline" className="text-sm border-blue-300 bg-blue-50 text-blue-700">
                                            {project.projectType.name.replace(/_/g, ' ')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4" />
                                        {project.location || 'No location set'}
                                    </div>
                                    {project.projectType && (
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="w-4 h-4" />
                                            {project.projectType.name.replace(/_/g, ' ')}
                                        </div>
                                    )}
                                    {project.opmc && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-slate-700">OPMC:</span>
                                            {project.opmc.rtom}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800"
                                >
                                    <Cloud className="w-4 h-4" />
                                    Sync to QField
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5">
                                    <Download className="w-4 h-4" />
                                    Export
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setGuideDialogOpen(true)}
                                    className="gap-1.5"
                                >
                                    <BookOpen className="w-4 h-4" />
                                    Guide
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleOpenEdit} className="gap-1.5">
                                    <Edit2 className="w-4 h-4" />
                                    Edit Details
                                </Button>
                            </div>
                        </div>

                        {/* Team Info Bar */}
                        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Area Manager</p>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                                        {project.areaManager?.name || 'Not Assigned'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                    <HardHat className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Contractor</p>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                                        {project.contractor?.name || 'Not Assigned'}
                                    </p>
                                    {project.contractor && (
                                        <p className="text-xs text-slate-500 mt-1">{project.contractor.contactNumber}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Timeline</p>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}
                                        {' — '}
                                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stage Info Bar */}
                        {currentStageName && (
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm">
                                <Workflow className="w-4 h-4 text-blue-500" />
                                <span className="text-slate-500">Current Stage:</span>
                                <Badge className="bg-blue-100 text-blue-800 border border-blue-200">
                                    {currentStageName}
                                </Badge>
                                <span className="text-xs text-slate-400 ml-2">
                                    {visibleTabs.length} modules available
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Sub-Sidebar Layout ── */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Navigation Sidebar */}
                    <aside className="w-64 border-r border-slate-200 bg-white/50 overflow-y-auto flex-shrink-0 hidden md:block">
                        <div className="p-4 space-y-6">
                            {groupedTabs.map(([groupName, tabs]) => (
                                <div key={groupName}>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
                                        {groupName}
                                    </h3>
                                    <div className="space-y-0.5">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.value}
                                                onClick={() => setActiveTab(tab.value)}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                                                    activeTab === tab.value
                                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                                                }`}
                                            >
                                                {tab.label}
                                                {activeTab === tab.value && <ChevronRight className="w-4 h-4 text-blue-500" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-slate-50/50">
                        <div className="max-w-6xl mx-auto">
                            {/* Mobile Tabs fallback (only visible on small screens) */}
                            <div className="md:hidden mb-4 overflow-x-auto pb-2 flex gap-2">
                                {visibleTabs.map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => setActiveTab(tab.value)}
                                        className={`whitespace-nowrap px-4 py-2 text-sm rounded-full border transition-all ${
                                            activeTab === tab.value
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Render active component */}
                            {visibleTabs.map((tab) => {
                                if (tab.value !== activeTab) return null;
                                const Component = TAB_COMPONENTS[tab.value];
                                if (!Component) return null;

                                return (
                                    <div key={tab.value} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                            <TabErrorBoundary tabLabel={tab.label}>
                                                <Component
                                                    project={project}
                                                    projectId={project.id}
                                                    refreshProject={REFRESH_TABS.has(tab.value) ? fetchProjectDetails : undefined}
                                                />
                                            </TabErrorBoundary>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </main>
                </div>
            </main>

            {/* Guide Documentation Dialog — lazy rendered */}
            <Dialog open={guideDialogOpen} onOpenChange={setGuideDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Project Module Guide</DialogTitle>
                        <DialogDescription>
                            Complete A-to-Z documentation for all project modules and features
                        </DialogDescription>
                    </DialogHeader>
                    {guideDialogOpen && <ProjectDocumentation project={project} />}
                </DialogContent>
            </Dialog>

            {/* Edit Project Details Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Project Details</DialogTitle>
                        <DialogDescription>
                            Update project status, timeline, progress, and other details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Project Name *</Label>
                            <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Project name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Project Code *</Label>
                            <Input
                                value={editForm.projectCode}
                                onChange={(e) => setEditForm({ ...editForm, projectCode: e.target.value })}
                                placeholder="FOSP_SLTS_2026_002"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={editForm.status}
                                onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROJECT_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s.replace(/_/g, ' ')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Progress (%)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={editForm.progress}
                                onChange={(e) => setEditForm({ ...editForm, progress: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={editForm.startDate}
                                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                                type="date"
                                value={editForm.endDate}
                                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Input
                                value={editForm.location}
                                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                placeholder="Project location"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Est. Duration (Days)</Label>
                            <Input
                                type="number"
                                value={editForm.estimatedDuration}
                                onChange={(e) => setEditForm({ ...editForm, estimatedDuration: e.target.value })}
                                placeholder="Estimated days"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Actual Duration (Days)</Label>
                            <Input
                                type="number"
                                value={editForm.actualDuration}
                                onChange={(e) => setEditForm({ ...editForm, actualDuration: e.target.value })}
                                placeholder="Actual days"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>OPMC</Label>
                            <Select value={editOpmcId} onValueChange={setEditOpmcId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select OPMC" />
                                </SelectTrigger>
                                <SelectContent>
                                    {opmcs.map((o) => (
                                        <SelectItem key={o.id} value={o.id}>
                                            {o.rtom} ({o.region})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Contractor</Label>
                            <Select value={editContractorId} onValueChange={setEditContractorId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Contractor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {contractors.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Project description..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}