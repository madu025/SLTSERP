"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, CheckCircle2, Upload, ArrowRight } from 'lucide-react';

interface ProjectAssetRegisterProps { project: any; }

export default function ProjectAssetRegister({ project }: ProjectAssetRegisterProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => { fetchAssets(); }, [project.id, typeFilter]);

  const fetchAssets = async () => {
    try {
      const params = typeFilter !== 'ALL' ? `?assetType=${typeFilter}` : '';
      const res = await fetch(`/api/projects/${project.id}/assets${params}`);
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleTransferToNOC = async (assetId: string) => {
    try {
      await fetch(`/api/projects/${project.id}/assets/${assetId}/transfer`, { method: 'POST' });
      fetchAssets();
    } catch (err) { console.error(err); }
  };

  const getAssetIcon = (type: string) => {
    const icons: Record<string, string> = {
      FIBER_ROUTE: '🔗', FIBER_CABLE: '🔌', POLE: '📡', CHAMBER: '⬛',
      CLOSURE: '🔘', ODF: '📋', SPLICE_TRAY: '🔲'
    };
    return icons[type] || '📦';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Asset Register Automation</h3>
          <p className="text-sm text-slate-500">Automatically register completed assets and transfer to Network Operations</p>
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="FIBER_ROUTE">Fiber Routes</SelectItem>
              <SelectItem value="FIBER_CABLE">Fiber Cables</SelectItem>
              <SelectItem value="POLE">Poles</SelectItem>
              <SelectItem value="CHAMBER">Chambers</SelectItem>
              <SelectItem value="CLOSURE">Closures</SelectItem>
              <SelectItem value="ODF">ODFs</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2"><Database className="w-4 h-4" /> Auto-Register from GIS</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total Assets</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{assets.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{assets.filter(a => a.status === 'ACTIVE').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Transferred to NOC</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{assets.filter(a => a.transferredToNOC).length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Pending Transfer</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{assets.filter(a => !a.transferredToNOC && a.status === 'ACTIVE').length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Type</TableHead><TableHead>Asset Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>NOC Transfer</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset: any) => (
                <TableRow key={asset.id}>
                  <TableCell><Badge variant="outline">{getAssetIcon(asset.assetType)} {asset.assetType?.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{asset.assetCode || '-'}</TableCell>
                  <TableCell className="font-medium">{asset.assetName}</TableCell>
                  <TableCell><Badge className={asset.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>{asset.status}</Badge></TableCell>
                  <TableCell><span className="text-xs text-slate-500">{asset.sourceType?.replace(/_/g, ' ') || '-'}</span></TableCell>
                  <TableCell>
                    {asset.transferredToNOC ? (
                      <Badge className="bg-blue-100 text-blue-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Transferred</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleTransferToNOC(asset.id)}>
                        <ArrowRight className="w-3 h-3 mr-1" /> Transfer
                      </Button>
                    )}
                  </TableCell>
                  <TableCell><Button variant="ghost" size="sm">View</Button></TableCell>
                </TableRow>
              ))}
              {assets.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No assets registered yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
