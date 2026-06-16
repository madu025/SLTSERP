"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Activity, CheckCircle2, XCircle, AlertTriangle, Eye } from 'lucide-react';

interface ProjectOTDRProps { project: any; }

export default function ProjectOTDR({ project }: ProjectOTDRProps) {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTests(); }, [project.id]);

  const fetchTests = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/otdr`);
      const data = await res.json();
      setTests(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getResultBadge = (result: string) => {
    const config: Record<string, any> = {
      PASS: { className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      FAIL: { className: 'bg-red-100 text-red-700', icon: XCircle },
      BORDERLINE: { className: 'bg-amber-100 text-amber-700', icon: AlertTriangle }
    };
    const { className, icon: Icon } = config[result] || { className: 'bg-slate-100 text-slate-700', icon: Activity };
    return <Badge className={className}><Icon className="w-3 h-3 mr-1" />{result}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fiber Testing (OTDR)</h3>
          <p className="text-sm text-slate-500">OTDR trace file management with auto pass/fail analysis</p>
        </div>
        <Button className="gap-2"><Upload className="w-4 h-4" /> Upload Trace File</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total Tests</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{tests.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Passed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{tests.filter(t => t.autoResult === 'PASS').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Failed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{tests.filter(t => t.autoResult === 'FAIL').length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Pending Review</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{tests.filter(t => t.autoResult === null || t.status === 'PENDING_REVIEW').length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Test #</TableHead><TableHead>Date</TableHead><TableHead>Fiber</TableHead><TableHead>Wave.</TableHead><TableHead>Length</TableHead><TableHead>Loss/km</TableHead><TableHead>ORL</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((test: any) => (
                <TableRow key={test.id}>
                  <TableCell className="font-mono text-xs">{test.testNumber}</TableCell>
                  <TableCell>{new Date(test.testDate).toLocaleDateString()}</TableCell>
                  <TableCell>{test.fiberNumber || '-'}</TableCell>
                  <TableCell>{test.wavelength ? `${test.wavelength}nm` : '-'}</TableCell>
                  <TableCell>{test.totalLength ? `${test.totalLength.toFixed(2)} km` : '-'}</TableCell>
                  <TableCell className={test.lossPerKm && test.lossPerKm > 0.3 ? 'text-red-600 font-medium' : ''}>
                    {test.lossPerKm ? `${test.lossPerKm.toFixed(3)} dB/km` : '-'}
                  </TableCell>
                  <TableCell>{test.orl ? `${test.orl.toFixed(1)} dB` : '-'}</TableCell>
                  <TableCell>{test.autoResult ? getResultBadge(test.autoResult) : '-'}</TableCell>
                  <TableCell><Badge variant="outline">{test.status?.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {tests.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-500">No OTDR tests recorded</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
