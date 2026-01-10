import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, DollarSign, TrendingUp } from 'lucide-react';

interface ProjectOverviewProps {
    project: any;
}

export default function ProjectOverview({ project }: ProjectOverviewProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const budgetUtilization = project.budget ? (project.actualCost / project.budget) * 100 : 0;

    // Calculate stats from BOQ and Milestones (if available from API relations)
    const completedMilestones = project.milestones?.filter((m: any) => m.status === 'COMPLETED').length || 0;
    const totalMilestones = project.milestones?.length || 0;
    const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Total Budget</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{formatCurrency(project.budget)}</div>
                        <p className="text-xs text-slate-500 mt-1">Approved allocation</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Actual Cost</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{formatCurrency(project.actualCost)}</div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                            <div
                                className={`h-1.5 rounded-full ${budgetUtilization > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{budgetUtilization.toFixed(1)}% utilized</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Progress</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{project.progress}%</div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                            <div
                                className="h-1.5 rounded-full bg-purple-500"
                                style={{ width: `${project.progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Overall completion</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Milestones</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{completedMilestones}/{totalMilestones}</div>
                        <p className="text-xs text-slate-500 mt-1">Tasks completed</p>
                    </CardContent>
                </Card>
            </div>

            {/* Description & Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Description Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Project Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {project.description || "No description provided."}
                            </p>

                            <div className="mt-6">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Key Information</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">Estimated Duration</p>
                                        <p className="text-sm font-medium">{project.estimatedDuration || '-'} Days</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">Actual Duration</p>
                                        <p className="text-sm font-medium">{project.actualDuration || '-'} Days</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">Region</p>
                                        <p className="text-sm font-medium">{project.opmc?.region || '-'}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">Province</p>
                                        <p className="text-sm font-medium">{project.opmc?.province || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Milestones Preview */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Recent Milestones</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {project.milestones && project.milestones.length > 0 ? (
                                    project.milestones.slice(0, 3).map((milestone: any) => (
                                        <div key={milestone.id} className="flex items-center gap-4">
                                            <div className={`w-2 h-2 rounded-full ${milestone.status === 'COMPLETED' ? 'bg-green-500' : 'bg-slate-300'}`} />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-slate-900">{milestone.name}</p>
                                                <p className="text-xs text-slate-500">Due: {new Date(milestone.targetDate).toLocaleDateString()}</p>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {milestone.status}
                                            </Badge>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500 italic">No milestones defined yet.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Financial Summary */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-sm text-slate-600">BOQ Total</span>
                                <span className="text-sm font-medium">
                                    {formatCurrency(project.boqItems?.reduce((s: number, i: any) => s + i.amount, 0) || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-sm text-slate-600">Expenses</span>
                                <span className="text-sm font-medium">
                                    {formatCurrency(project.expenses?.reduce((s: number, i: any) => s + i.amount, 0) || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 pt-4">
                                <span className="text-sm font-bold text-slate-900">Total Spent</span>
                                <span className="text-sm font-bold text-slate-900">
                                    {formatCurrency(project.actualCost)}
                                </span>
                            </div>

                            <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-orange-700">Budget Status</p>
                                        <p className="text-xs text-orange-600 mt-1">
                                            {budgetUtilization > 100
                                                ? `Over budget by ${formatCurrency(project.actualCost - (project.budget || 0))}`
                                                : `${formatCurrency((project.budget || 0) - project.actualCost)} remaining`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
