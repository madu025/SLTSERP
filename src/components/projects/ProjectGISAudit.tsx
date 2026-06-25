"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Shield, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  source: string;
  changedAt: string;
  changedById?: string;
  changesSummary?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface AuditResult {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

interface ProjectGISAuditProps {
  project: { id: string };
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-green-500/10 text-green-700 border-green-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  DELETE: 'bg-red-500/10 text-red-700 border-red-500/20',
  ROLLBACK: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
};

const SOURCE_COLOR: Record<string, string> = {
  WEB: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  MOBILE: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  API: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  SYSTEM: 'bg-muted text-muted-foreground border-border',
};

const ENTITY_TYPES = ['ROUTE', 'POINT', 'LAYER', 'PROJECT', 'VERSION'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ROLLBACK'];
const SOURCES = ['WEB', 'MOBILE', 'API', 'SYSTEM'];

export default function ProjectGISAudit({ project }: ProjectGISAuditProps) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    source: '',
    from: '',
    to: '',
  });

  const fetchLogs = useCallback(async (p = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.action) params.set('action', filters.action);
      if (filters.source) params.set('source', filters.source);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const res = await fetch(`/api/projects/${project.id}/gis-audit?${params}`, {
        headers: { 'x-user-id': 'current-user' },
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [project.id, page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilterApply = () => { setPage(1); fetchLogs(1); };
  const handleClear = () => {
    setFilters({ entityType: '', action: '', source: '', from: '', to: '' });
    setPage(1);
  };

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">GIS Audit Trail</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Full history of all GIS data changes with source tracking</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => fetchLogs()}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-border shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <Select value={filters.entityType || 'all'} onValueChange={v => setFilters(f => ({ ...f, entityType: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-7 text-xs w-32 bg-card border-border"><SelectValue placeholder="Entity Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Entities</SelectItem>
                {ENTITY_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.action || 'all'} onValueChange={v => setFilters(f => ({ ...f, action: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-7 text-xs w-28 bg-card border-border"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Actions</SelectItem>
                {ACTIONS.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.source || 'all'} onValueChange={v => setFilters(f => ({ ...f, source: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-7 text-xs w-28 bg-card border-border"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Sources</SelectItem>
                {SOURCES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="h-7 text-xs w-36 bg-card border-border"
              value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              placeholder="From"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              className="h-7 text-xs w-36 bg-card border-border"
              value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              placeholder="To"
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleFilterApply}>Apply</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleClear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading audit logs...
        </div>
      )}

      {/* Empty */}
      {!loading && (!result || result.logs.length === 0) && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No audit logs found for the selected filters.
        </div>
      )}

      {/* Audit Table */}
      {!loading && result && result.logs.length > 0 && (
        <Card className="border-border shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8 pl-3">Timestamp</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8">Entity</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8">Action</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8">Source</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-muted-foreground h-8">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.logs.map((log) => (
                <TableRow key={log.id} className="border-border text-xs hover:bg-muted/40">
                  <TableCell className="pl-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.changedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{log.entityType}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">{log.entityId.slice(0, 8)}…</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[9px] px-1.5 py-0 border ${ACTION_COLOR[log.action] ?? 'bg-muted text-muted-foreground border-border'}`}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${SOURCE_COLOR[log.source] ?? ''}`}>
                      {log.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {log.changesSummary ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground">
                Page {page} of {totalPages} — {result.total} total logs
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={page <= 1}
                  onClick={() => { setPage(p => p - 1); fetchLogs(page - 1); }}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={page >= totalPages}
                  onClick={() => { setPage(p => p + 1); fetchLogs(page + 1); }}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
