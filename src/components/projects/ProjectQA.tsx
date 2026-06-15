import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, Plus, CheckSquare, XCircle, AlertTriangle, AlertCircle, Camera, Check } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
    id: string;
}

interface Inspection {
    id: string;
    title: string;
    category: string; // INSPECTION_REQUEST, NON_CONFORMANCE
    status: string; // PENDING, PASSED, FAILED, UNDER_CORRECTION
    checklist: any; // [{ item: string, checked: boolean }]
    correctiveAction: string | null;
    photoUrls: string[];
    inspectorId: string;
    inspectedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ProjectQAProps {
    project: Project;
}

export default function ProjectQA({ project }: ProjectQAProps) {
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Add Dialog State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('INSPECTION_REQUEST');
    const [checklistItems, setChecklistItems] = useState<string[]>(['Cabling Depth verified', 'Serial numbers of splitters logged', 'PAT Test results uploaded']);
    const [newItem, setNewItem] = useState('');
    const [inspectorId, setInspectorId] = useState('usr-dev-1');

    // Review Dialog State
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [selectedIns, setSelectedIns] = useState<Inspection | null>(null);
    const [checklistState, setChecklistState] = useState<{ item: string; checked: boolean }[]>([]);
    const [correctiveAction, setCorrectiveAction] = useState('');
    const [photoUrlInput, setPhotoUrlInput] = useState('');

    useEffect(() => {
        fetchInspections();
    }, [project.id]);

    const fetchInspections = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${project.id}/inspections`);
            if (res.ok) {
                const data = await res.json();
                setInspections(data);
            }
        } catch (error) {
            console.error('Error fetching QA records:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInspection = async () => {
        if (!title) {
            alert('Title is required');
            return;
        }

        const checklistObj = checklistItems.map(item => ({ item, checked: false }));

        try {
            const res = await fetch(`/api/projects/${project.id}/inspections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    category,
                    checklist: checklistObj,
                    inspectorId
                })
            });

            if (res.ok) {
                setIsAddOpen(false);
                setTitle('');
                setChecklistItems(['Cabling Depth verified', 'Serial numbers of splitters logged', 'PAT Test results uploaded']);
                fetchInspections();
            } else {
                alert('Failed to log QA sheet');
            }
        } catch (error) {
            console.error('Error creating inspection:', error);
        }
    };

    const handleUpdateInspection = async (status: 'PASSED' | 'FAILED' | 'UNDER_CORRECTION') => {
        if (!selectedIns) return;

        try {
            const res = await fetch(`/api/projects/${project.id}/inspections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inspectionId: selectedIns.id,
                    status,
                    checklist: checklistState,
                    correctiveAction: correctiveAction || null,
                    photoUrls: photoUrlInput ? [photoUrlInput] : []
                })
            });

            if (res.ok) {
                setIsReviewOpen(false);
                setSelectedIns(null);
                setCorrectiveAction('');
                setPhotoUrlInput('');
                fetchInspections();
            } else {
                alert('Failed to update QA sign-off');
            }
        } catch (error) {
            console.error('Error updating QA record:', error);
        }
    };

    const addChecklistItem = () => {
        if (!newItem) return;
        setChecklistItems([...checklistItems, newItem]);
        setNewItem('');
    };

    const removeChecklistItem = (index: number) => {
        setChecklistItems(checklistItems.filter((_, i) => i !== index));
    };

    const toggleCheckItem = (index: number) => {
        const updated = [...checklistState];
        updated[index].checked = !updated[index].checked;
        setChecklistState(updated);
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            PENDING: 'bg-slate-100 text-slate-700 border-slate-200',
            PASSED: 'bg-green-100 text-green-700 border-green-200',
            FAILED: 'bg-red-100 text-red-700 border-red-200',
            UNDER_CORRECTION: 'bg-amber-100 text-amber-700 border-amber-200'
        };
        return <Badge variant="outline" className={`text-xs ${variants[status] || 'bg-slate-100'}`}>{status.replace('_', ' ')}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Quality Assurance (QA/QC)</h3>
                    <p className="text-sm text-slate-500">Manage Inspection Requests (IR), Quality Checklists, and log Non-Conformance Reports (NCR).</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> New QA Request
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading QA sheets...</div>
            ) : inspections.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <ClipboardCheck className="w-12 h-12 text-slate-350 mb-3" />
                        <h4 className="font-semibold text-slate-700">No QA Sheets Logged</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">Submit check sheets or create inspection requests (IR) to maintain OSP compliance.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inspections.map((ins) => {
                        const parsedChecklist = Array.isArray(ins.checklist) ? ins.checklist : [];
                        const checkedCount = parsedChecklist.filter((c: any) => c.checked).length;

                        return (
                            <Card key={ins.id} className="border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                                <div>
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline">{ins.category === 'INSPECTION_REQUEST' ? 'Inspection Request (IR)' : 'Non-Conformance (NCR)'}</Badge>
                                            {getStatusBadge(ins.status)}
                                        </div>
                                        <CardTitle className="text-base font-bold text-slate-900 mt-2">{ins.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-0">
                                        <div className="text-xs text-slate-650">
                                            <span className="font-semibold">Checklist Items:</span> {checkedCount} / {parsedChecklist.length} verified
                                        </div>
                                        
                                        {ins.correctiveAction && (
                                            <div className="bg-red-50/50 border border-red-100 p-2.5 rounded text-xs">
                                                <span className="font-semibold text-red-800 flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Corrective Action Log
                                                </span>
                                                <p className="text-red-700 mt-0.5">{ins.correctiveAction}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </div>
                                <div className="p-4 bg-slate-50/50 border-t flex justify-between items-center text-[10px] text-slate-400">
                                    <span>Created: {format(new Date(ins.createdAt), 'MMM dd, yyyy')}</span>
                                    {ins.status === 'PENDING' && (
                                        <Button size="sm" onClick={() => { setSelectedIns(ins); setChecklistState(parsedChecklist); setIsReviewOpen(true); }} className="h-7 text-[10px] py-0">
                                            Conduct Review
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add QA Request Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create QA Sheet</DialogTitle>
                        <DialogDescription>Define QA inspection checklist items for verification sign-off.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label>QA Title *</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FDN cabinet grounding check" />
                        </div>
                        <div className="space-y-2">
                            <Label>QA Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INSPECTION_REQUEST">Inspection Request (IR)</SelectItem>
                                    <SelectItem value="NON_CONFORMANCE">Non-Conformance Report (NCR)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Checklist items dynamic builder */}
                        <div className="space-y-2">
                            <Label>Inspection Checklist</Label>
                            <div className="flex gap-2">
                                <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add checklist item..." />
                                <Button onClick={addChecklistItem} variant="outline" size="sm">Add</Button>
                            </div>
                            <div className="space-y-1.5 mt-2 max-h-[120px] overflow-y-auto border border-slate-100 p-2 rounded bg-slate-50/40">
                                {checklistItems.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center text-xs p-1 border rounded bg-white">
                                        <span className="truncate max-w-[280px]">{item}</span>
                                        <button onClick={() => removeChecklistItem(index)} className="text-red-500 hover:text-red-700">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateInspection}>Create QA Sheet</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Perform QA Verification Dialog */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Perform Compliance Review</DialogTitle>
                        <DialogDescription>Check off items, log deviations, and sign-off on quality status.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="bg-slate-50 p-3 rounded border text-xs">
                            <span className="font-bold text-slate-400">QA Document:</span>
                            <p className="font-bold text-slate-900 mt-0.5">{selectedIns?.title}</p>
                        </div>

                        {/* Checklist Checkboxes */}
                        <div className="space-y-2">
                            <Label className="text-xs">Checklist Items Verification</Label>
                            <div className="space-y-2 max-h-[140px] overflow-y-auto border p-2.5 rounded-lg bg-white">
                                {checklistState.map((chk, index) => (
                                    <div key={index} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                                        <input type="checkbox" checked={chk.checked} onChange={() => toggleCheckItem(index)} className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4" />
                                        <span className={chk.checked ? 'line-through text-slate-400' : 'text-slate-700'}>{chk.item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Corrective Actions (Required for NCR/Failure)</Label>
                            <Textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} placeholder="Type NCR remediation steps..." rows={2} />
                        </div>

                        <div className="space-y-2">
                            <Label>Verification Proof (Photo URL)</Label>
                            <Input value={photoUrlInput} onChange={(e) => setPhotoUrlInput(e.target.value)} placeholder="https://image-storage-path.png" />
                        </div>

                        <DialogFooter className="pt-4 gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>Cancel</Button>
                            <Button onClick={() => handleUpdateInspection('FAILED')} variant="destructive" className="gap-1 text-white">
                                <XCircle className="w-4 h-4" /> Fail QA
                            </Button>
                            <Button onClick={() => handleUpdateInspection('PASSED')} className="bg-green-600 hover:bg-green-700 gap-1 text-white">
                                <Check className="w-4 h-4" /> Pass QA
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
