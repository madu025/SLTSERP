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
    Plus, Eye, TrendingUp, Clock, CheckCircle2, AlertCircle, PlusCircle,
    Loader2, BookOpen, Trash2, FolderKanban, DollarSign, BarChart2,
    LineChart, ClipboardList, Truck, Search, Filter, MapPin, Building2,
    Calendar, ArrowRight,
} from 'lucide-react';
import ProjectDocumentation from '@/components/projects/ProjectDocumentation';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectType {
    id: string;
    name: string;
    description: string;
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
    _count: {
        boqItems: number;
        milestones: number;
        expenses: number;
    };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
    PLANNING: { label: 'Planning', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', icon: Clock },
    APPROVED: { label: 'Approved', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400', icon: CheckCircle2 },
    IN_PROGRESS: { label: 'In Progress', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: TrendingUp },
    ON_HOLD: { label: 'On Hold', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400', icon: AlertCircle },
    COMPLETED: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400', icon: AlertCircle },
};

const PROGRESS_COLOR = (p: number) =>
    p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-blue-500' : p >= 25 ? 'bg-amber-500' : 'bg-rose-500';

const FILTER_STATUSES = ['ALL', 'PLANNING', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];

const DASHBOARDS = [
    { label: 'PM Dashboard', path: '/projects/dashboards/pm', icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Finance', path: '/projects/dashboards/financials', icon: LineChart, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'QA/QC', path: '/projects/dashboards/qaqc', icon: ClipboardList, color: 'text-purple-600 bg-purple-50' },
    { label: 'Logistics', path: '/projects/dashboards/logistics', icon: Truck, color: 'text-orange-600 bg-orange-50' },
];

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount);

// Computed once at module load — keeps renders pure/deterministic
const TODAY_MS = Date.now();

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProjectCard({ project, onDelete, onView }: {
    project: Project;
    onView: (p: Project) => void;
    onDelete: (p: Project) => void;
}) {
    const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.PLANNING;
    const daysLeft = project.endDate
        ? Math.ceil((new Date(project.endDate).getTime() - TODAY_MS) / 86400000)
        : null;

    return (
        <div className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col">
            {/* Top color strip based on progress */}
            <div className="h-1 w-full">
                <div
                    className={`h-full ${PROGRESS_COLOR(project.progress)} transition-all duration-500`}
                    style={{ width: `${project.progress}%` }}
                />
            </div>

            <div className="p-5 flex flex-col flex-1 gap-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                                {project.projectCode}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                            {project.name}
                        </h3>
                    </div>
                </div>

                {/* Meta info */}
                <div className="space-y-1.5 text-xs text-slate-500">
                    {project.projectType && (
                        <div className="flex items-center gap-1.5">
                            <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{project.projectType.name.replace(/_/g, ' ')}</span>
                        </div>
                    )}
                    {project.location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{project.location}</span>
                        </div>
                    )}
                    {project.opmc && (
                        <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{project.opmc.rtom}</span>
                        </div>
                    )}
                    {project.endDate && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span className={daysLeft !== null && daysLeft < 0 ? 'text-red-500 font-medium' : ''}>
                                {daysLeft !== null && daysLeft < 0
                                    ? `${Math.abs(daysLeft)}d overdue`
                                    : daysLeft === 0 ? 'Due today'
                                        : `${daysLeft}d remaining`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 font-medium">Progress</span>
                        <span className="font-bold text-slate-800">{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${PROGRESS_COLOR(project.progress)}`}
                            style={{ width: `${project.progress}%` }}
                        />
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg py-2">
                        <p className="text-[10px] text-slate-400 font-medium uppercase">BOQ</p>
                        <p className="text-sm font-bold text-slate-800">{project._count.boqItems}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                        <p className="text-[10px] text-slate-400 font-medium uppercase">Miles</p>
                        <p className="text-sm font-bold text-slate-800">{project._count.milestones}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                        <p className="text-[10px] text-slate-400 font-medium uppercase">Budget</p>
                        <p className="text-xs font-bold text-slate-800 truncate px-1">
                            {project.budget ? `LKR ${(project.budget / 1_000_000).toFixed(1)}M` : 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-auto pt-1">
                    <Button
                        size="sm"
                        className="flex-1 gap-1.5 text-xs h-8"
                        onClick={() => onView(project)}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Open
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                        onClick={() => onDelete(project)}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
    const router = useRouter();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [guideDialogOpen, setGuideDialogOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);

    const [newProject, setNewProject] = useState({
        projectCode: '', name: '', description: '', type: 'OSP_FTTH',
        location: '', budget: '', startDate: '', endDate: '', projectTypeId: ''
    });

    // Add Project Type dialog
    const [newTypeDialogOpen, setNewTypeDialogOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeDescription, setNewTypeDescription] = useState('');
    const [creatingType, setCreatingType] = useState(false);

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchProjectTypes = useCallback(async () => {
        try {
            const res = await fetch('/api/projects/types');
            if (res.ok) setProjectTypes(await res.json());
        } catch { /* silent */ }
    }, []);

    const fetchProjects = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);
            const res = await fetch(`/api/projects?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            setProjects(await res.json());
        } catch {
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchProjects(); fetchProjectTypes(); }, [fetchProjects, fetchProjectTypes]);

    // ── Derived data ──────────────────────────────────────────────────────────

    const filtered = projects.filter(p =>
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
    const avgProgress = projects.length > 0
        ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;
    const inProgressCount = projects.filter(p => p.status === 'IN_PROGRESS').length;
    const selectedProjectType = projectTypes.find(pt => pt.id === newProject.projectTypeId);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleCreate = async () => {
        if (!newProject.name.trim() || !newProject.projectCode.trim()) {
            toast.error('Project Code and Name are required');
            return;
        }
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject),
            });
            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'Failed to create project');
                return;
            }
            toast.success('Project created successfully');
            setCreateDialogOpen(false);
            setNewProject({ projectCode: '', name: '', description: '', type: 'OSP_FTTH', location: '', budget: '', startDate: '', endDate: '', projectTypeId: '' });
            fetchProjects();
        } catch {
            toast.error('Failed to create project');
        }
    };

    const handleDelete = async () => {
        if (!projectToDelete) return;
        try {
            setDeleting(true);
            const res = await fetch(`/api/projects/${projectToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'Failed to delete project');
                return;
            }
            toast.success('Project deleted');
            setDeleteDialogOpen(false);
            setProjectToDelete(null);
            fetchProjects();
        } catch {
            toast.error('Failed to delete project');
        } finally {
            setDeleting(false);
        }
    };

    const handleAddProjectType = async () => {
        if (!newTypeName.trim()) { toast.error('Please enter a project type name'); return; }
        try {
            setCreatingType(true);
            const res = await fetch('/api/projects/types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTypeName.trim(), description: newTypeDescription.trim() }),
            });
            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'Failed to create project type');
                return;
            }
            const created = await res.json();
            setNewProject(prev => ({ ...prev, projectTypeId: created.id }));
            setNewTypeDialogOpen(false);
            setNewTypeName('');
            setNewTypeDescription('');
            fetchProjectTypes();
        } catch {
            toast.error('Failed to create project type');
        } finally {
            setCreatingType(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────

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

    return (
        <div className="min-h-screen flex bg-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 bg-slate-50/60">
                <Header />

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">

                        {/* ── Page Header ── */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Project Management</h1>
                                <p className="text-sm text-slate-500 mt-0.5">OSP construction projects — full lifecycle tracking</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setGuideDialogOpen(true)} className="gap-1.5">
                                    <BookOpen className="w-4 h-4" />
                                    Guide
                                </Button>
                                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    New Project
                                </Button>
                            </div>
                        </div>

                        {/* ── KPI Stat Cards ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Projects', value: projects.length, icon: FolderKanban, color: 'text-blue-600 bg-blue-50' },
                                { label: 'In Progress', value: inProgressCount, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
                                { label: 'Total Budget', value: formatCurrency(totalBudget), icon: DollarSign, color: 'text-violet-600 bg-violet-50' },
                                { label: 'Avg Progress', value: `${avgProgress.toFixed(0)}%`, icon: BarChart2, color: 'text-amber-600 bg-amber-50' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                                        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Dashboard Quick-Links ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {DASHBOARDS.map(({ label, path, icon: Icon, color }) => (
                                <Link
                                    key={path}
                                    href={path}
                                    className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all group"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{label}</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto group-hover:text-slate-600 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            ))}
                        </div>

                        {/* ── Filters + Search ── */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search projects..."
                                    className="pl-9 bg-white"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Filter className="w-4 h-4 text-slate-400" />
                                {FILTER_STATUSES.map((s) => {
                                    const cfg = s === 'ALL' ? null : STATUS_CONFIG[s];
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => setStatusFilter(s)}
                                            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${statusFilter === s
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                                }`}
                                        >
                                            {cfg ? cfg.label : 'All'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Project Cards Grid ── */}
                        {filtered.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
                                <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No projects found</p>
                                <p className="text-sm text-slate-400 mt-1">
                                    {searchQuery ? 'Try a different search term' : 'Create a new project to get started'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filtered.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        onView={(p) => router.push(`/projects/${p.id}`)}
                                        onDelete={(p) => { setProjectToDelete(p); setDeleteDialogOpen(true); }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ── Create Project Dialog ── */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>Enter project details below</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Project Code *</Label>
                            <Input value={newProject.projectCode} onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })} placeholder="PRJ-2026-001" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Project Type (Workflow)</Label>
                                <button type="button" onClick={() => setNewTypeDialogOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                    <PlusCircle className="w-3 h-3" />Add New
                                </button>
                            </div>
                            <Select value={newProject.projectTypeId} onValueChange={(v) => setNewProject({ ...newProject, projectTypeId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select project type..." /></SelectTrigger>
                                <SelectContent>
                                    {projectTypes.map((pt) => (
                                        <SelectItem key={pt.id} value={pt.id}>{pt.name.replace(/_/g, ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedProjectType && <p className="text-xs text-slate-500 mt-1">Workflow: {selectedProjectType.description}</p>}
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Project Name *</Label>
                            <Input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="Project name" />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Description</Label>
                            <Textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Project description..." rows={3} />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Location</Label>
                            <Input value={newProject.location} onChange={(e) => setNewProject({ ...newProject, location: e.target.value })} placeholder="Project location" />
                        </div>
                        <div className="space-y-2">
                            <Label>Budget (LKR)</Label>
                            <Input type="number" value={newProject.budget} onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" value={newProject.startDate} onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" value={newProject.endDate} onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create Project</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Guide Dialog ── */}
            <Dialog open={guideDialogOpen} onOpenChange={setGuideDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Project Module Guide</DialogTitle>
                        <DialogDescription>Complete A-to-Z documentation for all project modules</DialogDescription>
                    </DialogHeader>
                    {guideDialogOpen && <ProjectDocumentation project={undefined as never} />}
                </DialogContent>
            </Dialog>

            {/* ── Add Project Type Dialog ── */}
            <Dialog open={newTypeDialogOpen} onOpenChange={setNewTypeDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Project Type</DialogTitle>
                        <DialogDescription>Create a new workflow project type</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Type Name *</Label>
                            <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="e.g., OSP_FTTH, FIBER_BACKBONE" />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={newTypeDescription} onChange={(e) => setNewTypeDescription(e.target.value)} placeholder="Brief description..." rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewTypeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddProjectType} disabled={creatingType}>
                            {creatingType ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Type'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation Dialog ── */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="w-5 h-5" />Delete Project
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. All BOQ items, milestones, expenses, documents, and workflow data will be permanently removed.
                        </DialogDescription>
                    </DialogHeader>
                    {projectToDelete && (
                        <div className="py-2 space-y-1 bg-red-50 rounded-lg p-3 border border-red-200">
                            <p className="text-sm font-semibold text-slate-900">{projectToDelete.name}</p>
                            <p className="text-xs text-slate-500">Code: {projectToDelete.projectCode}</p>
                            <p className="text-xs text-slate-500">Status: {projectToDelete.status?.replace(/_/g, ' ')}</p>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
                            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete Project</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}