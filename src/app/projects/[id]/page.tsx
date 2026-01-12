"use client";

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, MapPin, Building2, User, Phone, Mail } from 'lucide-react';
import ProjectOverview from '@/components/projects/ProjectOverview';
import ProjectBOQ from '@/components/projects/ProjectBOQ';
import ProjectMilestones from '@/components/projects/ProjectMilestones';
import ProjectExpenses from '@/components/projects/ProjectExpenses';
import ProjectMaterialIssues from '@/components/projects/ProjectMaterialIssues';

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        fetchProjectDetails();
    }, [id]);

    const fetchProjectDetails = async () => {
        try {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setProject(data);
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            setLoading(false);
        }
    };

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
                                    <Badge className={
                                        project.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                            project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                'bg-yellow-100 text-yellow-700'
                                    }>
                                        {project.status.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4" />
                                        {project.location || 'No location set'}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Building2 className="w-4 h-4" />
                                        {project.type}
                                    </div>
                                    {project.opmc && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-slate-700">OPMC:</span>
                                            {project.opmc.rtom}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline">Edit Details</Button>
                                {/* Additional Actions */}
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
                                    <HardHatIcon className="w-5 h-5" />
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
                                        {' - '}
                                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Tabs */}
                <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                            <TabsList className="bg-white border border-slate-200 p-1 w-full md:w-auto overflow-x-auto flex justify-start h-auto">
                                <TabsTrigger value="overview" className="px-4 py-2">Overview</TabsTrigger>
                                <TabsTrigger value="boq" className="px-4 py-2">BOQ & Material</TabsTrigger>
                                <TabsTrigger value="materials" className="px-4 py-2">Material Issues</TabsTrigger>
                                <TabsTrigger value="milestones" className="px-4 py-2">Milestones</TabsTrigger>
                                <TabsTrigger value="expenses" className="px-4 py-2">Expenses</TabsTrigger>
                                <TabsTrigger value="sods" className="px-4 py-2">Service Orders</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview">
                                <ProjectOverview project={project} />
                            </TabsContent>

                            <TabsContent value="boq">
                                <ProjectBOQ project={project} refreshProject={fetchProjectDetails} />
                            </TabsContent>

                            <TabsContent value="materials">
                                <ProjectMaterialIssues project={project} refreshProject={fetchProjectDetails} />
                            </TabsContent>

                            <TabsContent value="milestones">
                                <ProjectMilestones project={project} refreshProject={fetchProjectDetails} />
                            </TabsContent>

                            <TabsContent value="expenses">
                                <ProjectExpenses project={project} refreshProject={fetchProjectDetails} />
                            </TabsContent>

                            <TabsContent value="sods">
                                <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
                                    <p className="text-slate-500">Service Orders Integration coming soon...</p>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Simple Icon wrapper for HardHat since it was imported as User in some places? 
// No, I'll just use a local SVG or Lucide Icon.
function HardHatIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3z" />
            <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
            <path d="M4 15v-3a6 6 0 0 1 6-6h0" />
            <path d="M14 6h0a6 6 0 0 1 6 6v3" />
        </svg>
    )
}
