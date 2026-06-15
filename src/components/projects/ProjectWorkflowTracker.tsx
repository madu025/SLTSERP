import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CheckCircle2, 
  Play, 
  AlertTriangle, 
  FileText, 
  MapPin, 
  Camera, 
  ShieldCheck, 
  Lock, 
  Loader2, 
  CheckSquare, 
  ListTodo, 
  Workflow, 
  ChevronRight,
  HardHat,
  SearchCode
} from 'lucide-react';
import { format } from 'date-fns';

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

interface Stage {
  id: string;
  name: string;
  description: string | null;
  sequence: number;
  status: string; // PENDING, IN_PROGRESS, COMPLETED, BLOCKED
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
}

interface ProjectWorkflowTrackerProps {
  project: Project;
}

export default function ProjectWorkflowTracker({ project }: ProjectWorkflowTrackerProps) {
  const [workflow, setWorkflow] = useState<ProjectWorkflow | null>(null);
  const [activeStage, setActiveStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

  // Simulation ID
  const [userId] = useState('usr-admin-1');

  useEffect(() => {
    fetchWorkflow();
  }, [project.id]);

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/workflow`);
      if (res.ok) {
        const data = await res.json();
        setWorkflow(data);
        const current = data.stages.find((s: Stage) => s.status === 'IN_PROGRESS') || data.stages[0];
        setActiveStage(current || null);
      }
    } catch (error) {
      console.error('Error fetching workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartStage = async (stageId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          status: 'IN_PROGRESS',
          userId,
        }),
      });

      if (res.ok) {
        await fetchWorkflow();
      }
    } catch (error) {
      console.error('Error starting stage:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteStage = async (stageId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          status: 'COMPLETED',
          userId,
        }),
      });

      if (res.ok) {
        await fetchWorkflow();
      } else {
        const errorData = await res.json();
        const errLines = errorData.error ? errorData.error.split('\n') : ['Failed to transition stage.'];
        setValidationErrors(errLines);
        setIsErrorDialogOpen(true);
      }
    } catch (error) {
      console.error('Error completing stage:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChecklistToggle = async (checklistId: string, currentVal: boolean) => {
    try {
      // Optimitic UI
      if (activeStage) {
        const updatedChecklists = activeStage.checklists.map(c => 
          c.id === checklistId ? { ...c, isCompleted: !currentVal } : c
        );
        setActiveStage({ ...activeStage, checklists: updatedChecklists });
      }

      await fetch(`/api/projects/${project.id}/workflow/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_checklist',
          checklistId,
          isCompleted: !currentVal,
          photoUrl: !currentVal ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=150&auto=format&fit=crop' : null // Mock photo proof
        }),
      });
      fetchWorkflow();
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
    try {
      await fetch(`/api/projects/${project.id}/workflow/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_task',
          taskId,
          status: nextStatus,
          progress: nextStatus === 'COMPLETED' ? 100 : 50,
        }),
      });
      fetchWorkflow();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleApprovalSubmit = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/workflow/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          status: decision,
          userId,
          comments: decision === 'APPROVED' ? 'Gate conditions met.' : 'Checklist specifications unmet.',
        }),
      });

      if (res.ok) {
        fetchWorkflow();
      }
    } catch (error) {
      console.error('Error actioning approval:', error);
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
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Workflow className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-semibold text-slate-700">No Workflow Blueprint Initialized</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Initialize a workflow mapping template to drive stage control, checklist checks, and automatic task gates.
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
            <h3 className="text-lg font-bold text-slate-900 mt-2">OSP Execution Workflow</h3>
            <p className="text-xs text-slate-550">Linear step progression mapping template with strict QA gate controls.</p>
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
                      {activeStage.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
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
                              disabled={activeStage.status !== 'IN_PROGRESS'}
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
                              onCheckedChange={() => handleChecklistToggle(chk.id, chk.isCompleted)}
                              disabled={activeStage.status !== 'IN_PROGRESS'}
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
                        <span className="text-xs font-bold text-slate-700">Level {app.level} ({app.role.replace('_', ' ')})</span>
                        <Badge className={
                          app.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          app.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }>
                          {app.status}
                        </Badge>
                      </div>

                      {app.status === 'PENDING' && activeStage.status === 'IN_PROGRESS' && (
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

                {/* Transition Action Buttons */}
                <div className="border-t pt-4 space-y-2">
                  {activeStage.status === 'PENDING' && (
                    <Button 
                      onClick={() => handleStartStage(activeStage.id)} 
                      disabled={submitting}
                      className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-xs py-2"
                    >
                      <Play className="w-4 h-4 fill-white" /> Start Stage Work
                    </Button>
                  )}
                  {activeStage.status === 'IN_PROGRESS' && (
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
