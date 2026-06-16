"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, AlertTriangle, CheckCircle2, Clock, XCircle, Upload, Plus } from 'lucide-react';

interface ProjectPermitsProps { project: any; }

export default function ProjectPermits({ project }: ProjectPermitsProps) {
  const [permits, setPermits] = useState<any[]>([]);
  const [permitTypes, setPermitTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPermit, setNewPermit] = useState({ permitTypeId: '', applicationDate: '', remarks: '' });

  useEffect(() => { fetchPermits(); fetchPermitTypes(); }, [project.id]);

  const fetchPermits = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/permits`);
      const data = await res.json();
      setPermits(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchPermitTypes = async () => {
    try {
      const res = await fetch('/api/projects/permits/types');
      const data = await res.json();
      setPermitTypes(data);
    } catch (err) { console.error(err); }
  };

  const handleCreatePermit = async () => {
    try {
      await fetch(`/api/projects/${project.id}/permits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPermit)
      });
      setDialogOpen(false);
      fetchPermits();
    } catch (err) { console.error(err); }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; icon: any }> = {
      DRAFT: { className: 'bg-slate-100 text-slate-700', icon: Clock },
      SUBMITTED: { className: 'bg-blue-100 text-blue-700', icon: FileText },
      APPROVED: { className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      REJECTED: { className: 'bg-red-100 text-red-700', icon: XCircle },
      EXPIRED: { className: 'bg-orange-100 text-orange-700', icon: AlertTriangle }
    };
    const { className, icon: Icon } = config[status] || config.DRAFT;
    return <Badge className={className}><Icon className="w-3 h-3 mr-1" />{status}</Badge>;
  };

  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const daysLeft = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Permits & Authority Approvals</h3>
          <p className="text-sm text-slate-500">Manage RDA, Municipal, Railway, CEB, and Water Board permits</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Permit Application
        </Button>
      </div>

      {/* Permit Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total Permits</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{permits.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Approved</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{permits.filter(p => p.status === 'APPROVED').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{permits.filter(p => p.status === 'SUBMITTED' || p.status === 'DRAFT').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Expiring Soon</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{permits.filter(p => isExpiringSoon(p.expiryDate)).length}</p></CardContent></Card>
      </div>

      {/* Permit Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permit Type</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Permit Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permits.map((permit: any) => (
                <TableRow key={permit.id}>
                  <TableCell className="font-medium">{permit.permitType?.name || '-'}</TableCell>
                  <TableCell>{permit.permitType?.authority?.shortName || '-'}</TableCell>
                  <TableCell>{permit.permitNumber || '-'}</TableCell>
                  <TableCell>{getStatusBadge(permit.status)}</TableCell>
                  <TableCell>{permit.applicationDate ? new Date(permit.applicationDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    {permit.expiryDate ? (
                      <span className={`${isExpiringSoon(permit.expiryDate) ? 'text-red-600 font-medium' : ''}`}>
                        {new Date(permit.expiryDate).toLocaleDateString()}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              ))}
              {permits.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No permits found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Permit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Permit Application</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Permit Type</Label>
              <Select value={newPermit.permitTypeId} onValueChange={(v) => setNewPermit({...newPermit, permitTypeId: v})}>
                <SelectTrigger><SelectValue placeholder="Select permit type" /></SelectTrigger>
                <SelectContent>
                  {permitTypes.map((pt: any) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name} ({pt.authority?.shortName})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Application Date</Label>
              <Input type="date" value={newPermit.applicationDate} onChange={(e) => setNewPermit({...newPermit, applicationDate: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={newPermit.remarks} onChange={(e) => setNewPermit({...newPermit, remarks: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePermit}>Create Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
