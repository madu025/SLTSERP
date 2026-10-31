import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CheckCircle2, 
  Play, 
  AlertTriangle, 
  Camera, 
  ShieldCheck, 
  Loader2, 
  CheckSquare, 
  ListTodo, 
  Workflow, 
  ChevronRight, RefreshCcw, Send, GitPullRequest, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { resolveCurrentProjectStage } from '@/lib/project-navigation';
import { useCanonicalPermissions } from '@/hooks/use-canonical-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

interface Task {
  id: string;
  name: string;
  description: string | null;
  priority: string;
  status: string;
  progress: number;
}

interface Checklist {
  id: string;
  label: string;
  isMandatory: boolean;
  isCompleted: boolean;
  photoUrl: string | null;
}

interface Approval {
  id: string;
  level: number;
  role: string;
  status: string;
  approvedById: string | null;
  approvedAt: string | null;
  comments: string | null;
}

interface ReviewComment {
  id: string;
  severity: string;
  comment: string;
  isResolved: boolean;
  createdAt: string;
}

interface ReviewCycle {
  id: string;
  deliverableType: string;
  revision: number;
  status: string;
  reviewerRole: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  decisionNotes: string | null;
  comments: ReviewComment[];
}

interface Stage {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  sequence: number;
  status: string;
  workstream: string | null;
  assignedRole: string | null;
  assignedTeamKey: string | null;
  reviewStatus: string;
  revision: number;
  reworkCount: number;
  reqApproval: boolean;
  reqChecklist: boolean;
  reqPhotos: boolean;
  reqMaterials: boolean;
  reqDocuments: boolean;
  reqOTDR: boolean;
  reqGPS: boolean;
  tasks: Task[];
  checklists: Checklist[];
  approvals: Approval[];
  reviews: ReviewCycle[];
  actualStart: string | null;
  actualFinish: string | null;
}

interface ProjectWorkflow {
  id: string;
  projectId: string;
  currentStageId: string | null;
  stages: Stage[];
}

interface Project {
  id: string;
  name: string;
  projectType?: {
    id: string;
    name: string;
  };
}

interface ProjectWorkflowTrackerProps {
  project: Project;
  onOpenProjectSettings?: () => void;
  refreshProject?: () => void;
}

export default function ProjectWorkflowTracker({ project, onOpenProjectSettings, refreshProject }: ProjectWorkflowTrackerProps) {
  const permissions = useCanonicalPermissions();
  const canWrite = permissions.includes(RBAC_PERMISSIONS.PROJECT_WRITE);
  const canApprove = permissions.includes(RBAC_PERMISSIONS.PROJECT_APPROVE);
  const [workflowMissing, setWorkflowMissing] = useState(false);
  const [workflow, setWorkflow] = useState<ProjectWorkflow | null>(null);
  const [activeStage, setActiveStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [photoProofInputs, setPhotoProofInputs] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/workflow?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkflowError(null);
        setWorkflow(data);
        const proofInputs: Record<string, string> = {};
        for (const stage of data.stages ?? []) {
          for (const checklist of stage.checklists ?? []) {
            if (checklist.photoUrl) proofInputs[checklist.id] = checklist.photoUrl;
          }
        }
        setPhotoProofInputs(proofInputs);
        setWorkflowMissing(false);
        const current = resolveCurrentProjectStage<Stage>(data.stages, data.currentStageId);
        setActiveStage(current || null);
      } else {
        setWorkflowMissing(res.status === 404);
        setWorkflow(null);
        setActiveStage(null);
        setWorkflowError(res.status === 404
          ? 'This project has no workflow yet. Initialize its project type workflow to unlock stage controls.'
          : 'The workflow could not be loaded. Check your access or try again.');
      }
    } catch {
      setWorkflowMissing(false);
      setWorkflow(null);
      setActiveStage(null);
      setWorkflowError('The workflow could not be loaded. Check your connection and try again.');
} finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { void fetchWorkflow(); }, [fetchWorkflow]);

  const handleInitializeWorkflow = async () => {
    if (!canWrite) return;
    if (!project.projectType?.id) {
      setWorkflowError('Choose a project type first. The project type provides the stages and task gates.');
      onOpenProjectSettings?.();
      return;
    }

    try {
      setInitializing(true);
      const res = await fetch(`/api/projects/${project.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTypeId: project.projectType.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setWorkflowError(body?.error || 'Workflow initialization failed. Check your project permissions and try again.');
        return;
      }

      await fetchWorkflow();
      refreshProject?.();
    } catch {
      setWorkflowError('Workflow initialization failed. Check your connection and try again.');
    } finally {
      setInitializing(false);
    }
  };

  const handleStartStage = async (stageId: string) => {
    if (!canApprove) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          status: 'IN_PROGRESS',
        }),
      });

      if (res.ok) {
        await fetchWorkflow();
        refreshProject?.();
      } else {
        const payload = await res.json().catch(() => null);
        const error = payload?.error;
        toast.error(typeof error === 'string' ? error : error?.message || 'Unable to start the stage.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start the stage.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteStage = async (stageId: string) => {
    if (!canApprove) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          status: 'COMPLETED',
        }),
      });

      if (res.ok) {
        await fetchWorkflow();
        refreshProject?.();
      } else {
        const errorData = await res.json();
        const rawError = errorData?.error;
        const message = typeof rawError === 'string'
          ? rawError
          : rawError && typeof rawError === 'object' && typeof rawError.message === 'string'
            ? rawError.message
            : 'Failed to transition stage.';
        const errLines = message.split('\n');
        setValidationErrors(errLines);
        setIsErrorDialogOpen(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to complete the stage.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChecklistToggle = async (checklistId: string, currentVal: boolean, photoUrl?: string | null) => {
    if (!canWrite || submitting) return;
    try {
      const checklist = activeStage?.checklists.find(item => item.id === checklistId);
      const nextCompleted = !currentVal;
      const proofUrl = photoUrl?.trim() || checklist?.photoUrl || null;
      if (nextCompleted && activeStage?.reqPhotos && checklist?.isMandatory && !proofUrl) {
        toast.error('Attach a real photo proof URL before completing this mandatory checkpoint.');
        return;
      }

      setSubmitting(true);

      const res = await fetch(`/api/projects/${project.id}/workflow/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_checklist',
          checklistId,
          isCompleted: nextCompleted,
          photoUrl: nextCompleted ? proofUrl : null
        }),
      });
      if (!res.ok) throw new Error('Unable to update checklist.');
      await fetchWorkflow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    if (!canWrite || submitting) return;
    const nextStatus = currentStatus === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_task',
          taskId,
          status: nextStatus,
          progress: nextStatus === 'COMPLETED' ? 100 : 50,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const error = payload?.error;
        throw new Error(typeof error === 'string' ? error : error?.message || 'Unable to update workflow task.');
      }
      await fetchWorkflow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update workflow task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalSubmit = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!canApprove || submitting) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          status: decision,
          comments: decision === 'APPROVED' ? 'Gate conditions met.' : window.prompt('Reason for rejection') || '',
        }),
      });

      if (!res.ok) throw new Error('Unable to submit approval.');
      await fetchWorkflow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to submit approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewAction = async (
    action: 'submit' | 'resubmit' | 'decide',
    decision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED'
  ) => {
    if (!activeStage || (action === 'decide' ? !canApprove : !canWrite)) return;
    const currentReview = activeStage.reviews?.find(item => item.status === 'IN_REVIEW');
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          stageId: activeStage.id,
          reviewId: currentReview?.id,
          decision,
          deliverableType: activeStage.code || activeStage.name,
          reviewerRole: activeStage.assignedRole || undefined,
          notes: reviewNotes || undefined,
          comments: decision === 'CHANGES_REQUESTED' && reviewNotes
            ? [{ comment: reviewNotes, severity: 'REQUIRED' }]
            : undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const error = payload?.error;
        const message = typeof error === 'string' ? error : error?.message || 'Unable to update workflow review.';
        toast.error(message);
        return;
      }
      setReviewNotes('');
      await fetchWorkflow();
      refreshProject?.();
      toast.success(action === 'decide' ? `Review ${decision?.toLowerCase().replace(/_/g, ' ')}.` : 'Review submitted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update workflow review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-sm font-medium">Resolving dynamic project workflow stages...</span>
      </div>
    );
  }

  if (!workflow) {
    if (!workflowMissing) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900"><p>{workflowError || 'Unable to load workflow'}</p><Button className="mt-3" variant="outline" onClick={fetchWorkflow}>Retry</Button></div>;
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Workflow className="w-12 h-12 text-blue-600 mb-3" />
          <h4 className="font-semibold text-slate-900">Workflow setup is required</h4>
          <p className="text-xs text-slate-700 max-w-md mt-1">
            {workflowError || 'Initialize the project type workflow to unlock stage control, checklists, and workflow task gates.'}
          </p>
          {canWrite && (project.projectType?.id ? (
            <Button className="mt-4 gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={handleInitializeWorkflow} disabled={initializing}>
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Workflow className="w-4 h-4" />}
              {initializing ? 'Initializing workflow...' : `Initialize ${project.projectType.name.replace(/_/g, ' ')} workflow`}
            </Button>
          ) : (
            <Button variant="outline" className="mt-4 border-blue-600 text-blue-700 hover:bg-blue-50" onClick={onOpenProjectSettings}>
              Choose project type in Edit
            </Button>
          ))}
          <p className="text-[11px] text-slate-600 max-w-md mt-3">
            Parent and child task management is available from the Tasks tab while the workflow is being prepared.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overallProgress = Math.round(
    (workflow.stages.filter(s => s.status === 'COMPLETED').length / workflow.stages.length) * 100
  );

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border shadow-sm bg-slate-50/50">
        <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border border-blue-200">Dynamic Stage Pipeline</Badge>
              <span className="text-[10px] text-slate-450 font-mono">ID: {workflow.id.slice(-6).toUpperCase()}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-2">{project.projectType?.name?.replace(/_/g, ' ') || 'Project'} Workflow</h3>
            <p className="text-xs text-slate-550">Project-type workflow with role-based stage gates and evidence controls.</p>
          </div>
          <div className="w-full md:w-48 space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-750">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2 bg-slate-200" />
          </div>
        </CardContent>
      </Card>

      {/* Horizontal Steps Stepper */}
      <div className="overflow-x-auto pb-4 pt-1">
        <div className="flex items-center min-w-max gap-3 px-1">
          {workflow.stages.map((stage, idx) => {
            const isActive = activeStage?.id === stage.id;
            const isCompleted = stage.status === 'COMPLETED';
            const isBlocked = stage.status === 'BLOCKED';

            let borderStyle = 'border-slate-200 bg-white text-slate-700';
            if (isActive) borderStyle = 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm ring-1 ring-blue-600';
            if (isCompleted) borderStyle = 'border-green-600 bg-green-50/20 text-green-900';
            if (isBlocked) borderStyle = 'border-red-600 bg-red-50/20 text-red-900';

            return (
              <React.Fragment key={stage.id}>
                <button
                  onClick={() => setActiveStage(stage)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all hover:translate-y-[-1px] ${borderStyle}`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isCompleted ? 'bg-green-600 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {isCompleted ? '✓' : stage.sequence}
                  </span>
                  <span>{stage.name}</span>
                </button>
                {idx < workflow.stages.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Selected Stage Inspection Details */}
      {activeStage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* General Stage Info */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Stage {activeStage.sequence}: {activeStage.name}
                    </CardTitle>
                    {activeStage.description && (
                      <CardDescription className="text-xs text-slate-500 mt-1">
                        {activeStage.description}
                      </CardDescription>
                    )}
                  </div>
                  <div>
                    <Badge className={
                      activeStage.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      activeStage.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                      'bg-slate-100 text-slate-800'
                    }>
                      {activeStage.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border bg-slate-50/70 p-3">
                    <span className="text-slate-500 font-medium block">Owner role</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{activeStage.assignedRole || 'Project team'}</span>
                  </div>
                  <div className="rounded-lg border bg-slate-50/70 p-3">
                    <span className="text-slate-500 font-medium block">Team</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{activeStage.assignedTeamKey || 'Unassigned'}</span>
                  </div>
                  <div className="rounded-lg border bg-slate-50/70 p-3">
                    <span className="text-slate-500 font-medium block">Revision / rework</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">R{activeStage.revision} / {activeStage.reworkCount}</span>
                  </div>
                </div>

                {activeStage.reviews?.length > 0 && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <GitPullRequest className="w-4 h-4 text-blue-600" /> Review / rework history
                      </Label>
                      <Badge className="bg-blue-100 text-blue-800 border border-blue-200">{activeStage.reviewStatus.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {activeStage.reviews.slice(0, 4).map(review => (
                        <div key={review.id} className="flex items-start justify-between gap-3 text-[11px]">
                          <span className="text-slate-700">Revision {review.revision} · {review.reviewerRole || 'Assigned reviewer'}</span>
                          <Badge variant="outline" className="text-[10px]">{review.status.replace(/_/g, ' ')}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50/60 p-3 rounded-lg border">
                    <span className="text-slate-400 font-medium block">Actual Start</span>
                    <span className="font-bold text-slate-700 mt-0.5 block">
                      {activeStage.actualStart ? format(new Date(activeStage.actualStart), 'MMM dd, yyyy - hh:mm a') : 'Not Started'}
                    </span>
                  </div>
                  <div className="bg-slate-50/60 p-3 rounded-lg border">
                    <span className="text-slate-400 font-medium block">Actual Finish</span>
                    <span className="font-bold text-slate-700 mt-0.5 block">
                      {activeStage.actualFinish ? format(new Date(activeStage.actualFinish), 'MMM dd, yyyy - hh:mm a') : 'Ongoing'}
                    </span>
                  </div>
                </div>

                {/* Sub-Tasks Checker list */}
                {activeStage.tasks.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ListTodo className="w-4 h-4 text-slate-550" /> Stage Tasks Checklist
                    </Label>
                    <div className="space-y-2">
                      {activeStage.tasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50/30 transition-colors">
                          <div className="flex items-start gap-2.5">
                            <Checkbox 
                              checked={task.status === 'COMPLETED'} 
                              onCheckedChange={() => handleTaskToggle(task.id, task.status)}
                              disabled={!canWrite || submitting || activeStage.status !== 'IN_PROGRESS'}
                            />
                            <div>
                              <span className={`text-xs font-semibold block ${task.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {task.name}
                              </span>
                              {task.description && <span className="text-[10px] text-slate-450 block mt-0.5">{task.description}</span>}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Checklist with Photo Upload verification */}
                {activeStage.checklists.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-slate-550" /> Quality Checkpoints
                    </Label>
                    <div className="space-y-2">
                      {activeStage.checklists.map(chk => (
                        <div key={chk.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                          <div className="flex items-center gap-2.5">
                            <Checkbox 
                              checked={chk.isCompleted} 
                              onCheckedChange={() => handleChecklistToggle(chk.id, chk.isCompleted, photoProofInputs[chk.id] || chk.photoUrl)}
                              disabled={!canWrite || submitting || activeStage.status !== 'IN_PROGRESS'}
                            />
                            <div>
                              <span className={`text-xs font-semibold block ${chk.isCompleted ? 'text-slate-500' : 'text-slate-800'}`}>
                                {chk.label}
                              </span>
                              {chk.isMandatory && (
                                <Badge className="bg-red-50 text-red-600 text-[9px] hover:bg-red-50 border border-red-100 mt-1">Mandatory Gate</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {activeStage.status === 'IN_PROGRESS' && !chk.photoUrl && (
                              <Input
                                aria-label={`Photo proof URL for ${chk.label}`}
                                className="h-7 w-52 text-[10px] text-slate-900"
                                placeholder="Photo proof URL"
                                value={photoProofInputs[chk.id] || ''}
                                onChange={(event) => setPhotoProofInputs(current => ({ ...current, [chk.id]: event.target.value }))}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    handleChecklistToggle(chk.id, chk.isCompleted, event.currentTarget.value);
                                  }
                                }}
                              />
                            )}
                            {chk.photoUrl ? (
                              <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-semibold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                <Camera className="w-3.5 h-3.5" /> Proof Attached
                              </div>
                            ) : (
                              activeStage.status === 'IN_PROGRESS' && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Camera className="w-3.5 h-3.5 text-slate-350" /> Photo Required
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Center Sidebar (Approvals / Transitions) */}
          <div className="space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4.5 h-4.5 text-blue-600" /> Stage Gates & Approvals
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">Sign-off approvals needed to complete this stage.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {activeStage.approvals.length === 0 ? (
                  <p className="text-xs text-slate-500">No approvals configured for this stage.</p>
                ) : (
                  activeStage.approvals.map(app => (
                    <div key={app.id} className="p-3.5 rounded-xl border bg-slate-50/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Level {app.level} ({app.role.replace(/_/g, ' ')})</span>
                        <Badge className={
                          app.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          app.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }>
                          {app.status}
                        </Badge>
                      </div>

                      {canApprove && app.status === 'PENDING' && activeStage.status === 'IN_PROGRESS' && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleApprovalSubmit(app.id, 'REJECTED')}
                            className="flex-1 text-xs text-red-600 hover:text-red-700 h-8"
                          >
                            Reject
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleApprovalSubmit(app.id, 'APPROVED')}
                            className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                          >
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Design/CAD/BOQ review loop */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" /> Review handoff
                    </Label>
                    <span className="text-[10px] text-slate-600">{activeStage.code || activeStage.name}</span>
                  </div>
                  {canWrite && (activeStage.status === 'IN_PROGRESS' || activeStage.status === 'CHANGES_REQUESTED') && (
                    <>
                      <textarea
                        aria-label="Review notes"
                        className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder={activeStage.status === 'CHANGES_REQUESTED' ? 'Explain rework completed before resubmitting' : 'Add handoff or review context'}
                        value={reviewNotes}
                        onChange={(event) => setReviewNotes(event.target.value)}
                      />
                      <Button
                        onClick={() => handleReviewAction(activeStage.status === 'CHANGES_REQUESTED' ? 'resubmit' : 'submit')}
                        disabled={submitting}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      >
                        {activeStage.status === 'CHANGES_REQUESTED' ? <RefreshCcw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {activeStage.status === 'CHANGES_REQUESTED' ? 'Resubmit after rework' : 'Submit for review'}
                      </Button>
                    </>
                  )}
                  {canApprove && activeStage.status === 'IN_REVIEW' && (
                    <>
                      <textarea
                        aria-label="Review decision notes"
                        className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Add review decision or required changes"
                        value={reviewNotes}
                        onChange={(event) => setReviewNotes(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => handleReviewAction('decide', 'CHANGES_REQUESTED')} disabled={submitting} variant="outline" className="flex-1 text-xs text-amber-700 border-amber-300 hover:bg-amber-50">
                          Request changes
                        </Button>
                        <Button onClick={() => handleReviewAction('decide', 'APPROVED')} disabled={submitting} className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                          Approve review
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Transition Action Buttons */}
                <div className="border-t pt-4 space-y-2">
                  {canApprove && activeStage.status === 'PENDING' && (
                    <Button 
                      onClick={() => handleStartStage(activeStage.id)} 
                      disabled={submitting}
                      className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-xs py-2"
                    >
                      <Play className="w-4 h-4 fill-white" /> Start Stage Work
                    </Button>
                  )}
                  {canApprove && activeStage.status === 'IN_PROGRESS' && (
                    <Button 
                      onClick={() => handleCompleteStage(activeStage.id)} 
                      disabled={submitting}
                      className="w-full gap-2 bg-green-600 hover:bg-green-700 text-xs py-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Verify & Complete Stage
                    </Button>
                  )}
                  {activeStage.status === 'COMPLETED' && (
                    <div className="flex items-center gap-1.5 justify-center text-xs text-green-650 font-bold bg-green-50/50 p-2.5 rounded-lg border border-green-100">
                      <ShieldCheck className="w-4 h-4" /> Stage Complete & Verified
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Validation Failures Dialog */}
      <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-650">
              <AlertTriangle className="w-5 h-5 text-red-600" /> Stage Transition Blocked
            </DialogTitle>
            <DialogDescription>
              The stage could not be closed due to unmet gate parameters or missing checks:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 bg-slate-50 p-4 rounded-lg border text-xs text-slate-700 max-h-60 overflow-y-auto font-medium">
            {validationErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-red-500">•</span>
                <span>{err}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsErrorDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
