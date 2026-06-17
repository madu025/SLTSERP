"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, MapPin, Clock, User, Smartphone, CheckCircle2, AlertTriangle, ChevronRight, Calendar, Wrench } from 'lucide-react';
import { format } from 'date-fns';

interface FieldTask {
  id: string;
  projectId: string;
  taskInstanceId?: string;
  assignedTeamId?: string;
  assignedUserId?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  syncStatus: string;
  deviceId?: string;
  appVersion?: string;
  photos?: any[];
  checklists?: any[];
  signatures?: any[];
}

interface ProjectFieldTasksProps {
  project: { id: string };
}

export default function ProjectFieldTasks({ project }: ProjectFieldTasksProps) {
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FieldTask | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [scheduledDate, setScheduledDate] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/field-tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching field tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING_SYNC') return t.syncStatus === 'PENDING';
    return t.status === statusFilter;
  });

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body: any = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        scheduledDate: scheduledDate || null,
        address: address.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      };
      const res = await fetch(`/api/projects/${project.id}/field-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        resetForm();
        fetchTasks();
      }
    } catch (err) {
      console.error('Error creating field task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const body: any = { status: newStatus };
      if (newStatus === 'IN_PROGRESS') body.startedAt = new Date().toISOString();
      if (newStatus === 'COMPLETED') body.completedAt = new Date().toISOString();
      await fetch(`/api/projects/${project.id}/field-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      fetchTasks();
    } catch (err) {
      console.error('Error updating field task:', err);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setScheduledDate('');
    setAddress('');
    setLatitude('');
    setLongitude('');
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ASSIGNED: 'bg-blue-100 text-blue-700',
      IN_PROGRESS: 'bg-amber-100 text-amber-700',
      COMPLETED: 'bg-green-100 text-green-700',
      VERIFIED: 'bg-emerald-100 text-emerald-700',
    };
    return <Badge className={colors[status] || 'bg-slate-100 text-slate-700'}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      HIGH: 'bg-red-100 text-red-700',
      MEDIUM: 'bg-amber-100 text-amber-700',
      LOW: 'bg-slate-100 text-slate-700',
    };
    return <Badge variant="outline" className={colors[priority] || ''}>{priority}</Badge>;
  };

  const getSyncBadge = (syncStatus: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      SYNCED: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-700',
    };
    return <Badge className={colors[syncStatus] || 'bg-slate-100'}>{syncStatus}</Badge>;
  };

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      ASSIGNED: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
      COMPLETED: 'VERIFIED',
    };
    return flow[current] || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Field Tasks</h3>
          <p className="text-sm text-slate-500">Mobile field tasks assigned to teams and workers on site</p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add Field Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'PENDING_SYNC'].map(filter => (
          <Button
            key={filter}
            variant={statusFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(filter)}
            className="text-xs h-8"
          >
            {filter === 'PENDING_SYNC' ? 'Need Sync' : filter === 'ALL' ? 'All' : filter.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Wrench className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">No field tasks found</p>
            <p className="text-xs mt-1">Click "Add Field Task" to create one</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900 truncate">{task.title}</h4>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                    {task.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-2">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {task.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {task.address}
                        </span>
                      )}
                      {task.scheduledDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {format(new Date(task.scheduledDate), 'MMM d, yyyy')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3 h-3" /> {getSyncBadge(task.syncStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getNextStatus(task.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(task.id, getNextStatus(task.status)!); }}
                      >
                        {getNextStatus(task.status) === 'IN_PROGRESS' ? 'Start' :
                         getNextStatus(task.status) === 'COMPLETED' ? 'Complete' :
                         getNextStatus(task.status) === 'VERIFIED' ? 'Verify' : 'Next'}
                      </Button>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Field Task</DialogTitle>
            <DialogDescription>Create a task for field workers to complete on site.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Pole inspection at site A" />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Task details..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sched">Scheduled Date</Label>
                <Input id="sched" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="addr">Address / Location</Label>
              <Input id="addr" value={address} onChange={e => setAddress(e.target.value)} placeholder="Site address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g., 6.9271" />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g., 79.8612" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title.trim() || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                {getStatusBadge(selectedTask.status)}
                {getPriorityBadge(selectedTask.priority)}
                {getSyncBadge(selectedTask.syncStatus)}
              </div>
              {selectedTask.description && (
                <div>
                  <Label className="text-xs text-slate-500">Description</Label>
                  <p className="text-sm text-slate-700 mt-1">{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedTask.address && (
                  <div>
                    <Label className="text-xs text-slate-500">Location</Label>
                    <p className="text-slate-700 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {selectedTask.address}</p>
                  </div>
                )}
                {selectedTask.scheduledDate && (
                  <div>
                    <Label className="text-xs text-slate-500">Scheduled</Label>
                    <p className="text-slate-700 flex items-center gap-1 mt-1"><Calendar className="w-3 h-3" /> {format(new Date(selectedTask.scheduledDate), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {selectedTask.startedAt && (
                  <div>
                    <Label className="text-xs text-slate-500">Started</Label>
                    <p className="text-slate-700"><Clock className="w-3 h-3 inline mr-1" />{format(new Date(selectedTask.startedAt), 'MMM d, h:mm a')}</p>
                  </div>
                )}
                {selectedTask.completedAt && (
                  <div>
                    <Label className="text-xs text-slate-500">Completed</Label>
                    <p className="text-slate-700"><CheckCircle2 className="w-3 h-3 inline mr-1" />{format(new Date(selectedTask.completedAt), 'MMM d, h:mm a')}</p>
                  </div>
                )}
                {selectedTask.durationMinutes && (
                  <div>
                    <Label className="text-xs text-slate-500">Duration</Label>
                    <p className="text-slate-700">{selectedTask.durationMinutes} min</p>
                  </div>
                )}
              </div>
              {(selectedTask.latitude || selectedTask.longitude) && (
                <div>
                  <Label className="text-xs text-slate-500">GPS Coordinates</Label>
                  <p className="text-sm text-slate-700 mt-1 font-mono">
                    {selectedTask.latitude?.toFixed(6)}, {selectedTask.longitude?.toFixed(6)}
                  </p>
                </div>
              )}
              {selectedTask.photos && selectedTask.photos.length > 0 && (
                <div>
                  <Label className="text-xs text-slate-500">Photos ({selectedTask.photos.length})</Label>
                </div>
              )}
              {selectedTask.checklists && selectedTask.checklists.length > 0 && (
                <div>
                  <Label className="text-xs text-slate-500">Checklist ({selectedTask.checklists.length} items)</Label>
                </div>
              )}
              {getNextStatus(selectedTask.status) && (
                <Button
                  className="w-full"
                  onClick={() => { handleStatusUpdate(selectedTask.id, getNextStatus(selectedTask.status)!); setIsDetailOpen(false); }}
                >
                  {getNextStatus(selectedTask.status) === 'IN_PROGRESS' ? 'Start Task' :
                   getNextStatus(selectedTask.status) === 'COMPLETED' ? 'Mark Complete' :
                   getNextStatus(selectedTask.status) === 'VERIFIED' ? 'Verify Task' : 'Advance'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}