'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserRound, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

type AssignmentRole = 'LEAD_CONTROLLER' | 'PREPARER' | 'REVIEWER' | 'APPROVER';

interface ProjectFinanceAssignment {
  id: string;
  assignmentRole: AssignmentRole;
  status: 'ACTIVE' | 'ENDED';
  isPrimary: boolean;
  startsAt: string;
  endsAt?: string | null;
  notes?: string | null;
  user: { id: string; name?: string | null; username: string; email: string };
  assignedBy: { id: string; name?: string | null; username: string };
}

interface Candidate {
  id: string;
  name?: string | null;
  username: string;
  email: string;
  capabilities: string[];
}

interface Props {
  projectId: string;
}

const ROLE_LABELS: Record<AssignmentRole, string> = {
  LEAD_CONTROLLER: 'Lead project controller',
  PREPARER: 'Finance preparer',
  REVIEWER: 'Finance reviewer',
  APPROVER: 'Finance approver',
};

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    const message = typeof body.error === 'string' ? body.error : body.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // Keep the operation-specific fallback for non-JSON responses.
  }
  return fallback;
}

export default function ProjectFinanceAssignments({ projectId }: Props) {
  return <ProjectFinanceAssignmentsContent key={projectId} projectId={projectId} />;
}

function ProjectFinanceAssignmentsContent({ projectId }: Props) {
  const [canAssign, setCanAssign] = useState(false);
  useEffect(() => {
    const update = () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        setCanAssign(Array.isArray(user?.permissions) && user.permissions.includes(RBAC_PERMISSIONS.PROJECT_FINANCE_ASSIGN));
      } catch { setCanAssign(false); }
    };
    update();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  const [assignments, setAssignments] = useState<ProjectFinanceAssignment[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignmentRole, setAssignmentRole] = useState<AssignmentRole>('PREPARER');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/finance-assignments?projectId=${projectId}&includeCandidates=${canAssign}`);
      if (!response.ok) throw new Error(await responseError(response, 'Unable to load project finance assignments.'));
      const data = await response.json() as { assignments?: ProjectFinanceAssignment[]; candidates?: Candidate[] };
      setAssignments(data.assignments ?? []);
      setCandidates(data.candidates ?? []);
      setSelectedUserId((current) => current || data.candidates?.[0]?.id || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load project finance assignments.');
    } finally {
      setLoading(false);
    }
  }, [projectId, canAssign]);

  useEffect(() => { void load(); }, [load]);

  const assign = async () => {
    if (!canAssign) return;
    if (!selectedUserId) {
      toast.error('Select a finance team member first.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/projects/finance-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: selectedUserId,
          assignmentRole,
          startsAt: new Date(`${startsAt}T00:00:00.000Z`).toISOString(),
          isPrimary: assignmentRole === 'LEAD_CONTROLLER',
          notes: notes.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, 'Unable to assign the project finance role.'));
      toast.success('Project finance responsibility assigned.');
      setNotes('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to assign the project finance role.');
    } finally {
      setSubmitting(false);
    }
  };

  const endAssignment = async (id: string) => {
    if (!canAssign) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/projects/finance-assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'ENDED' }),
      });
      if (!response.ok) throw new Error(await responseError(response, 'Unable to end this assignment.'));
      toast.success('Project finance assignment ended.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to end this assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="project-finance-accountability">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-blue-800" />
            <h3 id="project-finance-accountability" className="text-lg font-semibold text-slate-900">Project finance accountability</h3>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Delivery remains with the Project team; this panel records who prepares, reviews, and approves the linked financial records.
          </p>
        </div>
        <Badge className="bg-blue-100 text-blue-900">Project / Finance control link</Badge>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-700"><Loader2 className="h-4 w-4 animate-spin" /> Loading accountability records…</div>
      ) : (
        <>
          {canAssign && <><div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
            <div>
              <Label htmlFor="project-finance-user">Finance team member</Label>
              <select id="project-finance-user" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="">Select an eligible user</option>
                {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.username} ({candidate.username})</option>)}
              </select>
              {candidates.length === 0 && <p className="mt-1 text-xs text-amber-800">No active user with the required finance capability and OPMC scope was found.</p>}
            </div>
            <div>
              <Label htmlFor="project-finance-role">Responsibility</Label>
              <select id="project-finance-role" value={assignmentRole} onChange={(event) => setAssignmentRole(event.target.value as AssignmentRole)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="project-finance-start">Starts on</Label>
              <Input id="project-finance-start" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 text-slate-900" />
            </div>
            <Button className="self-end" onClick={assign} disabled={submitting || !selectedUserId}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </div>
          <div className="mt-3 max-w-xl">
            <Label htmlFor="project-finance-notes">Handover / control note (optional)</Label>
            <Input id="project-finance-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Controller for approved BOQ and contractor invoices" className="mt-1 text-slate-900" />
          </div>

          </>}
          <div className="mt-5 space-y-2">
            {assignments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">No project-specific finance responsibilities have been assigned yet.</p>
            ) : assignments.map((assignment) => (
              <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start gap-3">
                  <UserRound className="mt-0.5 h-5 w-5 text-slate-700" />
                  <div>
                    <p className="font-medium text-slate-900">{assignment.user.name || assignment.user.username}</p>
                    <p className="text-sm text-slate-700">{ROLE_LABELS[assignment.assignmentRole]} · {assignment.user.email}</p>
                    {assignment.notes && <p className="text-xs text-slate-600">{assignment.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={assignment.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-800'}>{assignment.status}</Badge>
                  {assignment.isPrimary && <Badge className="bg-indigo-100 text-indigo-900">Primary</Badge>}
                  {canAssign && assignment.status === 'ACTIVE' && <Button size="sm" variant="outline" className="border-slate-300 text-slate-800" onClick={() => void endAssignment(assignment.id)} disabled={submitting}>End</Button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
