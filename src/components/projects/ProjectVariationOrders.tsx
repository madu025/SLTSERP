"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileEdit, Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface ProjectVariationOrdersProps { project: any; }

export default function ProjectVariationOrders({ project }: ProjectVariationOrdersProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrders(); }, [project.id]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/variations`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount || 0);

  const totalVariation = orders.reduce((sum: number, o: any) => sum + (o.costImpact || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Variation Orders</h3>
          <p className="text-sm text-slate-500">Track deviation requests, cost impact, and approval workflow</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> New Variation Order</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total Variations</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{orders.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Net Cost Impact</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${totalVariation >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(totalVariation)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Pending Approval</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{orders.filter(o => o.status === 'PENDING' || o.status === 'SUBMITTED').length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>VO #</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Cost Impact</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((vo: any) => (
                <TableRow key={vo.id}>
                  <TableCell className="font-mono text-xs">{vo.variationNumber || vo.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{vo.title || vo.description}</TableCell>
                  <TableCell><Badge variant="outline">{vo.variationType || 'SCOPE_CHANGE'}</Badge></TableCell>
                  <TableCell className={vo.costImpact >= 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                    {vo.costImpact >= 0 ? '+' : ''}{formatCurrency(vo.costImpact || 0)}
                  </TableCell>
                  <TableCell><Badge className={
                    vo.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    vo.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }>{vo.status}</Badge></TableCell>
                  <TableCell>{vo.createdAt ? new Date(vo.createdAt).toLocaleDateString() : '-'}</TableCell>
                  <TableCell><Button variant="outline" size="sm">Review</Button></TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No variation orders</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
