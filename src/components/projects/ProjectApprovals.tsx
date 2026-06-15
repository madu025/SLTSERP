import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, ArrowRight, ShieldAlert, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
    id: string;
    name: string;
}

interface ApprovalStep {
    id: string;
    stepNumber: number;
    roleRequired: string;
    assignedUser: { id: string; name: string; role: string } | null;
    status: string;
    actionedBy: { id: string; name: string; role: string } | null;
    actionedAt: string | null;
    comment: string | null;
}

interface ApprovalRequest {
    id: string;
    type: string;
    referenceId: string;
    title: string;
    description: string | null;
    amount: number | null;
    status: string;
    createdAt: string;
    steps: ApprovalStep[];
    document?: { id: string; title: string; currentVersion: number } | null;
}

interface ProjectApprovalsProps {
    project: Project;
}

export default function ProjectApprovals({ project }: ProjectApprovalsProps) {
    const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);

    // Review Actions State
    const [selectedStep, setSelectedStep] = useState<ApprovalStep | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
    const [isActionOpen, setIsActionOpen] = useState(false);
    const [comment, setComment] = useState('');
    const [userId, setUserId] = useState('usr-dev-1'); // Fallback dev reviewer ID

    useEffect(() => {
        fetchApprovals();
    }, [project.id]);

    const fetchApprovals = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${project.id}/approvals`);
            if (res.ok) {
                const data = await res.json();
                setApprovals(data);
            }
        } catch (error) {
            console.error('Error fetching approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'APPROVED' | 'REJECTED') => {
        if (!selectedStep) return;

        try {
            const res = await fetch(`/api/projects/${project.id}/approvals`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stepId: selectedStep.id,
                    action,
                    comment,
                    actionedById: userId
                })
            });

            if (res.ok) {
                setIsActionOpen(false);
                setComment('');
                fetchApprovals();
            } else {
                alert('Failed to process approval step');
            }
        } catch (error) {
            console.error('Error actioning approval:', error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'REJECTED':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-slate-400 animate-pulse" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            PENDING: 'bg-slate-150 text-slate-700',
            APPROVED: 'bg-green-100 text-green-700',
            REJECTED: 'bg-red-100 text-red-700'
        };
        return (
            <Badge className={`text-xs font-semibold ${variants[status] || 'bg-slate-100 text-slate-650'}`}>
                {status}
            </Badge>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900">Project Approval Center</h3>
                <p className="text-sm text-slate-500">Monitor multi-level approval stages for design plans, budget sheets, and specifications.</p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading approvals...</div>
            ) : approvals.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <CheckCircle2 className="w-12 h-12 text-slate-300 mb-3" />
                        <h4 className="font-semibold text-slate-700">No Approvals Submitted</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">Submit documents or change order sheets from their respective sections to trigger workflows.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {approvals.map((req) => (
                        <Card key={req.id} className="border border-slate-200 shadow-sm">
                            <CardHeader className="pb-3 bg-slate-50/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{req.type}</Badge>
                                            <span className="text-[11px] text-slate-400 font-mono">ID: {req.id.slice(-6).toUpperCase()}</span>
                                        </div>
                                        <CardTitle className="text-base font-bold text-slate-900 mt-2">{req.title}</CardTitle>
                                        {req.description && <CardDescription className="text-xs text-slate-500 mt-0.5">{req.description}</CardDescription>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(req.status)}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                {/* Steps Progression Timeline */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-100 p-4 rounded-xl bg-white">
                                    {req.steps.map((step, idx) => {
                                        const isActive = step.status === 'PENDING' && (idx === 0 || req.steps[idx - 1].status === 'APPROVED');
                                        return (
                                            <div key={step.id} className="relative flex flex-col justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/20 hover:shadow-sm transition-shadow">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step {step.stepNumber}</span>
                                                        <h4 className="text-xs font-semibold text-slate-900 mt-0.5">{step.roleRequired} Role</h4>
                                                        {step.actionedBy && (
                                                            <p className="text-[10px] text-slate-500 mt-1 font-medium">Reviewed by: {step.actionedBy.name}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        {getStatusIcon(step.status)}
                                                    </div>
                                                </div>

                                                {step.comment && (
                                                    <div className="flex items-start gap-1 bg-slate-100/60 text-[10px] text-slate-650 p-2 rounded mt-2.5">
                                                        <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5 text-slate-400" />
                                                        <span>{step.comment}</span>
                                                    </div>
                                                )}

                                                {isActive && (
                                                    <Button size="sm" onClick={() => { setSelectedStep(step); setSelectedRequest(req); setIsActionOpen(true); }} className="w-full mt-3 h-8 text-xs bg-blue-600 hover:bg-blue-700">
                                                        Perform Action
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Perform Action Review Dialog */}
            <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Perform Review Decision</DialogTitle>
                        <DialogDescription>Submit your approval or rejection for this request step.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="bg-slate-50 p-3.5 rounded-lg border">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">Reviewing</h4>
                            <p className="text-sm font-bold text-slate-900 mt-1">{selectedRequest?.title}</p>
                            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 pt-2 border-t">
                                <span>Required Role: <strong>{selectedStep?.roleRequired}</strong></span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Review Comments / Remarks</Label>
                            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Type review observations or reason for rejection..." rows={3} />
                        </div>

                        <div className="space-y-2">
                            <Label>Acting User Role Simulator</Label>
                            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="usr-dev-1">OPMC Engineer (usr-dev-1)</option>
                                <option value="usr-dev-2">Regional OPMC Manager (usr-dev-2)</option>
                            </select>
                        </div>

                        <DialogFooter className="pt-4 gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setIsActionOpen(false)}>Cancel</Button>
                            <Button onClick={() => handleAction('REJECTED')} variant="destructive" className="gap-1">
                                <XCircle className="w-4 h-4" /> Reject
                            </Button>
                            <Button onClick={() => handleAction('APPROVED')} className="gap-1 bg-green-600 hover:bg-green-700">
                                <CheckCircle2 className="w-4 h-4" /> Approve
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
