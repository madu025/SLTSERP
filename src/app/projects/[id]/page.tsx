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
interface ProjectStaff { id: string; name: string; }
interface ProjectContractorRef { id: string; name: string; contactNumber?: string; }
interface ProjectTypeRef { id: string; name: string; }
interface ProjectOPMC { id: string; rtom: string; region?: string; }
interface WorkflowStage { id: string; name: string; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'; }
interface WorkflowInstance { id: string; stages: WorkflowStage[]; }
interface Project {
    id: string; projectCode: string; name: string; description?: string; type: string;
    location?: string; status: string; progress: number; budget?: number; actualCost: number;
    startDate?: string; endDate?: string; estimatedDuration?: number; actualDuration?: number;
    opmcId?: string; contractorId?: string; areaManagerId?: string;
    opmc?: ProjectOPMC; contractor?: ProjectContractorRef; areaManager?: ProjectStaff;
    projectType?: ProjectTypeRef; workflowInstance?: WorkflowInstance;
}
interface OPMCOption { id: string; rtom: string; region: string; }
interface ContractorOption { id: string; name: string; }
interface EditFormState {
    name: string; projectCode: string; description: string; status: string; progress: string;
    startDate: string; endDate: string; location: string; estimatedDuration: string; actualDuration: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTabComponent = React.ComponentType<any>;
 
const TAB_COMPONENTS: Record<string, AnyTabComponent> = {
    overview: ProjectOverview, 'workflow-pipeline': ProjectWorkflowTracker, permits: ProjectPermits,
    gis: ProjectGISRoute, survey: ProjectSurvey, otdr: ProjectOTDR, hse: ProjectHSE,
    'contractor-perf': ProjectContractorPerformance, evm: ProjectEVM, assets: ProjectAssetRegister,
    variations: ProjectVariationOrders, boq: ProjectBOQ, materials: ProjectMaterialIssues,
    milestones: ProjectMilestones, expenses: ProjectExpenses, tasks: ProjectTasks,
    resources: ProjectResources, documents: ProjectDocuments, approvals: ProjectApprovals,
    risks: ProjectRisks, qa: ProjectQA, contractor: ProjectContractors, commissioning: ProjectCommissioning,
    kpis: ProjectKPIs, procurement: ProjectProcurement, finance: ProjectFinance, closure: ProjectClosure,
    'field-tasks': ProjectFieldTasks, guide: ProjectDocumentation, 'survey-approval': ProjectSurveyApproval,
    pat: ProjectPAT, 'ai-forecasting': ProjectAIForecasting,
};
 
const REFRESH_TABS = new Set(['boq', 'materials', 'milestones', 'expenses', 'tasks', 'procurement', 'finance', 'closure']);
const PROJECT_STATUSES = ['PLANNING', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
 
// ─── Error Boundary ───────────────────────────────────────────────────────────
class TabErrorBoundary extends React.Component<{ children: React.ReactNode; tabLabel: string }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode; tabLabel: string }) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                    <p className="text-sm font-medium">Failed to load {this.props.tabLabel}</p>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => this.setState({ hasError: false })}>Retry</Button>
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
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState<EditFormState>({ name: '', projectCode: '', description: '', status: '', progress: '', startDate: '', endDate: '', location: '', estimatedDuration: '', actualDuration: '' });
    const [opmcs, setOpmcs] = useState<OPMCOption[]>([]);
    const [contractors, setContractors] = useState<ContractorOption[]>([]);
    const [editOpmcId, setEditOpmcId] = useState('');
    const [editContractorId, setEditContractorId] = useState('');
 
    const fetchProjectDetails = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error('Failed to fetch');
            setProject(await res.json() as Project);
        } catch { toast.error('Failed to load project details'); }
        finally { setLoading(false); }
    }, [id]);
 
    useEffect(() => { fetchProjectDetails(); }, [fetchProjectDetails]);
 
    const currentStageName = useMemo(() => {
        if (project?.workflowInstance?.stages) {
            const active = project.workflowInstance.stages.find(s => s.status === 'IN_PROGRESS') ||
                project.workflowInstance.stages.find(s => s.status === 'PENDING');
            if (active) return active.name;
        }
        return project?.status ?? null;
    }, [project]);
 
    const visibleTabs = useMemo(() => getTabsForStage(currentStageName), [currentStageName]);
    useEffect(() => { if (visibleTabs.length > 0 && !visibleTabs.find(t => t.value === activeTab)) { setActiveTab(visibleTabs[0]?.value ?? 'overview'); } }, [visibleTabs, activeTab]);
 
    const groupedTabs = useMemo(() => {
        const groups: Record<string, TabDefinition[]> = { 'Core': [], 'Field Operations': [], 'Finance & Resources': [], 'Quality & Closure': [], 'Other': [] };
        visibleTabs.forEach(tab => {
            const v = tab.value;
            if (['overview', 'workflow-pipeline', 'guide'].includes(v)) groups['Core'].push(tab);
            else if (['gis', 'survey', 'field-tasks', 'pat', 'otdr', 'hse', 'survey-approval', 'permits'].includes(v)) groups['Field Operations'].push(tab);
            else if (['boq', 'materials', 'expenses', 'procurement', 'finance', 'resources', 'contractor', 'contractor-perf'].includes(v)) groups['Finance & Resources'].push(tab);
            else if (['qa', 'commissioning', 'closure', 'milestones', 'tasks', 'kpis', 'ai-forecasting', 'variations', 'risks', 'assets'].includes(v)) groups['Quality & Closure'].push(tab);
            else groups['Other'].push(tab);
        });
        return Object.entries(groups).filter(([, tabs]) => tabs.length > 0);
    }, [visibleTabs]);
 
    const handleOpenEdit = useCallback(async () => {
        if (!project) return;
        setEditForm({
            name: project.name ?? '', projectCode: project.projectCode ?? '', description: project.description ?? '',
            status: project.status ?? 'PLANNING', progress: project.progress?.toString() ?? '0',
            startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
            endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
            location: project.location ?? '', estimatedDuration: project.estimatedDuration?.toString() ?? '',
            actualDuration: project.actualDuration?.toString() ?? '',
        });
        setEditOpmcId(project.opmcId ?? ''); setEditContractorId(project.contractorId ?? '');
        try {
            const [or, cr] = await Promise.all([fetch('/api/opmcs'), fetch('/api/contractors')]);
            if (or.ok) { const d = await or.json(); setOpmcs(Array.isArray(d) ? d : d.opmcs || d.data || []); }
            if (cr.ok) { const j = await cr.json(); const a = j?.success && j?.data ? j.data : j; setContractors(Array.isArray(a?.contractors) ? a.contractors : []); }
        } catch { toast.error('Failed to load dropdown options'); }
        setEditDialogOpen(true);
    }, [project]);
 
    const selectedOpmcObj = useMemo(() => {
        return opmcs.find(o => o.id === editOpmcId);
    }, [opmcs, editOpmcId]);

    const calculatedEstDuration = useMemo(() => {
        if (!editForm.startDate || !editForm.endDate) return 'TBD';
        const start = new Date(editForm.startDate);
        const end = new Date(editForm.endDate);
        const diffTime = end.getTime() - start.getTime();
        if (isNaN(diffTime)) return 'TBD';
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? `${diffDays} Days` : '0 Days';
    }, [editForm.startDate, editForm.endDate]);

    const handleSaveEdit = useCallback(async () => {
        if (!editForm.name.trim()) { toast.error('Project name is required'); return; }
        setSaving(true);

        let calculatedEst = null;
        if (editForm.startDate && editForm.endDate) {
            const start = new Date(editForm.startDate);
            const end = new Date(editForm.endDate);
            const diffTime = end.getTime() - start.getTime();
            if (!isNaN(diffTime)) {
                calculatedEst = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            }
        }

        try {
            const res = await fetch('/api/projects', { 
                method: 'PATCH', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: project?.id, 
                    name: editForm.name, 
                    projectCode: editForm.projectCode, 
                    description: editForm.description, 
                    status: editForm.status, 
                    location: editForm.location, 
                    startDate: editForm.startDate || null, 
                    endDate: editForm.endDate || null, 
                    estimatedDuration: calculatedEst, 
                    opmcId: editOpmcId || null, 
                    contractorId: editContractorId || null 
                }) 
            });
            if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Failed to update'); return; }
            toast.success('Project updated'); setEditDialogOpen(false); fetchProjectDetails();
        } catch { toast.error('Failed to update project'); }
        finally { setSaving(false); }
    }, [editForm, editOpmcId, editContractorId, project?.id, fetchProjectDetails]);
 
    if (loading) {
        return <div className="min-h-screen flex bg-background text-foreground"><Sidebar /><main className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></main></div>;
    }
    if (!project) {
        return <div className="min-h-screen flex bg-background text-foreground"><Sidebar /><main className="flex-1 flex flex-col items-center justify-center gap-3"><p className="text-muted-foreground text-sm">Project not found</p><Button size="sm" className="h-8 text-xs" onClick={() => router.back()}>Go Back</Button></main></div>;
    }
 
    return (
        <div className="min-h-screen flex bg-background text-foreground">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 bg-background">
                <Header />
 
                {/* Page Header */}
                <div className="bg-card border-b border-border px-3 md:px-6 py-3">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-2">
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground -ml-1 h-7" onClick={() => router.push('/projects')}>
                                <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Projects
                            </Button>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h1 className="text-lg md:text-xl font-bold text-foreground">{project.name}</h1>
                                    <Badge variant="outline" className="text-[10px] border-border px-1.5 py-0 text-foreground">{project.projectCode}</Badge>
                                    <Badge className={`text-[10px] px-1.5 py-0 border ${project.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600 border-green-500/20' : project.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                                        {project.status.replace(/_/g, ' ')}
                                    </Badge>
                                    {project.projectType && (
                                        <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/10 text-primary px-1.5 py-0">
                                            {project.projectType.name.replace(/_/g, ' ')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{project.location || 'No location'}</div>
                                    {project.projectType && <div className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{project.projectType.name.replace(/_/g, ' ')}</div>}
                                    {project.opmc && <div className="flex items-center gap-1"><span className="font-medium text-foreground">OPMC:</span>{project.opmc.rtom}</div>}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs border-emerald-500/20 text-emerald-600 bg-emerald-500/10">
                                    <Cloud className="w-3.5 h-3.5" />Sync QField
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-foreground border-border"><Download className="w-3.5 h-3.5" />Export</Button>
                                <Button variant="outline" size="sm" onClick={() => setGuideDialogOpen(true)} className="gap-1 h-7 text-xs text-foreground border-border"><BookOpen className="w-3.5 h-3.5" />Guide</Button>
                                <Button variant="outline" size="sm" onClick={handleOpenEdit} className="gap-1 h-7 text-xs text-foreground border-border"><Edit2 className="w-3.5 h-3.5" />Edit</Button>
                            </div>
                        </div>
 
                        {/* Team Info Bar */}
                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-start gap-2">
                                <div className="p-1.5 bg-blue-500/10 rounded text-blue-600"><User className="w-4 h-4" /></div>
                                <div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Area Manager</p><p className="text-xs font-medium text-foreground">{project.areaManager?.name || 'Not Assigned'}</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="p-1.5 bg-purple-500/10 rounded text-purple-600"><HardHat className="w-4 h-4" /></div>
                                <div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Contractor</p><p className="text-xs font-medium text-foreground">{project.contractor?.name || 'Not Assigned'}</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-600"><Calendar className="w-4 h-4" /></div>
                                <div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Timeline</p><p className="text-xs font-medium text-foreground">
                                    {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'} — {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}
                                </p></div>
                            </div>
                        </div>
 
                        {/* Stage Info */}
                        {currentStageName && (
                            <div className="mt-2 pt-2 border-t border-border flex items-center gap-2 text-xs">
                                <Workflow className="w-3.5 h-3.5 text-primary" />
                                <span className="text-muted-foreground">Stage:</span>
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">{currentStageName}</Badge>
                                <span className="text-muted-foreground">{visibleTabs.length} modules</span>
                            </div>
                        )}
                    </div>
                </div>
 
                {/* Sub-Sidebar Layout */}
                <div className="flex-1 flex overflow-hidden">
                    <aside className="w-48 border-r border-border bg-card/50 overflow-y-auto flex-shrink-0 hidden md:block">
                        <div className="p-2 space-y-4">
                            {groupedTabs.map(([groupName, tabs]) => (
                                <div key={groupName}>
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-2">{groupName}</h3>
                                    <div className="space-y-0">
                                        {tabs.map(tab => (
                                            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                                                className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded transition-colors ${activeTab === tab.value ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}`}>
                                                {tab.label}
                                                {activeTab === tab.value && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
 
                    {/* Main Content */}
                    <main className="flex-1 p-3 md:p-4 lg:p-6 overflow-y-auto bg-background">
                        <div className="max-w-6xl mx-auto">
                            {/* Mobile Tabs */}
                            <div className="md:hidden mb-3 overflow-x-auto pb-1 flex gap-1.5">
                                {visibleTabs.map(tab => (
                                    <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                                        className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-full border transition-all ${activeTab === tab.value ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border'}`}>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
 
                            {/* Active component */}
                            {visibleTabs.map(tab => {
                                if (tab.value !== activeTab) return null;
                                const Component = TAB_COMPONENTS[tab.value];
                                if (!Component) return null;
                                return (
                                    <div key={tab.value}>
                                        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
                                            <TabErrorBoundary tabLabel={tab.label}>
                                                <Component project={project} projectId={project.id} refreshProject={REFRESH_TABS.has(tab.value) ? fetchProjectDetails : undefined} />
                                            </TabErrorBoundary>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </main>
                </div>
            </main>
 
            {/* Guide Dialog */}
            <Dialog open={guideDialogOpen} onOpenChange={setGuideDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="text-lg">Project Module Guide</DialogTitle><DialogDescription className="text-xs">Complete documentation for all project modules</DialogDescription></DialogHeader>
                    {guideDialogOpen && <ProjectDocumentation project={project} />}
                </DialogContent>
            </Dialog>
 
            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="text-lg">Edit Project Details</DialogTitle><DialogDescription className="text-xs">Update project details below</DialogDescription></DialogHeader>
                     <div className="grid grid-cols-2 gap-3 py-3">
                         <div className="space-y-1.5"><Label className="text-xs font-medium">Project Name *</Label><Input className="h-8 text-xs bg-card border-border text-foreground" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Project name" /></div>
                         <div className="space-y-1.5"><Label className="text-xs font-medium">Project Code *</Label><Input className="h-8 text-xs bg-card border-border text-foreground" value={editForm.projectCode} onChange={e => setEditForm({ ...editForm, projectCode: e.target.value })} placeholder="FOSP_SLTS_2026_002" /></div>
                         
                         <div className="space-y-1.5"><Label className="text-xs font-medium">Status</Label><Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}><SelectTrigger className="h-8 text-xs bg-card border-border text-foreground"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
                         <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Progress (Auto-calculated)</Label><div className="h-8 px-3 flex items-center text-xs font-semibold rounded-md border border-border bg-muted/30 text-foreground">{editForm.progress}%</div></div>
                         
                         <div className="space-y-1.5"><Label className="text-xs font-medium">Start Date</Label><Input className="h-8 text-xs bg-card border-border text-foreground" type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} /></div>
                         <div className="space-y-1.5"><Label className="text-xs font-medium">End Date</Label><Input className="h-8 text-xs bg-card border-border text-foreground" type="date" value={editForm.endDate} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} /></div>
                         
                         <div className="space-y-1.5"><Label className="text-xs font-medium">LEA / Exchange (Location)</Label><Input className="h-8 text-xs bg-card border-border text-foreground" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} placeholder="e.g., Kaduwela Exchange" /></div>
                         <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Est. Duration (Days)</Label><div className="h-8 px-3 flex items-center text-xs rounded-md border border-border bg-muted/30 text-muted-foreground font-medium">{calculatedEstDuration}</div></div>
                         
                         <div className="space-y-1.5"><Label className="text-xs font-medium">OPMC</Label><Select value={editOpmcId || undefined} onValueChange={setEditOpmcId}><SelectTrigger className="h-8 text-xs bg-card border-border text-foreground"><SelectValue placeholder="Select OPMC" /></SelectTrigger><SelectContent>{(opmcs || []).map(o => <SelectItem key={o.id} value={o.id}>{o.rtom} ({o.region})</SelectItem>)}</SelectContent></Select></div>
                         <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Region (Auto-fetched)</Label><div className="h-8 px-3 flex items-center text-xs rounded-md border border-border bg-muted/30 text-muted-foreground font-medium">{selectedOpmcObj ? selectedOpmcObj.region : 'Select OPMC to view'}</div></div>
                         
                         <div className="space-y-1.5"><Label className="text-xs font-medium">Contractor</Label><Select value={editContractorId || undefined} onValueChange={setEditContractorId}><SelectTrigger className="h-8 text-xs bg-card border-border text-foreground"><SelectValue placeholder="Select Contractor" /></SelectTrigger><SelectContent>{(contractors || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                         <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Actual Duration (Days)</Label><div className="h-8 px-3 flex items-center text-xs rounded-md border border-border bg-muted/30 text-muted-foreground">{project.actualDuration ? `${project.actualDuration} Days` : 'TBD (Calculated at closure)'}</div></div>
                         
                         <div className="col-span-2 space-y-1.5"><Label className="text-xs font-medium">Description</Label><Textarea className="text-xs bg-card border-border text-foreground" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Project description..." rows={2} /></div>
                     </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                        <Button size="sm" className="h-8 text-xs" onClick={handleSaveEdit} disabled={saving}>{saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</> : 'Save'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}