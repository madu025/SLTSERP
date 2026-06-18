"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, TrendingUp, Clock, CheckCircle2, AlertCircle, PlusCircle, Loader2, X, BookOpen, Trash2 } from 'lucide-react';
import ProjectDocumentation from '@/components/projects/ProjectDocumentation';

import { toast } from 'sonner';
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
    opmc?: { id: string; rtom: string };
    contractor?: { id: string; name: string };
    projectType?: { id: string; name: string; description: string };
    _count: {
        boqItems: number;
        milestones: number;
        expenses: number;
    };
}

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [guideDialogOpen, setGuideDialogOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);

    const [newProject, setNewProject] = useState({
        projectCode: '',
        name: '',
        description: '',
        type: 'OSP_FTTH',
        location: '',
        budget: '',
        startDate: '',
        endDate: '',
        projectTypeId: ''
    });

    useEffect(() => {
        fetchProjects();
        fetchProjectTypes();
    }, [statusFilter]);

    const fetchProjectTypes = async () => {
        try {
            const res = await fetch('/api/projects/types');
            if (res.ok) {
                const data = await res.json();
                setProjectTypes(data);
            }
        } catch (error) {
}
    };

    // Add New Project Type dialog state
    const [newTypeDialogOpen, setNewTypeDialogOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeDescription, setNewTypeDescription] = useState('');
    const [creatingType, setCreatingType] = useState(false);

    // Delete Project state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleAddProjectType = async () => {
        if (!newTypeName.trim()) {
            toast.error('Please enter a project type name');
            return;
        }
        try {
            setCreatingType(true);
            const res = await fetch('/api/projects/types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newTypeName.trim(),
                    description: newTypeDescription.trim()
                })
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
        } catch (error) {
toast.error('Failed to create project type');
        } finally {
            setCreatingType(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);

            const res = await fetch(`/api/projects?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setProjects(data);
        } catch (error) {
} finally {
            setLoading(false);
        }
    };

    // Get the selected project type details
    const selectedProjectType = projectTypes.find(pt => pt.id === newProject.projectTypeId);

    const handleCreate = async () => {
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject)
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'Failed to create project');
                return;
            }

            setCreateDialogOpen(false);
            setNewProject({
                projectCode: '',
                name: '',
                description: '',
                type: 'OSP_FTTH',
                location: '',
                budget: '',
                startDate: '',
                endDate: '',
                projectTypeId: ''
            });
            fetchProjects();
        } catch (error) {
toast.error('Failed to create project');
        }
    };

    const handleDelete = async () => {
        if (!projectToDelete) return;
        try {
            setDeleting(true);
            const res = await fetch(`/api/projects/${projectToDelete.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || 'Failed to delete project');
                return;
            }

            setDeleteDialogOpen(false);
            setProjectToDelete(null);
            fetchProjects();
        } catch (error) {
toast.error('Failed to delete project');
        } finally {
            setDeleting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const config: Record<string, { className: string; icon: any }> = {
            PLANNING: { className: 'bg-yellow-100 text-yellow-700', icon: Clock },
            APPROVED: { className: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
            IN_PROGRESS: { className: 'bg-green-100 text-green-700', icon: TrendingUp },
            ON_HOLD: { className: 'bg-orange-100 text-orange-700', icon: AlertCircle },
            COMPLETED: { className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
            CANCELLED: { className: 'bg-red-100 text-red-700', icon: AlertCircle }
        };

        const { className, icon: Icon } = config[status] || config.PLANNING;
        return (
            <Badge className={className}>
                <Icon className="w-3 h-3 mr-1" />
                {status.replace(/_/g, ' ')}
            </Badge>
        );
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalActual = projects.reduce((sum, p) => sum + p.actualCost, 0);
    const avgProgress = projects.length > 0
        ? projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
        : 0;

    if (loading) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Project Management</h1>
                                <p className="text-sm text-slate-500 mt-1">Manage construction projects and BOQ</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setGuideDialogOpen(true)}
                                    className="gap-1.5"
                                >
                                    <BookOpen className="w-4 h-4" />
                                    Guide
                                </Button>
                                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    New Project
                                </Button>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Total Projects</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{projects.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Total Budget</p>
                                <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalBudget)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Actual Cost</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalActual)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs font-medium text-slate-500 uppercase">Avg Progress</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{avgProgress.toFixed(0)}%</p>
                            </div>
                        </div>

                        {/* Filters  */}
                        <div className="flex flex-wrap gap-2">
                            {['ALL', 'PLANNING', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'].map((status) => (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status.replace(/_/g, ' ')}
                                </Button>
                            ))}
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <ResponsiveTable>
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Project Name</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Progress</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Budget</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">BOQ Items</th>
                                            <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {projects.map((project) => (
                                            <tr key={project.id} className="hover:bg-slate-50">
                                                <td className="px-4 md:px-6 py-4 text-sm font-medium text-slate-900">
                                                    {project.projectCode}
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                                                        {project.opmc && (
                                                            <p className="text-xs text-slate-500">{project.opmc.rtom}</p>
                                                        )}
                                                        {project.projectType && (
                                                            <p className="text-xs text-blue-500">{project.projectType.name}</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <Badge variant="outline">
                                                        {project.projectType?.name?.replace(/_/g, ' ') || project.type?.replace(/_/g, ' ') || 'N/A'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    {getStatusBadge(project.status)}
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                                                            <div
                                                                className="bg-primary h-2 rounded-full"
                                                                style={{ width: `${project.progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">{project.progress}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-900">
                                                    {project.budget ? formatCurrency(project.budget) : '-'}
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-sm text-slate-600">
                                                    {project._count.boqItems} items
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="flex gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => router.push(`/projects/${project.id}`)}
                                                            className="gap-1"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            View
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setProjectToDelete(project);
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ResponsiveTable>

                            {projects.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-slate-500">No projects found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Project Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>Enter project details below</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Project Code *</Label>
                            <Input
                                value={newProject.projectCode}
                                onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })}
                                placeholder="PRJ-2026-001"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Project Type (Workflow)</Label>
                                <button
                                    type="button"
                                    onClick={() => setNewTypeDialogOpen(true)}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                    <PlusCircle className="w-3 h-3" />
                                    Add New
                                </button>
                            </div>
                            <Select
                                value={newProject.projectTypeId}
                                onValueChange={(value) => setNewProject({ ...newProject, projectTypeId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select project type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {projectTypes.map((pt) => (
                                        <SelectItem key={pt.id} value={pt.id}>
                                            {pt.name.replace(/_/g, ' ')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedProjectType && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Workflow: {selectedProjectType.description}
                                </p>
                            )}
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Project Name *</Label>
                            <Input
                                value={newProject.name}
                                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                placeholder="Project name"
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={newProject.description}
                                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                placeholder="Project description..."
                                rows={3}
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Location</Label>
                            <Input
                                value={newProject.location}
                                onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                                placeholder="Project location"
                            />
                        </div>
                        {/* OSP Type field removed - use Project Type (Workflow) instead */}
                        <div className="space-y-2">
                            <Label>Budget (LKR)</Label>
                            <Input
                                type="number"
                                value={newProject.budget}
                                onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={newProject.startDate}
                                onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                                type="date"
                                value={newProject.endDate}
                                onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate}>
                            Create Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Guide Documentation Modal */}
            <Dialog open={guideDialogOpen} onOpenChange={setGuideDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl">📖 Project Module Guide</DialogTitle>
                        <DialogDescription>
                            Complete A-to-Z documentation for all project modules and features
                        </DialogDescription>
                    </DialogHeader>
                    <ProjectDocumentation />
                </DialogContent>
            </Dialog>

            {/* Add New Project Type Dialog */}
            <Dialog open={newTypeDialogOpen} onOpenChange={setNewTypeDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Project Type</DialogTitle>
                        <DialogDescription>Create a new workflow project type</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Type Name *</Label>
                            <Input
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                placeholder="e.g., OSP_FTTH, FIBER_BACKBONE"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={newTypeDescription}
                                onChange={(e) => setNewTypeDescription(e.target.value)}
                                placeholder="Brief description of this project type..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewTypeDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddProjectType} disabled={creatingType}>
                            {creatingType ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Type'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="w-5 h-5" />
                            Delete Project
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this project? This action cannot be undone.
                            All related data including BOQ items, milestones, expenses, documents, and workflow will be permanently removed.
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
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="gap-2"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Delete Project
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}