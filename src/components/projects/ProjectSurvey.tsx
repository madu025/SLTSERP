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
import { AlertTriangle, Plus, RefreshCw, Cloud, UploadCloud, Activity, Settings, Download } from 'lucide-react';
import { toast } from 'sonner';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface ProjectRef {
  id: string;
  name: string;
  projectCode: string;
  gisMapping?: {
    qfieldProjectId?: string;
    [key: string]: unknown;
  } | null;
}

interface ProjectSurveyProps {
  project: ProjectRef;
}

interface SurveyRequest {
  id: string;
  requestNumber: string;
  title: string;
  surveyType: string;
  status: string;
  findings?: unknown[];
  photos?: unknown[];
  estimatedBOQ: number | null;
}

interface SyncLog {
  id: string;
  projectId?: string;
  startedAt: string | Date;
  syncType: string;
  status: string;
  featuresCount: number;
  errorMessage: string | null;
}

interface SyncStatus {
  projectId?: string;
  summary?: {
    lastSync: string | null;
    lastSyncFeatures: number;
    totalPoints: number;
  };
  syncHistory?: SyncLog[];
}

export default function ProjectSurvey({ project }: ProjectSurveyProps) {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSurvey, setNewSurvey] = useState({ title: '', surveyType: 'ROUTE_SURVEY', priority: 'MEDIUM', description: '', assignedToId: '', assignedTeamId: '' });

  // Staff and team lists for assignment dropdowns
  const [staffList, setStaffList] = useState<{ id: string; name: string; designation: string; employeeId: string }[]>([]);
  const [teamList, setTeamList] = useState<{ id: string; name: string; contractor?: { name: string } }[]>([]);

  // Fetch staff and teams when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      const fetchAssignLists = async () => {
        try {
          const [staffRes, teamsRes] = await Promise.all([
            fetch('/api/staff'),
            fetch('/api/contractors/teams')
          ]);
          if (staffRes.ok) setStaffList(await staffRes.json());
          if (teamsRes.ok) setTeamList(await teamsRes.json());
        } catch (err) {
          console.error('Failed to fetch assignment lists:', err);
        }
      };
      fetchAssignLists();
    }
  }, [dialogOpen]);

  // QFieldCloud Sync States
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [manualProjectId, setManualProjectId] = useState('');
  const [linking, setLinking] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);
  const [autoCreateFailed, setAutoCreateFailed] = useState(false);

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/surveys`);
      const data = await res.json();
      setSurveys(data);
    } catch (err) {
      console.error('Failed to fetch surveys:', err);
    }
  }, [project.id]);

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
  }, [project.id, project.gisMapping?.qfieldProjectId, manualProjectId]);

  useEffect(() => { 
    fetchSurveys(); 
    fetchSyncStatus();
  }, [fetchSurveys, fetchSyncStatus]);

  // Auto-create QFieldCloud project if disconnected and not already creating/failed
  useEffect(() => {
    if (!syncLoading && !project.gisMapping?.qfieldProjectId && !autoCreating && !autoCreateFailed) {
      const autoCreate = async () => {
        setAutoCreating(true);
        try {
          const res = await fetch(`/api/projects/${project.id}/qfield-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
            body: JSON.stringify({ action: 'create_project' })
          });
          const data = await res.json();
          if (res.ok) {
            toast.success(data.message || 'QFieldCloud project initialized automatically!');
            fetchSyncStatus();
          } else {
            setAutoCreateFailed(true);
            toast.error(data.error || 'Failed to auto-initialize QFieldCloud workspace');
          }
        } catch (err) {
          setAutoCreateFailed(true);
          console.error('Auto-creation error:', err);
          toast.error('Failed to auto-create QFieldCloud project');
        } finally {
          setAutoCreating(false);
        }
      };
      autoCreate();
    }
  }, [project.gisMapping?.qfieldProjectId, syncLoading, autoCreating, autoCreateFailed, project.id, fetchSyncStatus]);

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
      console.error('Create error:', err);
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
      console.error('Link error:', err);
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
      console.error('Sync error:', err);
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
      console.error('Push error:', err);
      toast.error('Push operation failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreate = async () => {
    try {
      const payload = {
        ...newSurvey,
        assignedToId: newSurvey.assignedToId === 'none' ? null : newSurvey.assignedToId || null,
        assignedTeamId: newSurvey.assignedTeamId === 'none' ? null : newSurvey.assignedTeamId || null
      };
      await fetch(`/api/projects/${project.id}/surveys`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      setDialogOpen(false);
      setNewSurvey({ title: '', surveyType: 'ROUTE_SURVEY', priority: 'MEDIUM', description: '', assignedToId: '', assignedTeamId: '' });
      fetchSurveys();
    } catch (err) {
      console.error('Create survey request failed:', err);
    }
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
            <div className="p-6 flex flex-col items-center justify-center text-center bg-white rounded-lg border border-dashed border-indigo-200">
              {autoCreating ? (
                <div className="space-y-3 py-4 max-w-md">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600 animate-pulse">
                    <Cloud className="w-6 h-6 animate-bounce" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Auto-configuring QFieldCloud Project...</h4>
                  <p className="text-xs text-slate-500">
                    We are automatically creating a dedicated survey workspace and uploading the 12 fiber layout layers (poles, cables, closures) to your self-hosted QFieldCloud server.
                  </p>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full animate-pulse rounded-full" style={{ width: '60%' }} />
                  </div>
                </div>
              ) : autoCreateFailed ? (
                <div className="space-y-3 py-2 max-w-md">
                  <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">QFieldCloud Workspace Initialization Failed</h4>
                  <p className="text-xs text-slate-500">
                    The system could not automatically set up the project on the QFieldCloud server. Please ensure the server is online and configure it manually below.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <Button size="sm" onClick={() => { setAutoCreateFailed(false); }} className="bg-indigo-600 hover:bg-indigo-700">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Auto-Create
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowManualForm(!showManualForm)} className="bg-white">
                      <Settings className="w-3.5 h-3.5 mr-1.5" /> Manual Setup
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-4 max-w-md">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Disconnected from QFieldCloud</h4>
                  <p className="text-xs text-slate-500">
                    This project is not linked to any survey mapping workspace. Click below to initialize or paste a project ID.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <Button size="sm" onClick={handleCreateQFieldProject} className="bg-indigo-600 hover:bg-indigo-700">
                      Create QFieldCloud Project
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowManualForm(!showManualForm)} className="bg-white">
                      Link Manually
                    </Button>
                  </div>
                </div>
              )}

              {showManualForm && (
                <div className="mt-4 pt-4 border-t border-slate-100 w-full max-w-lg text-left space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">Manual Project Link (Enter UUID)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={manualProjectId} 
                      onChange={(e) => setManualProjectId(e.target.value)} 
                      placeholder="QFieldCloud Project UUID (e.g. 5915a97a-...)" 
                      className="h-8 text-xs bg-white"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleManualLinkProject} 
                      disabled={linking}
                      className="h-8 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {linking ? "Linking..." : "Link Project"}
                    </Button>
                  </div>
                </div>
              )}
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `/api/projects/${project.id}/export/gpkg`;
                      link.download = '';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast.success('Downloading GeoPackage...');
                    }}
                    className="bg-white border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <Download className="w-3.5 h-3.5 mr-2" />
                    Export GPKG
                  </Button>
                </div>
              </div>

              {/* Sync History Logs */}
              {syncStatus?.syncHistory && syncStatus.syncHistory.length > 0 && (
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
                        {syncStatus?.syncHistory?.slice(0, 5).map((log: SyncLog) => (
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
                            <TableCell className="py-1 text-slate-500 max-w-[200px] truncate" title={log.errorMessage || undefined}>
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Findings</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-600">{surveys.reduce((sum: number, s: SurveyRequest) => sum + (s.findings?.length || 0), 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Request #</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Findings</TableHead><TableHead>Photos</TableHead><TableHead>Est. BOQ</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey: SurveyRequest) => (
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned Surveyor</Label>
                <Select value={newSurvey.assignedToId} onValueChange={(v) => setNewSurvey({ ...newSurvey, assignedToId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select surveyor (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.designation} - {s.employeeId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned Team</Label>
                <Select value={newSurvey.assignedTeamId} onValueChange={(v) => setNewSurvey({ ...newSurvey, assignedTeamId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select team (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {teamList.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.contractor ? `${t.name} (${t.contractor.name})` : t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
