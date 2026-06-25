"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Download, FileJson, Layers, BarChart3, Loader2, CheckCircle2, AlertTriangle, Map
} from 'lucide-react';
import { toast } from 'sonner';

interface ComparisonLayer {
  layerId: string;
  layerName: string;
  surveyed: number;
  approved: number;
  installed: number;
}

interface AsBuiltComparison {
  layers: ComparisonLayer[];
  totalSurveyed: number;
  totalApproved: number;
  totalInstalled: number;
}

interface ProjectAsBuiltProps {
  project: { id: string; name?: string };
}

const SURVEY_LAYERS = [
  { id: 'fiber_route', name: 'Fiber Route' },
  { id: 'handhole', name: 'Handhole' },
  { id: 'joint_closure', name: 'Joint Closure' },
  { id: 'cabinet', name: 'Cabinet' },
  { id: 'pole', name: 'Pole' },
  { id: 'duct', name: 'Duct' },
  { id: 'customer_premise', name: 'Customer Premise' },
  { id: 'splitter', name: 'Splitter' },
  { id: 'onu', name: 'ONU' },
  { id: 'access_point', name: 'Access Point' },
  { id: 'building_entry', name: 'Building Entry' },
  { id: 'repeater', name: 'Repeater' },
];

function pct(a: number, b: number) {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}

export default function ProjectAsBuilt({ project }: ProjectAsBuiltProps) {
  const [comparison, setComparison] = useState<AsBuiltComparison | null>(null);
  const [compLoading, setCompLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState('');

  const fetchComparison = useCallback(async () => {
    try {
      setCompLoading(true);
      const res = await fetch(`/api/projects/${project.id}/as-built?format=comparison`, {
        headers: { 'x-user-id': 'current-user' },
      });
      if (res.ok) setComparison(await res.json());
    } catch {
      // comparison may not be critical
    } finally {
      setCompLoading(false);
    }
  }, [project.id]);

  useEffect(() => { fetchComparison(); }, [fetchComparison]);

  const handleDownload = async (format: string, label: string, layerId?: string) => {
    const key = layerId ? `layer-${layerId}` : format;
    setDownloading(key);
    try {
      let url = `/api/projects/${project.id}/as-built?format=${format}`;
      if (layerId) url += `&layerId=${layerId}`;
      const res = await fetch(url, { headers: { 'x-user-id': 'current-user' } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${project.id}-${label.toLowerCase().replace(/\s/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`${label} downloaded`);
    } catch {
      toast.error(`Failed to download ${label}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-foreground">As-Built Output</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Export QGIS GeoJSON, CAD blocks, or view surveyed vs installed comparison</p>
      </div>

      {/* Export Format Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* QGIS Export */}
        <Card className="border-border shadow-none hover:border-primary/30 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-green-500/10 rounded-lg text-green-600">
                <Map className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[9px] border-green-500/20 text-green-700 bg-green-500/5">GeoJSON</Badge>
            </div>
            <CardTitle className="text-sm font-bold mt-2">QGIS Full Export</CardTitle>
            <CardDescription className="text-[11px]">All 12 survey layers exported as GeoJSON for QGIS import</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Button
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => handleDownload('qgis', 'QGIS Export')}
              disabled={downloading === 'qgis'}
            >
              {downloading === 'qgis' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download QGIS Package
            </Button>
          </CardContent>
        </Card>

        {/* CAD Export */}
        <Card className="border-border shadow-none hover:border-primary/30 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                <FileJson className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[9px] border-blue-500/20 text-blue-700 bg-blue-500/5">CAD Blocks</Badge>
            </div>
            <CardTitle className="text-sm font-bold mt-2">CAD Block Export</CardTitle>
            <CardDescription className="text-[11px]">CAD-compatible block format for AutoCAD / MicroStation</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => handleDownload('cad', 'CAD Export')}
              disabled={downloading === 'cad'}
            >
              {downloading === 'cad' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download CAD Blocks
            </Button>
          </CardContent>
        </Card>

        {/* Single Layer Export */}
        <Card className="border-border shadow-none hover:border-primary/30 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600">
                <Layers className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[9px] border-purple-500/20 text-purple-700 bg-purple-500/5">Single Layer</Badge>
            </div>
            <CardTitle className="text-sm font-bold mt-2">Single Layer Export</CardTitle>
            <CardDescription className="text-[11px]">Export one specific survey layer as GeoJSON</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <Select value={selectedLayer} onValueChange={setSelectedLayer}>
              <SelectTrigger className="h-7 text-xs bg-card border-border">
                <SelectValue placeholder="Select layer…" />
              </SelectTrigger>
              <SelectContent>
                {SURVEY_LAYERS.map(l => <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              disabled={!selectedLayer || downloading === `layer-${selectedLayer}`}
              onClick={() => selectedLayer && handleDownload('layer', SURVEY_LAYERS.find(l => l.id === selectedLayer)?.name ?? selectedLayer, selectedLayer)}
            >
              {downloading === `layer-${selectedLayer}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download Layer
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Table */}
      <Card className="border-border shadow-none">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Surveyed vs Approved vs Installed
            </CardTitle>
            <CardDescription className="text-[11px] mt-0.5">Per-layer completion comparison</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => handleDownload('comparison', 'Comparison Report')}
            disabled={downloading === 'comparison'}
          >
            {downloading === 'comparison' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {compLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading comparison data...
            </div>
          ) : !comparison || comparison.layers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <AlertTriangle className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
              No comparison data available yet.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 pl-3">Layer</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-center">Surveyed</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-center">Approved</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-center">Installed</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 text-center">Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.layers.map((layer) => {
                    const completionPct = pct(layer.installed, layer.surveyed);
                    return (
                      <TableRow key={layer.layerId} className="border-border text-xs hover:bg-muted/40">
                        <TableCell className="pl-3 font-medium text-foreground">{layer.layerName}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{layer.surveyed}</TableCell>
                        <TableCell className="text-center">
                          <span className={layer.approved >= layer.surveyed ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                            {layer.approved}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-foreground">{layer.installed}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-16 bg-muted rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${completionPct >= 100 ? 'bg-green-500' : completionPct >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(100, completionPct)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-8">{completionPct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-3 p-3 border-t border-border bg-muted/20">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Surveyed</p>
                  <p className="text-sm font-bold text-foreground">{comparison.totalSurveyed}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Approved</p>
                  <p className="text-sm font-bold text-green-600">{comparison.totalApproved}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Installed</p>
                  <p className="text-sm font-bold text-blue-600">{comparison.totalInstalled}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
