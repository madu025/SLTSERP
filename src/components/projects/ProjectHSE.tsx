"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Shield, AlertTriangle, CheckCircle2, Users, FileText, Plus } from 'lucide-react';

interface ProjectHSEProps { project: any; }

export default function ProjectHSE({ project }: ProjectHSEProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { fetchLogs(); }, [project.id, filter]);

  const fetchLogs = async () => {
    try {
      const params = filter !== 'ALL' ? `?logType=${filter}` : '';
      const res = await fetch(`/api/projects/${project.id}/hse${params}`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = { TOOLBOX_TALK: Users, INCIDENT: AlertTriangle, NEAR_MISS: AlertTriangle, PPE_CHECK: Shield, INSPECTION: FileText, ENVIRONMENTAL: FileText };
    const Icon = icons[type] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = { LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700', HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700' };
    return severity ? <Badge className={colors[severity] || ''}>{severity}</Badge> : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Health, Safety & Environment</h3>
          <p className="text-sm text-slate-500">Toolbox talks, incident reporting, PPE checklists, and environmental logs</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> New Safety Log</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'TOOLBOX_TALK', 'INCIDENT', 'NEAR_MISS', 'PPE_CHECK', 'INSPECTION', 'ENVIRONMENTAL'].map(t => (
          <Button key={t} variant={filter === t ? 'default' : 'outline'} size="sm" onClick={() => setFilter(t)}>
            {t.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total Logs</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{logs.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Incidents</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{logs.filter(l => l.logType === 'INCIDENT').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Open Issues</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{logs.filter(l => l.status === 'OPEN').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Stage Blocks</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-600">{logs.filter(l => l.blocksStage).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Type</TableHead><TableHead>Title</TableHead><TableHead>Date</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Blocks Stage</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell><Badge variant="outline" className="gap-1">{getTypeIcon(log.logType)}{log.logType?.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="font-medium">{log.title}</TableCell>
                  <TableCell>{new Date(log.date).toLocaleDateString()}</TableCell>
                  <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                  <TableCell><Badge variant="outline">{log.status}</Badge></TableCell>
                  <TableCell>{log.blocksStage ? <Badge className="bg-red-100 text-red-700">BLOCKED</Badge> : <Badge className="bg-green-100 text-green-700">Clear</Badge>}</TableCell>
                  <TableCell><Button variant="outline" size="sm">View</Button></TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No safety logs recorded</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Safety Log Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Log Type</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOOLBOX_TALK">Toolbox Talk</SelectItem>
                  <SelectItem value="INCIDENT">Incident Report</SelectItem>
                  <SelectItem value="NEAR_MISS">Near Miss</SelectItem>
                  <SelectItem value="PPE_CHECK">PPE Checklist</SelectItem>
                  <SelectItem value="INSPECTION">Safety Inspection</SelectItem>
                  <SelectItem value="ENVIRONMENTAL">Environmental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Safety log title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the safety event..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button>Create Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
