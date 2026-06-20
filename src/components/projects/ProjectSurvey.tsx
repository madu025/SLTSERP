"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardCheck, Map, Camera, AlertTriangle, Plus, RefreshCw, Cloud, Database, UploadCloud, CheckCircle2, Server, Clock, Activity, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectSurveyProps { project: any; }

export default function ProjectSurvey({ project }: ProjectSurveyProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSurvey, setNewSurvey] = useState({ title: '', surveyType: 'ROUTE_SURVEY', priority: 'MEDIUM', description: '' });

  // QFieldCloud Sync States
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [manualProjectId, setManualProjectId] = useState('');
  const [linking, setLinking] = useState(false);

  const fetchSurveys = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/surveys`);
      const data = await res.json();
      setSurveys(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchSyncStatus = useCallback(async () => {
    try {
      setSyncLoading(true);
      const res = await fetch(`/api/projects/${project.id}/qfield-sync`, {
        headers: { 'x-user-id': 'system' }
      });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
        if (data.projectId && !manualProjectId) {
          // prefill manual input if it is loaded
          setManualProjectId(project.gisMapping?.qfieldProjectId || '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch QFieldCloud sync status:', err);
    } finally {
      setSyncLoading(false);
    }
  }, [project.id, project.gisMapping?.qfieldProjectId]);

  useEffect(() => { 
    fetchSurveys(); 
    fetchSyncStatus();
  }, [project.id, fetchSyncStatus]);

  const handleCreateQFieldProject = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/qfield-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
        body: JSON.stringify({ action: 'create_project' })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'QFieldCloud project created successfully!');
        fetchSyncStatus();
      } else {
        toast.error(data.error || 'Failed to create QFieldCloud project');
      }
    } catch (err) {
      toast.error('Sync request failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleManualLinkProject = async () => {
    if (!manualProjectId.trim()) {
      toast.error('Please enter a valid QFieldCloud Project ID');
      return;
    }
    setLinking(true);
    try {
      // API expects qfieldProjectId and action full_sync or push_layers,
      // let's update project model directly using project update PATCH API or POST qfield-sync
      const res = await fetch(`/api/projects`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: project.id,
          name: project.name,
          projectCode: project.projectCode,
          gisMapping: { ...project.gisMapping, qfieldProjectId: manualProjectId.trim() }
        })
      });
      if (res.ok) {
        toast.success('Successfully linked QFieldCloud Project ID!');
        fetchSyncStatus();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to link project ID');
      }
    } catch (err) {
      toast.error('Link request failed');
    } finally {
      setLinking(false);
    }
  };

  const handleSyncQFieldData = async () => {
    const qfieldId = project.gisMapping?.qfieldProjectId || syncStatus?.syncHistory?.[0]?.projectId || manualProjectId;
    if (!qfieldId) {
      toast.error('No connected QFieldCloud Project found.');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/qfield-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
        body: JSON.stringify({ action: 'full_sync', qfieldProjectId: qfieldId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Sync complete! Synced points: ${data.result?.syncedPoints || 0}`);
        fetchSyncStatus();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (err) {
      toast.error('Sync operation failed');
    } finally {
      setSyncing(false);
    }
  };

  const handlePushLayerSchema = async () => {
    const qfieldId = project.gisMapping?.qfieldProjectId || manualProjectId;
    if (!qfieldId) {
      toast.error('No connected QFieldCloud Project found.');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/qfield-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
        body: JSON.stringify({ action: 'push_layers', qfieldProjectId: qfieldId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Layer schema pushed to QFieldCloud successfully!');
        fetchSyncStatus();
      } else {
        toast.error(data.error || 'Failed to push layers');
      }
    } catch (err) {
      toast.error('Push operation failed');
    } finally {
      setSyncing(false);
    }
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

      {/* QFieldCloud Integration Panel */}
      <Card className="border-indigo-100 bg-indigo-50/20">
        <CardHeader className="pb-3 border-b border-indigo-100/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-indigo-600" />
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">QFieldCloud Mobile Survey Integration</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Manage self-hosted QFieldCloud project connection and sync survey deltas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.gisMapping?.qfieldProjectId ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                Connected
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                Disconnected
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects/${project.id}/qfield-config`)}
              className="h-8 gap-1 bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <Settings className="w-3.5 h-3.5" />
              Configure Dropdowns
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchSyncStatus} 
              disabled={syncLoading || syncing}
              className="h-8 w-8 p-0 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(syncLoading || syncing) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {!project.gisMapping?.qfieldProjectId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Option A: Auto-Create Project</h4>
                <p className="text-xs text-slate-500">Create a new QFieldCloud project and push all 12 survey layer definitions automatically.</p>
                <Button 
                  size="sm" 
                  onClick={handleCreateQFieldProject} 
                  disabled={syncing}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 mr-2" />
                      Create QFieldCloud Project
                    </>
                  )}
                </Button>
              </div>
              <div className="space-y-2 border-l border-slate-200 pl-4">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Option B: Link Existing Project</h4>
                <p className="text-xs text-slate-500">Provide the UUID of an existing project on your self-hosted QFieldCloud server.</p>
                <div className="flex gap-2">
                  <Input 
                    value={manualProjectId} 
                    onChange={(e) => setManualProjectId(e.target.value)} 
                    placeholder="QFieldCloud Project UUID" 
                    className="h-8 text-xs bg-white"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleManualLinkProject} 
                    disabled={linking}
                    className="h-8 shrink-0 bg-white"
                  >
                    {linking ? "Linking..." : "Link Project"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-3 rounded-lg border border-indigo-100">
                <div className="text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-slate-500">Project UUID: </span>
                    <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded">{project.gisMapping.qfieldProjectId}</span>
                  </div>
                  {syncStatus?.summary && (
                    <div className="flex gap-4 text-slate-500 mt-1">
                      <span>Last Sync: {syncStatus.summary.lastSync ? new Date(syncStatus.summary.lastSync).toLocaleString() : 'Never'}</span>
                      <span>Synced Features: {syncStatus.summary.lastSyncFeatures || 0}</span>
                      <span>Total Survey Points: {syncStatus.summary.totalPoints || 0}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handlePushLayerSchema} 
                    disabled={syncing}
                    className="bg-white"
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                    Push Layer Schema
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSyncQFieldData} 
                    disabled={syncing}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        Sync QFieldCloud
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Sync History Logs */}
              {syncStatus?.syncHistory?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    Recent Sync Activity Logs
                  </h4>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow className="h-8">
                          <TableHead className="text-[10px] h-8 py-1">Time</TableHead>
                          <TableHead className="text-[10px] h-8 py-1">Type</TableHead>
                          <TableHead className="text-[10px] h-8 py-1">Status</TableHead>
                          <TableHead className="text-[10px] h-8 py-1">Features</TableHead>
                          <TableHead className="text-[10px] h-8 py-1">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncStatus.syncHistory.slice(0, 5).map((log: any) => (
                          <TableRow key={log.id} className="h-8 text-xs hover:bg-slate-50">
                            <TableCell className="py-1 font-mono text-[10px]">{new Date(log.startedAt).toLocaleString()}</TableCell>
                            <TableCell className="py-1">
                              <Badge variant="outline" className="text-[9px] py-0 px-1">{log.syncType}</Badge>
                            </TableCell>
                            <TableCell className="py-1">
                              <Badge className={
                                log.status === 'COMPLETED' 
                                  ? 'bg-green-100 text-green-800 text-[9px] py-0 px-1' 
                                  : 'bg-red-100 text-red-800 text-[9px] py-0 px-1'
                              }>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1">{log.featuresCount}</TableCell>
                            <TableCell className="py-1 text-slate-500 max-w-[200px] truncate" title={log.errorMessage}>
                              {log.errorMessage || 'Successful'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              <Input value={newSurvey.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSurvey({ ...newSurvey, title: e.target.value })} placeholder="Survey title" />
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
              <Textarea value={newSurvey.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSurvey({ ...newSurvey, description: e.target.value })} />
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
