"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    AlertCircle,
    CheckCircle2,
    Hammer,
    FileText
} from "lucide-react";

// Mock Data
const pendingTasks = [
    { id: 'SOD-001', title: 'New Connection - AB001', due: '2026-01-20', priority: 'High', status: 'In Progress' },
    { id: 'SOD-004', title: 'Fault Repair - XY22', due: '2026-01-22', priority: 'Medium', status: 'Pending Access' },
    { id: 'REQ-882', title: 'Material Request for Team A', due: '2026-01-18', priority: 'Normal', status: 'Waiting Approval' },
];

const completedRecently = [
    { id: 'SOD-102', title: 'Installation at Main St', date: '2026-01-15', status: 'Approved' },
    { id: 'SOD-105', title: 'Cabling work - Zone 2', date: '2026-01-14', status: 'Completed' },
];

export default function UserReportsPage() {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <Header />
                <div className="p-6 space-y-6 max-w-[1200px] mx-auto w-full">

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">My Productivity Report</h1>
                        <p className="text-slate-500">Track your tasks and recent activities</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Pending Tasks List */}
                        <Card className="md:col-span-2">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Clock className="w-5 h-5 text-amber-500" />
                                    <h3 className="text-lg font-bold text-slate-800">Pending Actions</h3>
                                </div>
                                <div className="space-y-4">
                                    {pendingTasks.map((task) => (
                                        <div key={task.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors">
                                            <div className="flex gap-4">
                                                <div className="bg-white p-2 rounded shadow-sm h-fit">
                                                    <FileText className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">{task.title}</h4>
                                                    <p className="text-xs text-slate-500">{task.id} • Due: {task.due}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge className={
                                                    task.priority === 'High' ? 'bg-rose-100 text-rose-700 hover:bg-rose-100' :
                                                        'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                                }>
                                                    {task.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Summary Stats */}
                        <div className="space-y-6">
                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        <h3 className="text-lg font-bold text-slate-800">Completed (This Month)</h3>
                                    </div>
                                    <div className="text-4xl font-bold text-slate-900 mb-2">12</div>
                                    <p className="text-sm text-slate-500">Tasks successfully closed</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <AlertCircle className="w-5 h-5 text-rose-500" />
                                        <h3 className="text-lg font-bold text-slate-800">Rejections</h3>
                                    </div>
                                    <div className="text-4xl font-bold text-slate-900 mb-2">2</div>
                                    <p className="text-sm text-slate-500">Items requiring rework</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
