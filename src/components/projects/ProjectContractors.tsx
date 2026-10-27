import {  useEffect, useState  } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, HardHat, Phone, Mail, Award, Plus, Users } from 'lucide-react';
import { format } from 'date-fns';

import { toast } from 'sonner';
interface Project {
    id: string;
}

interface Contractor {
    id: string;
    name: string;
    email: string | null;
    contactNumber: string | null;
    registrationNumber: string | null;
}

interface Evaluation {
    id: string;
    rating: number;
    comments: string;
    date: string;
}

interface ProjectContractorsProps {
    project: Project;
}

interface ContractorAssignment {
    id: string;
    contractorId: string;
    role: string;
    status: string;
    allocationPercent?: number | null;
    contractValue?: number | null;
    contractor: Contractor;
}

export default function ProjectContractors({ project }: ProjectContractorsProps) {
    const [contractor, setContractor] = useState<Contractor | null>(null);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [rating, setRating] = useState('5');
    const [comments, setComments] = useState('');
    const [assignments, setAssignments] = useState<ContractorAssignment[]>([]);
    const [availableContractors, setAvailableContractors] = useState<Contractor[]>([]);
    const [selectedContractorId, setSelectedContractorId] = useState('');
    const [assignmentRole, setAssignmentRole] = useState('IMPLEMENTATION');
    const [assigning, setAssigning] = useState(false);
    const [replacingAssignmentId, setReplacingAssignmentId] = useState<string | null>(null);
    const [replacementContractorId, setReplacementContractorId] = useState('');

    useEffect(() => {
        fetchContractorInfo();
        fetchAssignments();
    }, [project.id]);

    const fetchAssignments = async () => {
        try {
            const [assignmentRes, contractorRes] = await Promise.all([
                fetch(`/api/projects/contractor-assignments?projectId=${project.id}`),
                fetch('/api/contractors'),
            ]);
            if (assignmentRes.ok) setAssignments(await assignmentRes.json());
            if (contractorRes.ok) {
                const data = await contractorRes.json();
                const list = data?.contractors || data?.data?.contractors || data?.data || data;
                if (Array.isArray(list)) setAvailableContractors(list);
            }
        } catch {
            toast.error('Unable to load project contractor assignments');
        }
    };

    const assignContractor = async () => {
        if (!selectedContractorId) return;
        setAssigning(true);
        try {
            const res = await fetch('/api/projects/contractor-assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, contractorId: selectedContractorId, role: assignmentRole }),
            });
            if (!res.ok) throw new Error('Assignment failed');
            setSelectedContractorId('');
            await fetchAssignments();
            toast.success('Contractor assigned to the project');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Assignment failed');
        } finally {
            setAssigning(false);
        }
    };

    const replaceContractor = async (assignmentId: string) => {
        if (!replacementContractorId) return;
        setReplacingAssignmentId(assignmentId);
        try {
            const res = await fetch('/api/projects/contractor-assignments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: assignmentId, action: 'REPLACE', replacementContractorId }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || 'Contractor replacement failed');
            }
            setReplacementContractorId('');
            await fetchAssignments();
            toast.success('Open child tasks moved to the replacement contractor');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Contractor replacement failed');
        } finally {
            setReplacingAssignmentId(null);
        }
    };

    const fetchContractorInfo = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${project.id}/contractor-rating`);
            if (res.ok) {
                const data = await res.json();
                setContractor(data.contractor);
                setEvaluations(data.evaluations);
            }
        } catch (error) {
} finally {
            setLoading(false);
        }
    };

    const handleLogRating = async () => {
        if (!contractor) return;

        try {
            const res = await fetch(`/api/projects/${project.id}/contractor-rating`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorId: contractor.id,
                    rating: Number(rating),
                    comments
                })
            });

            if (res.ok) {
                const data = await res.json();
                setIsDialogOpen(false);
                setComments('');
                // Optimistic UI update
                setEvaluations([
                    ...evaluations,
                    {
                        id: `eval-${Date.now()}`,
                        rating: Number(rating),
                        comments: comments || 'No comments.',
                        date: new Date().toISOString()
                    }
                ]);
            } else {
                toast.error('Failed to log evaluation');
            }
        } catch (error) {
}
    };

    const renderStars = (count: number) => {
        return (
            <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                        key={idx}
                        className={`w-4 h-4 ${idx < count ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`}
                    />
                ))}
            </div>
        );
    };

    if (loading) return <div className="text-center py-12 text-slate-500">Loading contractor profile...</div>;

    const assignmentPanel = (
        <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-600" /> Contractor Work Packages</CardTitle>
                <CardDescription className="text-xs text-slate-600">Assign more than one contractor to this project before allocating tasks or contractor invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
                        <SelectTrigger className="w-64"><SelectValue placeholder="Select active contractor" /></SelectTrigger>
                        <SelectContent>
                            {availableContractors.filter((item) => !assignments.some((assignment) => assignment.contractorId === item.id)).map((item) => (
                                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={assignmentRole} onValueChange={setAssignmentRole}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="SURVEY">Survey</SelectItem>
                            <SelectItem value="DESIGN">Design / BOQ</SelectItem>
                            <SelectItem value="IMPLEMENTATION">Implementation</SelectItem>
                            <SelectItem value="PAT">PAT / QA</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={assignContractor} disabled={!selectedContractorId || assigning} className="gap-1"><Plus className="w-4 h-4" /> Assign</Button>
                </div>
                {assignments.length === 0 ? <p className="text-xs text-slate-600">No contractor work package assigned yet.</p> : (
                    <div className="grid gap-2 md:grid-cols-2">
                        {assignments.map((assignment) => (
                            <div key={assignment.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div><p className="text-sm font-semibold text-slate-900">{assignment.contractor.name}</p><p className="text-xs text-slate-700">{assignment.role.replace(/_/g, ' ')}</p></div>
                                    <Badge className={assignment.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}>{assignment.status}</Badge>
                                </div>
                                {assignment.status === 'ACTIVE' && availableContractors.length > 1 && (
                                    <div className="flex items-center gap-2">
                                        <Select value={replacementContractorId} onValueChange={setReplacementContractorId}>
                                            <SelectTrigger className="h-8 flex-1 text-xs bg-white"><SelectValue placeholder="Replace open-task contractor" /></SelectTrigger>
                                            <SelectContent>
                                                {availableContractors.filter((item) => item.id !== assignment.contractorId).map((item) => (
                                                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!replacementContractorId || replacingAssignmentId === assignment.id} onClick={() => replaceContractor(assignment.id)}>
                                            {replacingAssignmentId === assignment.id ? 'Changing...' : 'Change'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    if (!contractor) {
        return (
            <div className="space-y-6">{assignmentPanel}<Card className="border-dashed border-2"><CardContent className="flex flex-col items-center justify-center py-12 text-center"><HardHat className="w-12 h-12 text-slate-300 mb-3" /><h4 className="font-semibold text-slate-700">No Primary Contractor Profile</h4><p className="text-xs text-slate-600 max-w-sm mt-1">Use the work package assignment above for task allocation. A primary contractor profile is optional.</p></CardContent></Card></div>
        );
    }

    return (
        <div className="space-y-6">
            {assignmentPanel}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Contractor Profile & Evaluation</h3>
                    <p className="text-sm text-slate-500">Assess work execution quality and track historical contractor performance ratings.</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                    <Star className="w-4 h-4" /> Evaluate Partner
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Contractor Identity Card */}
                <Card className="border shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                <HardHat className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-bold text-slate-900">{contractor.name}</CardTitle>
                                <CardDescription className="text-xs text-slate-500">Reg Nr: {contractor.registrationNumber || 'Pending'}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3.5 text-xs pt-0">
                        <div className="flex items-center gap-2 border-t pt-3.5">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700">{contractor.contactNumber || 'No phone set'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700">{contractor.email || 'No email set'}</span>
                        </div>
                        <div className="bg-emerald-50/50 text-emerald-800 p-3 rounded-lg border border-emerald-100 flex items-center gap-2">
                            <Award className="w-5 h-5 text-emerald-600" />
                            <div>
                                <span className="font-bold">Active SLA Score</span>
                                <p className="text-[10px] text-emerald-600">Based on recent evaluation scores and delivery compliance.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Evaluations log list */}
                <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-sm font-bold text-slate-900">Performance Feedback History</h4>
                    
                    {evaluations.length === 0 ? (
                        <p className="text-xs text-slate-500">No evaluations logged yet. Click &quot;Evaluate Partner&quot; to leave feedback.</p>
                    ) : (
                        evaluations.map((item) => (
                            <Card key={item.id} className="border shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-center">
                                        {renderStars(item.rating)}
                                        <span className="text-[10px] text-slate-450">{format(new Date(item.date), 'MMM dd, yyyy')}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <p className="text-xs text-slate-600 leading-relaxed italic">&quot;{item.comments}&quot;</p>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Log Evaluation Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Evaluate Contractor</DialogTitle>
                        <DialogDescription>Submit your work rating for: <strong>{contractor.name}</strong></DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label>Rating Score (1-5 Stars)</Label>
                            <Select value={rating} onValueChange={setRating}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent Execution</SelectItem>
                                    <SelectItem value="4">⭐⭐⭐⭐ Meets Specifications</SelectItem>
                                    <SelectItem value="3">⭐⭐⭐ Acceptable Quality</SelectItem>
                                    <SelectItem value="2">⭐⭐ Major Corrections Needed</SelectItem>
                                    <SelectItem value="1">⭐ Unacceptable - Critical Failures</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Observations & Feedback Comments</Label>
                            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Type specific notes regarding SLA delays, layout neatness, or compliance verification..." rows={4} />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleLogRating}>Submit Evaluation</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
