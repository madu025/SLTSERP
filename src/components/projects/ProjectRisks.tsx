import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, Plus, ShieldCheck, Edit2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
    id: string;
}

interface Risk {
    id: string;
    title: string;
    description: string;
    probability: number;
    impact: number;
    score: number;
    mitigationPlan: string | null;
    status: string;
    identifiedById: string;
    createdAt: string;
    updatedAt: string;
}

interface ProjectRisksProps {
    project: Project;
}

export default function ProjectRisks({ project }: ProjectRisksProps) {
    const [risks, setRisks] = useState<Risk[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

    // Add Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [probability, setProbability] = useState('3');
    const [impact, setImpact] = useState('3');
    const [mitigationPlan, setMitigationPlan] = useState('');
    const [identifiedById, setIdentifiedById] = useState('usr-dev-1');

    useEffect(() => {
        fetchRisks();
    }, [project.id]);

    const fetchRisks = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${project.id}/risks`);
            if (res.ok) {
                const data = await res.json();
                setRisks(data);
            }
        } catch (error) {
            console.error('Error fetching risks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRisk = async () => {
        if (!title || !description) {
            alert('Title and description are required');
            return;
        }

        try {
            const res = await fetch(`/api/projects/${project.id}/risks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    probability: Number(probability),
                    impact: Number(impact),
                    mitigationPlan,
                    identifiedById
                })
            });

            if (res.ok) {
                setIsAddOpen(false);
                resetForm();
                fetchRisks();
            } else {
                alert('Failed to log risk');
            }
        } catch (error) {
            console.error('Error logging risk:', error);
        }
    };

    const handleUpdateRisk = async (status?: string) => {
        if (!selectedRisk) return;

        try {
            const res = await fetch(`/api/projects/${project.id}/risks`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    riskId: selectedRisk.id,
                    mitigationPlan,
                    status: status || selectedRisk.status
                })
            });

            if (res.ok) {
                setIsEditOpen(false);
                setSelectedRisk(null);
                setMitigationPlan('');
                fetchRisks();
            } else {
                alert('Failed to update risk');
            }
        } catch (error) {
            console.error('Error updating risk:', error);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setProbability('3');
        setImpact('3');
        setMitigationPlan('');
    };

    const getScoreBadge = (score: number) => {
        if (score >= 15) {
            return <Badge className="bg-red-100 text-red-700 border-red-200">High Risk ({score})</Badge>;
        } else if (score >= 8) {
            return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Medium Risk ({score})</Badge>;
        } else {
            return <Badge className="bg-green-100 text-green-700 border-green-200">Low Risk ({score})</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            OPEN: 'bg-red-50 text-red-650 border-red-100',
            MITIGATED: 'bg-green-50 text-green-650 border-green-100',
            CLOSED: 'bg-slate-100 text-slate-600'
        };
        return <Badge variant="outline" className={`text-xs ${variants[status] || 'bg-slate-100 text-slate-600'}`}>{status}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Risk & Issue Register</h3>
                    <p className="text-sm text-slate-500">Track construction dependencies, probability matrices, and mitigation layouts.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Identify Risk
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading risks...</div>
            ) : risks.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <ShieldCheck className="w-12 h-12 text-slate-300 mb-3" />
                        <h4 className="font-semibold text-slate-700">No Identified Risks</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">Excellent! No environmental, budget, or equipment risks have been logged for this project yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {risks.map((risk) => (
                        <Card key={risk.id} className={`border border-slate-200 shadow-sm relative overflow-hidden ${risk.status === 'CLOSED' ? 'opacity-70' : ''}`}>
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                risk.status === 'CLOSED' ? 'bg-slate-400' :
                                risk.score >= 15 ? 'bg-red-500' :
                                risk.score >= 8 ? 'bg-amber-500' : 'bg-green-500'
                            }`} />
                            <CardHeader className="pb-3 pl-5">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            {getScoreBadge(risk.score)}
                                            {getStatusBadge(risk.status)}
                                        </div>
                                        <CardTitle className="text-base font-bold text-slate-900 mt-2">{risk.title}</CardTitle>
                                        <p className="text-xs text-slate-650 leading-relaxed mt-1">{risk.description}</p>
                                    </div>
                                    {risk.status !== 'CLOSED' && (
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedRisk(risk); setMitigationPlan(risk.mitigationPlan || ''); setIsEditOpen(true); }} className="h-8 w-8 p-0">
                                            <Edit2 className="w-4 h-4 text-slate-550" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pl-5 pt-0 space-y-3">
                                {risk.mitigationPlan && (
                                    <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-lg text-xs">
                                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                                            <ShieldCheck className="w-4 h-4 text-green-600" /> Mitigation Strategy
                                        </span>
                                        <p className="text-slate-600 mt-1 leading-relaxed">{risk.mitigationPlan}</p>
                                    </div>
                                )}
                                <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                                    <span>Probability: <strong>{risk.probability}/5</strong></span>
                                    <span>•</span>
                                    <span>Impact: <strong>{risk.impact}/5</strong></span>
                                    <span>•</span>
                                    <span>Logged: <strong>{format(new Date(risk.createdAt), 'MMM dd, yyyy')}</strong></span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Identify Risk Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log Project Risk</DialogTitle>
                        <DialogDescription>Identify structural or operational roadblocks and estimate score indices.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label>Risk Title *</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Monsoon Rain delays in RTOM Central" />
                        </div>
                        <div className="space-y-2">
                            <Label>Description / Details *</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what trigger conditions could occur and its project impact..." rows={3} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Probability (1-5)</Label>
                                <Select value={probability} onValueChange={setProbability}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 - Rare</SelectItem>
                                        <SelectItem value="2">2 - Unlikely</SelectItem>
                                        <SelectItem value="3">3 - Possible</SelectItem>
                                        <SelectItem value="4">4 - Likely</SelectItem>
                                        <SelectItem value="5">5 - Frequent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Impact Severity (1-5)</Label>
                                <Select value={impact} onValueChange={setImpact}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 - Negligible</SelectItem>
                                        <SelectItem value="2">2 - Minor</SelectItem>
                                        <SelectItem value="3">3 - Moderate</SelectItem>
                                        <SelectItem value="4">4 - Major</SelectItem>
                                        <SelectItem value="5">5 - Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Mitigation / Contingency Action</Label>
                            <Textarea value={mitigationPlan} onChange={(e) => setMitigationPlan(e.target.value)} placeholder="How do we mitigate or minimize this impact?" rows={2} />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddRisk}>Log Risk</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Resolve/Edit Risk Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Update Risk Status</DialogTitle>
                        <DialogDescription>Modify mitigation log or change workflow resolution state for: <strong>{selectedRisk?.title}</strong></DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label>Mitigation Plan</Label>
                            <Textarea value={mitigationPlan} onChange={(e) => setMitigationPlan(e.target.value)} rows={3} />
                        </div>
                        <DialogFooter className="pt-4 gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button onClick={() => handleUpdateRisk('MITIGATED')} className="bg-green-600 hover:bg-green-700 gap-1 text-white">
                                <ShieldCheck className="w-4 h-4" /> Mitigated
                            </Button>
                            <Button onClick={() => handleUpdateRisk('CLOSED')} className="bg-slate-650 hover:bg-slate-700 gap-1 text-white">
                                <ShieldCheck className="w-4 h-4" /> Close Risk
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
