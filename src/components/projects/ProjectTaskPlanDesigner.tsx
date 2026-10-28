'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GripVertical, LockKeyhole, Plus, RefreshCw, Save, Send, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PlanUser { id: string; name: string | null; username: string; role: string; }
interface ProjectSupervisor { id: string; supervisorId: string; role: string; supervisor: PlanUser; }
interface PlanContractor { contractorId: string; contractor: { id: string; name: string }; }
interface PlanItem {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    sourceType: string;
    taskType: string;
    requiredJobRole?: string | null;
    assignmentTeamKey?: string | null;
    enabled: boolean;
    isRequired: boolean;
    sortOrder: number;
    plannedStart?: string | null;
    plannedFinish?: string | null;
    plannedDurationDays?: number | null;
    assignedUserId?: string | null;
    assignedContractorId?: string | null;
    sourceTemplate?: { stageTemplate?: { code?: string | null; name: string; sequence: number } | null } | null;
    sourceBoqItem?: { itemCode: string; category?: string | null } | null;
}
interface PlanTemplate {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    taskType: string;
    requiredJobRole?: string | null;
    assignmentTeamKey?: string | null;
    isRequired: boolean;
    stageName: string;
    executionType: string;
}
interface PlanData {
    plan: { id: string; status: string; version: number; generatedAt?: string | null; items?: PlanItem[] } | null;
    users: PlanUser[];
    supervisorCandidates: PlanUser[];
    contractors: PlanContractor[];
    catalog: PlanTemplate[];
}

interface ProjectTaskPlanDesignerProps { projectId: string; }

function errorMessage(payload: unknown, fallback: string) {
    if (!payload || typeof payload !== 'object') return fallback;
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') return message;
    }
    return fallback;
}

export default function ProjectTaskPlanDesigner({ projectId }: ProjectTaskPlanDesignerProps) {
    const [data, setData] = useState<PlanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [supervisors, setSupervisors] = useState<ProjectSupervisor[]>([]);
    const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

    const fetchPlan = useCallback(async () => {
        setLoading(true);
        try {
            const [planResponse, supervisorResponse] = await Promise.all([
                fetch(`/api/projects/${projectId}/task-plan`, { cache: 'no-store' }),
                fetch(`/api/projects/${projectId}/supervisors`, { cache: 'no-store' }),
            ]);
            const payload = await planResponse.json();
            if (!planResponse.ok) throw new Error(errorMessage(payload, 'Unable to load task plan'));
            setData(payload as PlanData);
            if (supervisorResponse.ok) setSupervisors(await supervisorResponse.json() as ProjectSupervisor[]);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to load task plan');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { void fetchPlan(); }, [fetchPlan]);

    const plan = data?.plan;
    const items = useMemo(() => [...(data?.plan?.items || [])], [data]);
    const locked = plan?.status === 'APPROVED' || plan?.status === 'LOCKED';
    const addedTemplateIds = useMemo(() => new Set(items.map(item => item.sourceType === 'TEMPLATE' ? item.code : '')), [items]);

    const callPlan = async (body: Record<string, unknown>, successMessage?: string) => {
        setSaving(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/task-plan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(errorMessage(payload, 'Task plan update failed'));
            if (successMessage) toast.success(successMessage);
            await fetchPlan();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Task plan update failed');
        } finally {
            setSaving(false);
        }
    };

    const updateItem = (itemId: string, patch: Record<string, unknown>) => callPlan({ action: 'update_item', itemId, ...patch });

    const assignSupervisor = async () => {
        if (!selectedSupervisorId) return;
        setSaving(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/supervisors`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supervisorId: selectedSupervisorId, role: 'PRIMARY' }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(errorMessage(payload, 'Supervisor assignment failed'));
            toast.success('Project supervisor assigned');
            setSelectedSupervisorId('');
            await fetchPlan();
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Supervisor assignment failed'); }
        finally { setSaving(false); }
    };

    const removeSupervisor = async (assignmentId: string) => {
        setSaving(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/supervisors?assignmentId=${encodeURIComponent(assignmentId)}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!response.ok) throw new Error(errorMessage(payload, 'Supervisor removal failed'));
            toast.success('Project supervisor removed');
            await fetchPlan();
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Supervisor removal failed'); }
        finally { setSaving(false); }
    };

    const handleDrop = async (targetId: string) => {
        if (!draggedId || draggedId === targetId || locked) return;
        const reordered = [...items];
        const from = reordered.findIndex(item => item.id === draggedId);
        const to = reordered.findIndex(item => item.id === targetId);
        if (from < 0 || to < 0) return;
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        setDraggedId(null);
        await callPlan({ action: 'reorder', orderedItemIds: reordered.map(item => item.id) }, 'Task order saved');
    };

    if (loading) return <Card><CardContent className="py-8 text-center text-sm text-slate-600">Loading task plan designer...</CardContent></Card>;

    return (
        <Card className="border-indigo-200 bg-white">
            <CardHeader className="border-b border-indigo-100 pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold text-slate-900">Dynamic Task Plan Designer</CardTitle>
                        <p className="mt-1 text-xs text-slate-700">Supervisor configures the approved template snapshot; managers approve it before executable tasks are generated.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {plan && <Badge className="bg-indigo-100 text-indigo-800">{plan.status} · v{plan.version}</Badge>}
                        <Button variant="outline" size="sm" className="gap-1 text-slate-800" onClick={() => void fetchPlan()}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
                        {!plan && <Button size="sm" className="gap-1" onClick={() => void callPlan({ action: 'initialize' }, 'Pre-built task plan created')}><Plus className="h-3.5 w-3.5" />Start Plan</Button>}
                        {plan && !locked && <Button variant="outline" size="sm" className="gap-1 border-emerald-300 text-emerald-800" onClick={() => void callPlan({ action: 'sync_boq' }, 'Approved BOQ work packages synced')}><RefreshCw className="h-3.5 w-3.5" />Sync Approved BOQ</Button>}
                        {plan && !locked && <Button size="sm" className="gap-1" onClick={async () => {
                            setSaving(true);
                            try {
                                const response = await fetch(`/api/projects/${projectId}/task-plan/approve`, { method: 'POST' });
                                const payload = await response.json();
                                if (!response.ok) throw new Error(errorMessage(payload, 'Task plan approval failed'));
                                toast.success('Task plan approved and operational tasks generated');
                                await fetchPlan();
                            } catch (error) { toast.error(error instanceof Error ? error.message : 'Task plan approval failed'); }
                            finally { setSaving(false); }
                        }}><Send className="h-3.5 w-3.5" />Approve & Generate</Button>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900">Project supervisor</h3>
                            <p className="mt-1 text-xs text-slate-700">A project manager assigns the supervisor; the assigned supervisor configures this project plan.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {supervisors.map(assignment => <Badge key={assignment.id} className="gap-1 bg-white text-slate-800">
                                    {assignment.supervisor.name || assignment.supervisor.username} · {assignment.supervisor.role}
                                    <button type="button" className="ml-1 text-red-700 hover:text-red-900" title="Remove supervisor" onClick={() => void removeSupervisor(assignment.id)} disabled={saving}>×</button>
                                </Badge>)}
                                {!supervisors.length && <span className="text-xs text-amber-800">No project supervisor assigned yet.</span>}
                            </div>
                        </div>
                        <div className="flex w-full gap-2 lg:w-auto">
                            <Select value={selectedSupervisorId || 'none'} onValueChange={(value) => setSelectedSupervisorId(value === 'none' ? '' : value)}>
                                <SelectTrigger className="h-8 min-w-64 bg-white text-xs text-slate-800"><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Select supervisor</SelectItem>{(data?.supervisorCandidates || []).filter(candidate => !supervisors.some(assignment => assignment.supervisorId === candidate.id)).map(candidate => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name || candidate.username} · {candidate.role}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button type="button" size="sm" className="h-8 shrink-0" disabled={!selectedSupervisorId || saving} onClick={() => void assignSupervisor()}>Assign</Button>
                        </div>
                    </div>
                </div>
                {!plan ? (
                    <div className="rounded-md border border-dashed border-indigo-300 bg-indigo-50 p-5 text-sm text-indigo-950">
                        Create the project-specific draft first. Required pre-built tasks will be copied into this project and the supervisor can then reorder, disable, add, or assign them.
                    </div>
                ) : (
                    <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Pre-built templates</h3><span className="text-xs text-slate-600">{data?.catalog.length || 0} available</span></div>
                            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                                {data?.catalog.map(template => {
                                    const alreadyAdded = addedTemplateIds.has(template.code);
                                    return <div key={template.id} className="rounded-md border border-slate-200 bg-white p-2.5">
                                        <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-900">{template.name}</p><p className="text-[11px] text-slate-600">{template.stageName} · {template.requiredJobRole || 'Role selected later'}</p></div><Button variant="outline" size="sm" className="h-7 shrink-0 gap-1 text-xs text-slate-800" disabled={locked || alreadyAdded || saving} onClick={() => void callPlan({ action: 'add_template', sourceTemplateId: template.id }, 'Template added')}><Plus className="h-3 w-3" />{alreadyAdded ? 'Added' : 'Add'}</Button></div>
                                    </div>;
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900">Project-specific task plan</h3><p className="text-xs text-slate-600">Drag to reorder. Disable/remove only before manager approval.</p></div>{locked && <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700"><LockKeyhole className="h-3.5 w-3.5" />Locked</span>}</div>
                            <div className="space-y-2">
                                {items.map(item => {
                                    const matchingUsers = (data?.users || []).filter(user => !item.requiredJobRole || user.role === item.requiredJobRole);
                                    return <div key={item.id} draggable={!locked} onDragStart={() => setDraggedId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => void handleDrop(item.id)} className={`rounded-md border p-3 ${item.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100 opacity-70'}`}>
                                        <div className="flex items-start gap-2">
                                            <GripVertical className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-mono text-slate-500">{item.code}</span><Badge variant="outline" className="text-[10px] text-slate-700">{item.sourceType}</Badge>{item.isRequired && <Badge className="bg-amber-100 text-amber-900">Required</Badge>}</div>
                                                <p className="mt-1 text-sm font-semibold text-slate-900">{item.name}</p>
                                                <p className="text-[11px] text-slate-600">{item.requiredJobRole || 'Any approved job role'}{item.assignmentTeamKey ? ` · ${item.assignmentTeamKey}` : ''}</p>
                                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                    <label className="text-[11px] font-medium text-slate-700">Start date<input type="date" disabled={locked || !item.enabled} value={item.plannedStart?.slice(0, 10) || ''} onChange={(event) => void updateItem(item.id, { plannedStart: event.target.value || null })} className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800" /></label>
                                                    <label className="text-[11px] font-medium text-slate-700">Finish date<input type="date" disabled={locked || !item.enabled} value={item.plannedFinish?.slice(0, 10) || ''} onChange={(event) => void updateItem(item.id, { plannedFinish: event.target.value || null })} className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800" /></label>
                                                    <label className="text-[11px] font-medium text-slate-700">Duration (days)<input type="number" min="1" disabled={locked || !item.enabled} value={item.plannedDurationDays ?? ''} onChange={(event) => void updateItem(item.id, { plannedDurationDays: event.target.value ? Number(event.target.value) : null })} className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800" /></label>
                                                </div>
                                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                    <Select disabled={locked || !item.enabled} value={item.assignedUserId || 'unassigned'} onValueChange={(value) => void updateItem(item.id, { assignedUserId: value === 'unassigned' ? null : value })}>
                                                        <SelectTrigger className="h-8 text-xs text-slate-800"><UserRound className="mr-1 h-3.5 w-3.5" /><SelectValue placeholder="Assign user" /></SelectTrigger>
                                                        <SelectContent><SelectItem value="unassigned">No user selected</SelectItem>{matchingUsers.map(user => <SelectItem key={user.id} value={user.id}>{user.name || user.username} · {user.role}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    {item.sourceType === 'BOQ_WORK_PACKAGE' && <Select disabled={locked || !item.enabled} value={item.assignedContractorId || 'unassigned'} onValueChange={(value) => void updateItem(item.id, { assignedContractorId: value === 'unassigned' ? null : value })}><SelectTrigger className="h-8 text-xs text-slate-800"><SelectValue placeholder="Assign contractor" /></SelectTrigger><SelectContent><SelectItem value="unassigned">No contractor selected</SelectItem>{data?.contractors.map(assignment => <SelectItem key={assignment.contractorId} value={assignment.contractorId}>{assignment.contractor.name}</SelectItem>)}</SelectContent></Select>}
                                                </div>
                                            </div>
                                            {!locked && <div className="flex shrink-0 items-center gap-1"><label className="flex items-center gap-1 text-[11px] text-slate-700"><input type="checkbox" checked={item.enabled} onChange={(event) => void updateItem(item.id, { enabled: event.target.checked })} />Use</label><Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={item.isRequired ? 'Required task cannot be removed' : 'Remove from plan'} disabled={item.isRequired || saving} onClick={() => void callPlan({ action: 'remove_item', itemId: item.id }, 'Task removed')}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button></div>}
                                        </div>
                                    </div>;
                                })}
                                {items.length === 0 && <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No plan items yet. Add a pre-built template or sync the approved BOQ.</div>}
                            </div>
                            {saving && <p className="mt-3 flex items-center gap-1 text-xs text-slate-600"><Save className="h-3.5 w-3.5" />Saving plan...</p>}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
