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
import { Plus, Eye, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

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
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [newProject, setNewProject] = useState({
        projectCode: '',
        name: '',
        description: '',
        type: 'FTTH',
        location: '',
        budget: '',
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        fetchProjects();
    }, [statusFilter]);

    const fetchProjects = async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);

            const res = await fetch(`/api/projects?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setProjects(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject)
            });

            if (!res.ok) {
                const error = await res.json();
                alert(error.error || 'Failed to create project');
                return;
            }

            setCreateDialogOpen(false);
            setNewProject({
                projectCode: '',
                name: '',
                description: '',
                type: 'FTTH',
                location: '',
                budget: '',
                startDate: '',
                endDate: ''
            });
            fetchProjects();
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to create project');
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
                {status.replace('_', ' ')}
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
                            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                <Plus className="w-4 h-4" />
                                New Project
                            </Button>
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
                                    {status.replace('_', ' ')}
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
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <Badge variant="outline">{project.type}</Badge>
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
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => router.push(`/projects/${project.id}`)}
                                                        className="gap-1"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View
                                                    </Button>
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
                            <Label>Project Type</Label>
                            <Select
                                value={newProject.type}
                                onValueChange={(value) => setNewProject({ ...newProject, type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FTTH">FTTH</SelectItem>
                                    <SelectItem value="FAC">FAC</SelectItem>
                                    <SelectItem value="BUILDING">Building</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
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
        </div>
    );
}
