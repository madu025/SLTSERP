"use client";
 
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Plus, Search, Loader2, Trash2, FolderKanban, TrendingUp, Clock,
    CheckCircle2, AlertCircle, Eye, BookOpen, PlusCircle, ArrowRight,
} from 'lucide-react';
import ProjectDocumentation from '@/components/projects/ProjectDocumentation';
import { toast } from 'sonner';
 
// ─── Types ───────────────────────────────────────────────────────────────────
interface ProjectType {
    id: string;
    name: string;
    description: string;
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
interface Project {
    id: string;
    projectCode: string;
    name: string;
    type: string;
    status: string;
    progress: number;
    budget: number | null;
    actualCost: number;
    startDate: string | null;
    endDate: string | null;
    location?: string;
    opmc?: { id: string; rtom: string };
    contractor?: { id: string; name: string };
    projectType?: { id: string; name: string; description: string };
    gisMapping?: { qfieldProjectId?: string } | null;
    _count: { boqItems: number; milestones: number; expenses: number };
}
 
// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
    PLANNING: { label: 'Planning', dot: 'bg-amber-400', icon: Clock },
    APPROVED: { label: 'Approved', dot: 'bg-blue-400', icon: CheckCircle2 },
    IN_PROGRESS: { label: 'In Progress', dot: 'bg-emerald-500', icon: TrendingUp },
    ON_HOLD: { label: 'On Hold', dot: 'bg-orange-400', icon: AlertCircle },
    COMPLETED: { label: 'Completed', dot: 'bg-green-500', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', dot: 'bg-red-400', icon: AlertCircle },
};
const PROGRESS_COLOR = (p: number) =>
    p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-blue-500' : p >= 25 ? 'bg-amber-500' : 'bg-rose-500';
const FILTER_STATUSES = ['ALL', 'PLANNING', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount);
 
const TODAY_MS = Date.now();
 
const DASHBOARDS = [
    { label: 'PM', path: '/projects/dashboards/pm' },
    { label: 'Finance', path: '/projects/dashboards/financials' },
    { label: 'QA/QC', path: '/projects/dashboards/qaqc' },
    { label: 'Logistics', path: '/projects/dashboards/logistics' },
];
 
// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [guideDialogOpen, setGuideDialogOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [opmcFilter, setOpmcFilter] = useState('ALL');
    const [contractorFilter, setContractorFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
    const [opmcs, setOpmcs] = useState<OPMCOption[]>([]);
    const [contractors, setContractors] = useState<ContractorOption[]>([]);
    const [newProject, setNewProject] = useState({
        projectCode: '', name: '', projectTypeId: ''
    });
    const [newTypeDialogOpen, setNewTypeDialogOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeDescription, setNewTypeDescription] = useState('');
    const [creatingType, setCreatingType] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState(false);
 
    // Debounce search query to prevent excessive API calls
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Reset to page 1 when status, region, or contractor filters change
    useEffect(() => {
        setPage(1);
    }, [statusFilter, opmcFilter, contractorFilter]);

    // ── Data fetching ─────────────────────────────────────────────────────────
    const fetchProjectTypes = useCallback(async () => {
        try {
            const res = await fetch('/api/projects/types');
            if (res.ok) {
                const data = await res.json();
                setProjectTypes(Array.isArray(data) ? data : data.types || data.data || []);
            }
        } catch { /* silent */ }
    }, []);
 
    const fetchDropdowns = useCallback(async () => {
        try {
            const [opmcRes, contractorRes] = await Promise.all([fetch('/api/opmcs'), fetch('/api/contractors')]);
            if (opmcRes.ok) { const d = await opmcRes.json(); setOpmcs(Array.isArray(d) ? d : d.opmcs || d.data || []); }
            if (contractorRes.ok) {
                const j = await contractorRes.json();
                const actual = j?.success && j?.data ? j.data : j;
                setContractors(Array.isArray(actual?.contractors) ? actual.contractors : []);
            }
        } catch { /* silent */ }
    }, []);
 
    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);
            if (opmcFilter !== 'ALL') params.append('opmcId', opmcFilter);
            if (contractorFilter !== 'ALL') params.append('contractorId', contractorFilter);
            params.append('page', page.toString());
            params.append('limit', limit.toString());
            if (debouncedSearch) params.append('search', debouncedSearch);

            const res = await fetch(`/api/projects?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();

            if (data && typeof data === 'object' && 'projects' in data) {
                setProjects(data.projects || []);
                setTotalPages(data.totalPages || 1);
                setTotalCount(data.total || 0);
            } else {
                const arr = Array.isArray(data) ? data : data.projects || data.data || [];
                setProjects(arr);
                setTotalPages(1);
                setTotalCount(arr.length);
            }
        } catch { 
            toast.error('Failed to load projects'); 
        } finally { 
            setLoading(false); 
        }
    }, [statusFilter, opmcFilter, contractorFilter, page, limit, debouncedSearch]);
 
    useEffect(() => { fetchProjects(); fetchProjectTypes(); fetchDropdowns(); }, [fetchProjects, fetchProjectTypes, fetchDropdowns]);
 
    // ── Derived data ──────────────────────────────────────────────────────────
    const filtered = projects.filter(p =>
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
    const inProgressCount = projects.filter(p => p.status === 'IN_PROGRESS').length;
    const selectedProjectType = projectTypes.find(pt => pt.id === newProject.projectTypeId);
 
    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!newProject.name.trim() || !newProject.projectCode.trim()) { toast.error('Project Code and Name are required'); return; }
        try {
            const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProject) });
            if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Failed'); return; }
            toast.success('Project created');
            setCreateDialogOpen(false);
            setNewProject({ projectCode: '', name: '', projectTypeId: '' });
            fetchProjects();
        } catch { toast.error('Failed to create project'); }
    };
 
    const handleDelete = async () => {
        if (!projectToDelete) return;
        try {
            setDeleting(true);
            const res = await fetch(`/api/projects/${projectToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Failed'); return; }
            toast.success('Project deleted');
            setDeleteDialogOpen(false); setProjectToDelete(null); fetchProjects();
        } catch { toast.error('Failed to delete project'); }
        finally { setDeleting(false); }
    };
 
    const handleAddProjectType = async () => {
        if (!newTypeName.trim()) { toast.error('Enter a name'); return; }
        try {
            setCreatingType(true);
            const res = await fetch('/api/projects/types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTypeName.trim(), description: newTypeDescription.trim() }) });
            if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Failed'); return; }
            const created = await res.json();
            setNewProject(prev => ({ ...prev, projectTypeId: created.id }));
            setNewTypeDialogOpen(false); setNewTypeName(''); setNewTypeDescription(''); fetchProjectTypes();
        } catch { toast.error('Failed'); }
        finally { setCreatingType(false); }
    };
 
    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen flex bg-background text-foreground">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
                </main>
            </div>
        );
    }
 
    return (
        <div className="min-h-screen flex bg-background text-foreground">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 bg-background">
                <Header />
 
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-6 py-3 space-y-3">
 
                        {/* Page Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h1 className="text-lg font-bold text-foreground">Projects</h1>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {totalCount} projects · Page {page} of {totalPages}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setGuideDialogOpen(true)} className="gap-1.5 h-8 text-xs">
                                    <BookOpen className="w-3.5 h-3.5" />Guide
                                </Button>
                                <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5 h-8 text-xs">
                                    <Plus className="w-3.5 h-3.5" />New Project
                                </Button>
                            </div>
                        </div>
 
                        {/* Dashboard Quick-Links */}
                        <div className="flex gap-2 flex-wrap">
                            {DASHBOARDS.map(({ label, path }) => (
                                <Link key={path} href={path}
                                    className="flex items-center gap-1.5 bg-card rounded border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/50 transition-all shadow-xs">
                                    {label}
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            ))}
                        </div>
 
                        {/* Filters + Search */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1 sm:max-w-xs">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search projects..." className="pl-8 h-8 text-xs bg-card border-border text-foreground" />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Select value={opmcFilter} onValueChange={setOpmcFilter}>
                                    <SelectTrigger className="w-[120px] h-8 text-xs bg-card border-border text-foreground"><SelectValue placeholder="All Regions" /></SelectTrigger>
                                    <SelectContent>{['ALL', ...(opmcs || []).map(o => o.id)].map(id =>
                                        <SelectItem key={id} value={id}>{id === 'ALL' ? 'All Regions' : opmcs.find(o => o.id === id)?.rtom}</SelectItem>
                                    )}</SelectContent>
                                </Select>
                                <Select value={contractorFilter} onValueChange={setContractorFilter}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border text-foreground"><SelectValue placeholder="All Contractors" /></SelectTrigger>
                                    <SelectContent>{['ALL', ...(contractors || []).map(c => c.id)].map(id =>
                                        <SelectItem key={id} value={id}>{id === 'ALL' ? 'All Contractors' : contractors.find(c => c.id === id)?.name}</SelectItem>
                                    )}</SelectContent>
                                </Select>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-[110px] h-8 text-xs bg-card border-border text-foreground"><SelectValue placeholder="All Status" /></SelectTrigger>
                                    <SelectContent>{FILTER_STATUSES.map(s =>
                                        <SelectItem key={s} value={s}>{s === 'ALL' ? 'All Status' : STATUS_CONFIG[s]?.label}</SelectItem>
                                    )}</SelectContent>
                                </Select>
                            </div>
                        </div>
 
                        {/* Project Table */}
                        {filtered.length === 0 ? (
                            <div className="bg-card rounded-lg border border-border py-12 text-center shadow-xs">
                                <FolderKanban className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-foreground font-medium">No projects found</p>
                                <p className="text-xs text-muted-foreground mt-1">{searchQuery ? 'Try a different search term' : 'Create a new project to get started'}</p>
                            </div>
                        ) : (
                            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/30">
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Project</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] hidden md:table-cell">Location</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] hidden lg:table-cell">OPMC</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Status</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] hidden sm:table-cell">Progress</th>
                                                <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] hidden md:table-cell">Budget</th>
                                                <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[80px]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {filtered.map((project) => {
                                                const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.PLANNING;
                                                const daysLeft = project.endDate
                                                    ? Math.ceil((new Date(project.endDate).getTime() - TODAY_MS) / 86400000)
                                                    : null;
                                                const isQfieldReady = !!project.gisMapping?.qfieldProjectId;
 
                                                return (
                                                    <tr key={project.id}
                                                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                                                        onClick={() => router.push(`/projects/${project.id}`)}>
                                                        {/* Project Name + Code */}
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">{project.projectCode}</span>
                                                                <span className="font-medium text-foreground truncate max-w-[180px]">{project.name}</span>
                                                            </div>
                                                        </td>
                                                        {/* Location */}
                                                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px] hidden md:table-cell">
                                                            {project.location || '—'}
                                                        </td>
                                                        {/* OPMC */}
                                                        <td className="px-3 py-2 hidden lg:table-cell">
                                                            <span className="text-foreground">{project.opmc?.rtom || '—'}</span>
                                                            {project.contractor && <span className="text-muted-foreground ml-1">· {project.contractor.name}</span>}
                                                        </td>
                                                        {/* Status */}
                                                        <td className="px-3 py-2">
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                                <span className="text-muted-foreground">{cfg.label}</span>
                                                            </span>
                                                            {isQfieldReady && (
                                                                <span className="ml-2 text-[10px] text-emerald-600 font-medium bg-emerald-500/10 px-1 py-0.5 rounded">QField</span>
                                                            )}
                                                        </td>
                                                        {/* Progress */}
                                                        <td className="px-3 py-2 hidden sm:table-cell">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                    <div className={`h-full rounded-full ${PROGRESS_COLOR(project.progress)}`}
                                                                        style={{ width: `${project.progress}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-medium text-muted-foreground">{project.progress}%</span>
                                                            </div>
                                                        </td>
                                                        {/* Budget */}
                                                        <td className="px-3 py-2 text-right font-medium text-foreground hidden md:table-cell">
                                                            {project.budget ? `LKR ${(project.budget / 1_000_000).toFixed(1)}M` : 'N/A'}
                                                            {daysLeft !== null && (
                                                                <span className={`block text-[10px] ${daysLeft < 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                                                    {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                                                                </span>
                                                            )}
                                                        </td>
                                                        {/* Actions */}
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1"
                                                                onClick={(e) => e.stopPropagation()}>
                                                                <Button size="sm" variant="ghost"
                                                                    onClick={() => router.push(`/projects/${project.id}`)}
                                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-muted"
                                                                    title="Open">
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost"
                                                                    onClick={() => { setProjectToDelete(project); setDeleteDialogOpen(true); }}
                                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                                    title="Delete">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-t border-border text-xs">
                                        <div className="text-muted-foreground">
                                            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> (<strong>{totalCount}</strong> total projects)
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs bg-card"
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs bg-card"
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page === totalPages}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
 
             {/* ── Create Project Dialog ── */}
             <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                 <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                     <DialogHeader>
                         <DialogTitle className="text-lg">Create New Project</DialogTitle>
                         <DialogDescription className="text-xs">Enter project details below</DialogDescription>
                     </DialogHeader>
                     <div className="grid grid-cols-2 gap-3 py-3">
                         <div className="space-y-1.5">
                             <Label className="text-xs">Project Code *</Label>
                             <Input className="h-8 text-xs bg-card border-border text-foreground" value={newProject.projectCode} onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })} placeholder="PRJ-2026-001" />
                         </div>
                         <div className="space-y-1.5">
                             <div className="flex items-center justify-between">
                                 <Label className="text-xs">Project Type</Label>
                                 <button type="button" onClick={() => setNewTypeDialogOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                                     <PlusCircle className="w-3 h-3" />Add
                                 </button>
                             </div>
                             <Select value={newProject.projectTypeId || undefined} onValueChange={(v) => setNewProject({ ...newProject, projectTypeId: v })}>
                                 <SelectTrigger className="h-8 text-xs bg-card border-border text-foreground"><SelectValue placeholder="Select type..." /></SelectTrigger>
                                 <SelectContent>{(projectTypes || []).map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                             </Select>
                             {selectedProjectType && <p className="text-[10px] text-muted-foreground mt-0.5">Workflow: {selectedProjectType.description}</p>}
                         </div>
                         <div className="col-span-2 space-y-1.5">
                             <Label className="text-xs">Project Name *</Label>
                             <Input className="h-8 text-xs bg-card border-border text-foreground" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="Project name" />
                         </div>
                     </div>
                     <DialogFooter className="gap-2">
                         <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                         <Button size="sm" className="h-8 text-xs" onClick={handleCreate}>Create Project</Button>
                     </DialogFooter>
                 </DialogContent>
             </Dialog>
 
            {/* ── Guide Dialog ── */}
            <Dialog open={guideDialogOpen} onOpenChange={setGuideDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg">Project Module Guide</DialogTitle>
                        <DialogDescription className="text-xs">Complete documentation for all project modules</DialogDescription>
                    </DialogHeader>
                    {guideDialogOpen && <ProjectDocumentation project={undefined as never} />}
                </DialogContent>
            </Dialog>
 
            {/* ── Add Project Type Dialog ── */}
            <Dialog open={newTypeDialogOpen} onOpenChange={setNewTypeDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg">Add New Project Type</DialogTitle>
                        <DialogDescription className="text-xs">Create a new workflow project type</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Type Name *</Label>
                            <Input className="h-8 text-xs bg-card border-border text-foreground" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="e.g., OSP_FTTH" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Textarea className="text-xs bg-card border-border text-foreground" value={newTypeDescription} onChange={(e) => setNewTypeDescription(e.target.value)} placeholder="Brief description..." rows={2} />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setNewTypeDialogOpen(false)}>Cancel</Button>
                        <Button size="sm" className="h-8 text-xs" onClick={handleAddProjectType} disabled={creatingType}>
                            {creatingType ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating...</> : 'Create Type'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
 
            {/* ── Delete Dialog ── */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-1.5 text-base">
                            <Trash2 className="w-4 h-4" />Delete Project
                        </DialogTitle>
                        <DialogDescription className="text-xs">This cannot be undone. All data will be permanently removed.</DialogDescription>
                    </DialogHeader>
                    {projectToDelete && (
                        <div className="py-2 bg-destructive/10 text-destructive rounded border border-destructive/20 p-2 text-xs">
                            <p className="font-semibold">{projectToDelete.name}</p>
                            <p className="text-muted-foreground mt-0.5">Code: {projectToDelete.projectCode} · Status: {projectToDelete.status?.replace(/_/g, ' ')}</p>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
                        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleDelete} disabled={deleting}>
                            {deleting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting...</> : <><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}