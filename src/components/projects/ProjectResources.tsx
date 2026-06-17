import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, Users, HardHat, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
    id: string;
    name: string;
}

interface AllocatedResource {
    id: string;
    resourceType: string;
    resourceId: string;
    name: string;
    role: string | null;
    allocationPercentage: number;
    startDate: string;
    endDate: string;
}

interface AvailableResource {
    id: string;
    name: string;
    type: string;
}

interface ProjectResourcesProps {
    project: Project;
}

export default function ProjectResources({ project }: ProjectResourcesProps) {
    const [allocated, setAllocated] = useState<AllocatedResource[]>([]);
    const [available, setAvailable] = useState<{ staff: AvailableResource[]; teams: AvailableResource[] }>({ staff: [], teams: [] });
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);

    // Form State
    const [resourceType, setResourceType] = useState<'STAFF' | 'TEAM'>('STAFF');
    const [selectedResourceId, setSelectedResourceId] = useState('');
    const [role, setRole] = useState('');
    const [allocationPercentage, setAllocationPercentage] = useState('100');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    const [savingResource, setSavingResource] = useState(false);
    // Capture the matched resource name for the force-save flow
    const [pendingMatch, setPendingMatch] = useState<{ name: string } | null>(null);

    useEffect(() => {
        fetchResources();
    }, [project.id]);

    const fetchResources = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${project.id}/resources`);
            if (res.ok) {
                const data = await res.json();
                setAllocated(data.allocated);
                setAvailable(data.available);
            }
        } catch (error) {
            console.error('Error fetching resources:', error);
        } finally {
            setLoading(false);
        }
    };

    const doAllocate = async (forceOverAllocation = false) => {
        if (!selectedResourceId) {
            alert('Please select a resource');
            return;
        }

        // Find selected resource name
        const candidates = resourceType === 'STAFF' ? available.staff : available.teams;
        const match = candidates.find(c => c.id === selectedResourceId);
        if (!match) return;

        setSavingResource(true);
        try {
            const res = await fetch(`/api/projects/${project.id}/resources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resourceType,
                    resourceId: selectedResourceId,
                    name: match.name,
                    role,
                    allocationPercentage: Number(allocationPercentage),
                    startDate,
                    endDate,
                    forceOverAllocation,
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.warning && !forceOverAllocation) {
                    setWarning(data.warning);
                    setPendingMatch(match);
                } else {
                    setIsDialogOpen(false);
                    resetForm();
                    fetchResources();
                }
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to allocate resource');
            }
        } catch (error) {
            console.error('Error allocating resource:', error);
        } finally {
            setSavingResource(false);
        }
    };

    const handleAllocate = () => doAllocate(false);
    const handleForceAllocate = () => doAllocate(true);

    const handleRemove = async (id: string) => {
        if (!confirm('Are you sure you want to remove this resource allocation?')) return;

        try {
            const res = await fetch(`/api/projects/${project.id}/resources?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchResources();
            } else {
                alert('Failed to remove resource allocation');
            }
        } catch (error) {
            console.error('Error removing resource:', error);
        }
    };

    const resetForm = () => {
        setSelectedResourceId('');
        setRole('');
        setAllocationPercentage('100');
        setWarning(null);
        setPendingMatch(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Resource Allocations</h3>
                    <p className="text-sm text-slate-500">Assign workforce and crew members to project timelines.</p>
                </div>
                <Button onClick={() => { setIsDialogOpen(true); setWarning(null); }} className="gap-2">
                    <Plus className="w-4 h-4" /> Allocate Resource
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading resources...</div>
            ) : allocated.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Users className="w-12 h-12 text-slate-350 mb-3" />
                        <h4 className="font-semibold text-slate-700">No Resource Allocations</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">Assign personnel or contractor crews to work on the OSP tasks.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allocated.map((res) => (
                        <Card key={res.id} className="border border-slate-200 shadow-sm relative overflow-hidden">
                            {res.allocationPercentage > 100 && (
                                <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
                            )}
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        {res.resourceType === 'STAFF' ? (
                                            <Users className="w-5 h-5 text-blue-500" />
                                        ) : (
                                            <HardHat className="w-5 h-5 text-emerald-500" />
                                        )}
                                        <div>
                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                {res.resourceType}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleRemove(res.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <CardTitle className="text-base font-semibold text-slate-900 mt-2">{res.name}</CardTitle>
                                {res.role && <CardDescription className="text-xs text-slate-500 mt-0.5">{res.role}</CardDescription>}
                            </CardHeader>
                            <CardContent className="space-y-3 pt-0">
                                <div className="flex justify-between text-xs border-t border-slate-100 pt-2.5">
                                    <span className="text-slate-500">Utilization Rate</span>
                                    <span className={`font-semibold ${res.allocationPercentage > 100 ? 'text-amber-600' : 'text-slate-900'}`}>
                                        {res.allocationPercentage}%
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Start Date</span>
                                    <span className="text-slate-800 font-medium flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {format(new Date(res.startDate), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">End Date</span>
                                    <span className="text-slate-800 font-medium flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {format(new Date(res.endDate), 'MMM dd, yyyy')}
                                    </span>
                                </div>

                                {res.allocationPercentage > 100 && (
                                    <div className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 p-2 rounded-lg text-[10px] mt-2">
                                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>Overallocated: Resource loading exceeds 100%.</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Allocate Resource Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Allocate Resource</DialogTitle>
                        <DialogDescription>Assign staff or contractor teams to project tasks.</DialogDescription>
                    </DialogHeader>

                    {warning ? (
                        <div className="space-y-4 py-4">
                            <div className="flex items-start gap-2 bg-amber-50 p-4 rounded-lg text-amber-800">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                                <div>
                                    <h5 className="font-bold text-sm">Resource Overload Alert</h5>
                                    <p className="text-xs mt-1">{warning}</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setWarning(null)}>Back to Edit</Button>
                                <Button onClick={handleForceAllocate} disabled={savingResource} className="bg-amber-600 hover:bg-amber-700">
                                    {savingResource ? 'Saving...' : 'Acknowledge & Save'}
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-4 py-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Resource Type</Label>
                                    <Select value={resourceType} onValueChange={(val: 'STAFF' | 'TEAM') => { setResourceType(val); setSelectedResourceId(''); }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="STAFF">Staff Member</SelectItem>
                                            <SelectItem value="TEAM">Contractor Team</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Allocation Percentage (%)</Label>
                                    <Input type="number" min="1" max="150" value={allocationPercentage} onChange={(e) => setAllocationPercentage(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Select Resource *</Label>
                                <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                                    <SelectTrigger><SelectValue placeholder="Choose resource..." /></SelectTrigger>
                                    <SelectContent>
                                        {resourceType === 'STAFF'
                                            ? available.staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                                            : available.teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Role / Designation in Project</Label>
                                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Lead Cable Splicer, Project Liaison" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>

                            <DialogFooter className="pt-4">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleAllocate}>Allocate</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
