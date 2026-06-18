"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardCheck, Map, Camera, AlertTriangle, Plus } from 'lucide-react';

interface ProjectSurveyProps { project: any; }

export default function ProjectSurvey({ project }: ProjectSurveyProps) {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSurvey, setNewSurvey] = useState({ title: '', surveyType: 'ROUTE_SURVEY', priority: 'MEDIUM', description: '' });

  useEffect(() => { fetchSurveys(); }, [project.id]);

  const fetchSurveys = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/surveys`);
      const data = await res.json();
      setSurveys(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      await fetch(`/api/projects/${project.id}/surveys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSurvey) });
      setDialogOpen(false);
      fetchSurveys();
    } catch (err) { console.error(err); }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', ASSIGNED: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-purple-100 text-purple-700', COMPLETED: 'bg-green-100 text-green-700', APPROVED: 'bg-emerald-100 text-emerald-700' };
    return <Badge className={colors[status] || 'bg-slate-100 text-slate-700'}>{status.replace(/_/g, ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Survey Management</h3>
          <p className="text-sm text-slate-500">Site surveys, GPS tracking, photo collection, and initial BOQ estimation</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> New Survey Request</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total Surveys</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{surveys.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">In Progress</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-purple-600">{surveys.filter(s => s.status === 'IN_PROGRESS' || s.status === 'ASSIGNED').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{surveys.filter(s => s.status === 'COMPLETED' || s.status === 'APPROVED').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Findings</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-600">{surveys.reduce((sum: number, s: any) => sum + (s.findings?.length || 0), 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Request #</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Findings</TableHead><TableHead>Photos</TableHead><TableHead>Est. BOQ</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey: any) => (
                <TableRow key={survey.id}>
                  <TableCell className="font-mono text-xs">{survey.requestNumber}</TableCell>
                  <TableCell className="font-medium">{survey.title}</TableCell>
                  <TableCell><Badge variant="outline">{survey.surveyType}</Badge></TableCell>
                  <TableCell>{getStatusBadge(survey.status)}</TableCell>
                  <TableCell><Badge variant="outline">{survey.findings?.length || 0} issues</Badge></TableCell>
                  <TableCell><Badge variant="outline">{survey.photos?.length || 0}</Badge></TableCell>
                  <TableCell>{survey.estimatedBOQ ? `LKR ${(survey.estimatedBOQ).toLocaleString()}` : '-'}</TableCell>
                  <TableCell><Button variant="outline" size="sm">View</Button></TableCell>
                </TableRow>
              ))}
              {surveys.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">No surveys found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Survey Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={newSurvey.title} onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })} placeholder="Survey title" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Survey Type</Label>
                <Select value={newSurvey.surveyType} onValueChange={(v) => setNewSurvey({ ...newSurvey, surveyType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROUTE_SURVEY">Route Survey</SelectItem>
                    <SelectItem value="SITE_SURVEY">Site Survey</SelectItem>
                    <SelectItem value="FEASIBILITY">Feasibility Study</SelectItem>
                    <SelectItem value="TOPOGRAPHICAL">Topographical Survey</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newSurvey.priority} onValueChange={(v) => setNewSurvey({ ...newSurvey, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={newSurvey.description} onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Survey Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
