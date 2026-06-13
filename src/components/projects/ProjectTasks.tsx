import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Link2, Clock } from 'lucide-react';

interface Project {
    id: string;
    projectCode: string;
    name: string;
    description?: string;
    status: string;
    budget?: number;
    actualCost?: number;
}

interface TaskDependency {
    id: string;
    taskId: string;
    dependsOnTaskId: string;
    type: string;
    lagDays: number;
    dependsOn: {
        id: string;
        name: string;
        wbsCode: string;
        status: string;
    };
}

interface Task {
    id: string;
    wbsCode: string;
    name: string;
    description?: string;
    type: string;
    status: string;
    priority: string;
    actualProgress: number;
    plannedStartDate?: string;
    plannedEndDate?: string;
    plannedDuration?: number;
    estimatedCost?: number;
    parentId?: string | null;
    assigneeType?: string;
    assigneeId?: string;
    dependencies?: TaskDependency[];
    children?: Task[];
    order?: number;
    _count?: {
        children: number;
        timesheets: number;
    };
}

interface ProjectTasksProps {
    project: Project;
    refreshProject: () => void;
}

export default function ProjectTasks({ project, refreshProject }: ProjectTasksProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
    const [isDependencyDialogOpen, setIsDependencyDialogOpen] = useState(false);
    const [isTimesheetDialogOpen, setIsTimesheetDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [activeView, setActiveView] = useState<'wbs' | 'gantt' | 'timesheet'>('wbs');

    const [taskForm, setTaskForm] = useState({
        name: '', wbsCode: '', description: '', type: 'TASK', priority: 'MEDIUM',
        plannedStartDate: '', plannedEndDate: '', plannedDuration: '',
        estimatedCost: '', parentId: '', assigneeType: '', assigneeId: ''
    });

    const [progressForm, setProgressForm] = useState({
        progress: '0', description: '', gpsLatitude: '', gpsLongitude: ''
    });

    const [dependencyForm, setDependencyForm] = useState({
        dependsOnTaskId: '', type: 'FINISH_TO_START', lagDays: '0'
    });

    const [timesheetForm, setTimesheetForm] = useState({
        taskId: '', date: format(new Date(), 'yyyy-MM-dd'), hours: '8', description: '', staffId: '', contractorId: ''
    });

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/tasks?projectId=${project.id}`);
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    }, [project.id]);

    useEffect(() => {
        if (project.id) fetchTasks();
    }, [project.id, fetchTasks]);

    // Fetch all tasks (including children) for WBS tree
    const [allTasks, setAllTasks] = useState<Task[]>([]);

    const fetchAllTasks = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/tasks?projectId=${project.id}`);
            if (res.ok) {
                const rootTasks = await res.json();

                // Fetch children for each task
                const fetchChildren = async (tasksList: Task[]): Promise<Task[]> => {
                    const result: Task[] = [];
                    for (const task of tasksList) {
                        result.push(task);
                        if (task._count && task._count.children > 0) {
                            const childRes = await fetch(`/api/projects/tasks?projectId=${project.id}&parentId=${task.id}`);
                            if (childRes.ok) {
                                const children = await childRes.json();
                                result.push(...await fetchChildren(children));
                            }
                        }
                    }
                    return result;
                };

                const all = await fetchChildren(rootTasks);
                setAllTasks(all);
            }
        } catch (error) {
            console.error('Error fetching all tasks:', error);
        }
    }, [project.id]);

    useEffect(() => {
        if (project.id) fetchAllTasks();
    }, [project.id, fetchAllTasks]);

    // Build WBS tree from flat tasks
    const buildTree = (tasksList: Task[], parentId: string | null = null): Task[] => {
        return tasksList
            .filter(t => t.parentId === parentId)
            .map(t => ({
                ...t,
                children: buildTree(tasksList, t.id)
            }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    };

    const taskTree = buildTree(tasks);

    const toggleExpand = (taskId: string) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(taskId)) {
            newExpanded.delete(taskId);
        } else {
            newExpanded.add(taskId);
        }
        setExpandedTasks(newExpanded);
    };

    const handleAddTask = (parentId?: string) => {
        setEditingTask(null);
        setTaskForm({
            name: '', wbsCode: '', description: '', type: 'TASK', priority: 'MEDIUM',
            plannedStartDate: '', plannedEndDate: '', plannedDuration: '',
            estimatedCost: '', parentId: parentId || '', assigneeType: '', assigneeId: ''
        });
        setIsTaskDialogOpen(true);
    };

    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        setTaskForm({
            name: task.name,
            wbsCode: task.wbsCode,
            description: task.description || '',
            type: task.type,
            priority: task.priority,
            plannedStartDate: task.plannedStartDate ? format(new Date(task.plannedStartDate), 'yyyy-MM-dd') : '',
            plannedEndDate: task.plannedEndDate ? format(new Date(task.plannedEndDate), 'yyyy-MM-dd') : '',
            plannedDuration: task.plannedDuration?.toString() || '',
            estimatedCost: task.estimatedCost?.toString() || '',
            parentId: task.parentId || '',
            assigneeType: task.assigneeType || '',
            assigneeId: task.assigneeId || ''
        });
        setIsTaskDialogOpen(true);
    };

    const handleDeleteTask = async (id: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            const res = await fetch(`/api/projects/tasks?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchTasks();
                fetchAllTasks();
                refreshProject();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handleSaveTask = async () => {
        if (!taskForm.name) {
            alert('Task name is required');
            return;
        }

        try {
            const method = editingTask ? 'PATCH' : 'POST';
            const body = editingTask
                ? { id: editingTask.id, ...taskForm }
                : { projectId: project.id, ...taskForm };

            const res = await fetch('/api/projects/tasks', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setIsTaskDialogOpen(false);
                fetchTasks();
                fetchAllTasks();
                refreshProject();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to save task');
            }
        } catch (error) {
            console.error('Error saving task:', error);
        }
    };

    const handleLogProgress = async () => {
        if (!selectedTask) return;

        try {
            const res = await fetch('/api/projects/tasks/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: selectedTask.id,
                    ...progressForm
                })
            });

            if (res.ok) {
                setIsProgressDialogOpen(false);
                fetchTasks();
                fetchAllTasks();
                refreshProject();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to log progress');
            }
        } catch (error) {
            console.error('Error logging progress:', error);
        }
    };

    const handleAddDependency = async () => {
        if (!selectedTask || !dependencyForm.dependsOnTaskId) {
            alert('Please select a prerequisite task');
            return;
        }

        try {
            const res = await fetch('/api/projects/tasks/dependencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: selectedTask.id,
                    ...dependencyForm
                })
            });

            if (res.ok) {
                setIsDependencyDialogOpen(false);
                fetchTasks();
                fetchAllTasks();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to add dependency');
            }
        } catch (error) {
            console.error('Error adding dependency:', error);
        }
    };

    const handleRemoveDependency = async (depId: string) => {
        try {
            const res = await fetch(`/api/projects/tasks/dependencies?id=${depId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchTasks();
                fetchAllTasks();
            }
        } catch (error) {
            console.error('Error removing dependency:', error);
        }
    };

    const handleSaveTimesheet = async () => {
        try {
            const res = await fetch('/api/projects/timesheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    ...timesheetForm
                })
            });

            if (res.ok) {
                setIsTimesheetDialogOpen(false);
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to save timesheet');
            }
        } catch (error) {
            console.error('Error saving timesheet:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            PENDING: 'bg-slate-100 text-slate-600',
            IN_PROGRESS: 'bg-blue-100 text-blue-700',
            COMPLETED: 'bg-green-100 text-green-700',
            DELAYED: 'bg-red-100 text-red-700'
        };
        return variants[status] || 'bg-slate-100 text-slate-600';
    };

    const getPriorityBadge = (priority: string) => {
        const variants: Record<string, string> = {
            LOW: 'bg-slate-100 text-slate-500',
            MEDIUM: 'bg-blue-50 text-blue-600',
            HIGH: 'bg-orange-50 text-orange-600',
            CRITICAL: 'bg-red-50 text-red-600'
        };
        return variants[priority] || 'bg-slate-100 text-slate-500';
    };

    const renderTaskRow = (task: Task, depth: number = 0) => {
        const hasChildren = task.children && task.children.length > 0;
        const isExpanded = expandedTasks.has(task.id);

        return (
            <React.Fragment key={task.id}>
                <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
                            {hasChildren ? (
                                <button onClick={() => toggleExpand(task.id)} className="p-0.5 hover:bg-slate-200 rounded">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                            ) : <span className="w-5" />}
                            <span className="text-xs font-mono text-slate-400">{task.wbsCode}</span>
                            <span className="text-sm font-medium text-slate-900">{task.name}</span>
                        </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={`text-xs ${getStatusBadge(task.status)}`}>
                            {task.status.replace('_', ' ')}
                        </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="outline" className={`text-xs ${getPriorityBadge(task.priority)}`}>
                            {task.priority}
                        </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {task.actualProgress}%
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1 inline-block ml-2">
                            <div className={`h-1.5 rounded-full ${task.actualProgress >= 100 ? 'bg-green-500' : task.actualProgress > 0 ? 'bg-blue-500' : 'bg-slate-200'}`}
                                style={{ width: `${task.actualProgress}%` }} />
                        </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {task.plannedStartDate ? format(new Date(task.plannedStartDate), 'MMM dd') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {task.plannedEndDate ? format(new Date(task.plannedEndDate), 'MMM dd') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {task.assigneeType || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => { setSelectedTask(task); setProgressForm({ progress: task.actualProgress.toString(), description: '', gpsLatitude: '', gpsLongitude: '' }); setIsProgressDialogOpen(true); }}>
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => { setSelectedTask(task); setDependencyForm({ dependsOnTaskId: '', type: 'FINISH_TO_START', lagDays: '0' }); setIsDependencyDialogOpen(true); }}>
                                <Link2 className="w-3.5 h-3.5 text-purple-500" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => handleEditTask(task)}>
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => handleDeleteTask(task.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                        </div>
                    </td>
                </tr>
                {/* Dependencies display */}
                {task.dependencies && task.dependencies.length > 0 && isExpanded && (
                    <tr className="bg-purple-50/50">
                        <td colSpan={8} className="px-4 py-2">
                            <div className="flex items-center gap-2 flex-wrap" style={{ paddingLeft: `${depth * 24 + 40}px` }}>
                                <span className="text-xs text-purple-600 font-medium">Depends on:</span>
                                {task.dependencies.map((dep: TaskDependency) => (
                                    <Badge key={dep.id} variant="outline" className="text-xs bg-white flex items-center gap-1">
                                        {dep.dependsOn.wbsCode} - {dep.dependsOn.name}
                                        <button onClick={() => handleRemoveDependency(dep.id)} className="ml-1 text-red-400 hover:text-red-600">
                                            ×
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </td>
                    </tr>
                )}
                {hasChildren && isExpanded && task.children && task.children.map((child: Task) => renderTaskRow(child, depth + 1))}
            </React.Fragment>
        );
    };

    // Simple Gantt Chart View
    const renderGanttView = () => {
        if (allTasks.length === 0) return <p className="text-slate-500 text-center py-8">No tasks to display in Gantt view</p>;

        const sortedTasks = [...allTasks].sort((a, b) => {
            const startA = a.plannedStartDate;
            const startB = b.plannedStartDate;
            if (!startA) return 1;
            if (!startB) return -1;
            return new Date(startA).getTime() - new Date(startB).getTime();
        });

        // Find date range
        const startDates = sortedTasks
            .map(t => t.plannedStartDate)
            .filter((d): d is string => d !== undefined && d !== null && d !== '')
            .map(d => new Date(d));
        const endDates = sortedTasks
            .map(t => t.plannedEndDate)
            .filter((d): d is string => d !== undefined && d !== null && d !== '')
            .map(d => new Date(d));
        const minDate = startDates.length > 0 ? new Date(Math.min(...startDates.map(d => d.getTime()))) : new Date();
        const maxDate = endDates.length > 0 ? new Date(Math.max(...endDates.map(d => d.getTime()))) : new Date();
        const totalDays = Math.max((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24), 30);

        return (
            <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                    {/* Header */}
                    <div className="flex border-b border-slate-200 bg-slate-50">
                        <div className="w-64 px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Task</div>
                        <div className="flex-1 px-4 py-2 text-xs font-semibold text-slate-500 uppercase relative" style={{ minWidth: '500px' }}>
                            <div className="flex justify-between absolute inset-x-4 top-2">
                                {Array.from({ length: Math.min(Math.ceil(totalDays / 7), 12) }).map((_, i) => (
                                    <span key={i} className="text-xs text-slate-400">
                                        Week {i + 1}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Rows */}
                    {sortedTasks.map((task) => {
                        if (!task.plannedStartDate) return null;
                        const taskStart = new Date(task.plannedStartDate);
                        const taskEnd = task.plannedEndDate ? new Date(task.plannedEndDate) :
                            new Date(taskStart.getTime() + (task.plannedDuration || 5) * 24 * 60 * 60 * 1000);
                        const leftOffset = ((taskStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100;
                        const width = Math.max(((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100, 2);

                        const barColors: Record<string, string> = {
                            COMPLETED: 'bg-green-500',
                            IN_PROGRESS: 'bg-blue-500',
                            DELAYED: 'bg-red-500',
                            PENDING: 'bg-slate-300'
                        };

                        return (
                            <div key={task.id} className="flex border-b border-slate-100 hover:bg-slate-50">
                                <div className="w-64 px-4 py-3 text-sm text-slate-700 truncate border-r border-slate-100">
                                    <span className="text-xs font-mono text-slate-400 mr-2">{task.wbsCode}</span>
                                    {task.name}
                                </div>
                                <div className="flex-1 px-4 py-3 relative" style={{ minWidth: '500px' }}>
                                    <div className={`absolute h-6 rounded ${barColors[task.status] || 'bg-slate-300'} opacity-80`}
                                        style={{
                                            left: `${leftOffset}%`,
                                            width: `${width}%`,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            minWidth: '20px'
                                        }}>
                                        <span className="text-xs text-white px-2 leading-6 block truncate">
                                            {task.actualProgress}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* View Switcher & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button variant={activeView === 'wbs' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('wbs')}>
                        WBS Tree
                    </Button>
                    <Button variant={activeView === 'gantt' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('gantt')}>
                        Gantt Chart
                    </Button>
                    <Button variant={activeView === 'timesheet' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('timesheet')}>
                        <Clock className="w-4 h-4 mr-1" /> Timesheets
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => handleAddTask()} className="gap-2">
                        <Plus className="w-4 h-4" /> Add Task
                    </Button>
                    <Button variant="outline" onClick={() => { setTimesheetForm({ ...timesheetForm, taskId: '' }); setIsTimesheetDialogOpen(true); }} className="gap-2">
                        <Clock className="w-4 h-4" /> Log Hours
                    </Button>
                </div>
            </div>

            {/* WBS Tree View */}
            {activeView === 'wbs' && (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Task</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Priority</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Progress</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Start</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">End</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Assignee</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {loading ? (
                                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
                                ) : taskTree.length === 0 ? (
                                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                        No tasks created yet. Click &quot;Add Task&quot; to create your WBS structure.
                                    </td></tr>
                                ) : (
                                    taskTree.map((task: Task) => renderTaskRow(task))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Gantt Chart View */}
            {activeView === 'gantt' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Project Schedule - Gantt Chart</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {renderGanttView()}
                    </CardContent>
                </Card>
            )}

            {/* Timesheet View */}
            {activeView === 'timesheet' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Timesheets</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <TimesheetView projectId={project.id} />
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit Task Dialog */}
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
                        <DialogDescription>
                            Define a task or phase for the project WBS.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2 space-y-2">
                            <Label>Task Name *</Label>
                            <Input value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} placeholder="e.g., Main Cable Routing" />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>WBS Code</Label>
                            <Input value={taskForm.wbsCode} onChange={(e) => setTaskForm({ ...taskForm, wbsCode: e.target.value })} placeholder="e.g., 1.1.1" />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Type</Label>
                            <Select value={taskForm.type} onValueChange={(val) => setTaskForm({ ...taskForm, type: val })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PHASE">Phase</SelectItem>
                                    <SelectItem value="TASK">Task</SelectItem>
                                    <SelectItem value="MILESTONE">Milestone</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Description</Label>
                            <Input value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Task description" />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Priority</Label>
                            <Select value={taskForm.priority} onValueChange={(val) => setTaskForm({ ...taskForm, priority: val })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Low</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Duration (Days)</Label>
                            <Input type="number" value={taskForm.plannedDuration} onChange={(e) => setTaskForm({ ...taskForm, plannedDuration: e.target.value })} />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" value={taskForm.plannedStartDate} onChange={(e) => setTaskForm({ ...taskForm, plannedStartDate: e.target.value })} />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" value={taskForm.plannedEndDate} onChange={(e) => setTaskForm({ ...taskForm, plannedEndDate: e.target.value })} />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Estimated Cost (LKR)</Label>
                            <Input type="number" value={taskForm.estimatedCost} onChange={(e) => setTaskForm({ ...taskForm, estimatedCost: e.target.value })} />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Assignee Type</Label>
                            <Select value={taskForm.assigneeType} onValueChange={(val) => setTaskForm({ ...taskForm, assigneeType: val })}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STAFF">Staff</SelectItem>
                                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                                    <SelectItem value="TEAM">Team</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTask}>Save Task</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Progress Log Dialog */}
            <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log Progress</DialogTitle>
                        <DialogDescription>
                            Update progress for: <strong>{selectedTask?.name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Progress % *</Label>
                            <Input type="number" min="0" max="100"
                                value={progressForm.progress}
                                onChange={(e) => setProgressForm({ ...progressForm, progress: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={progressForm.description}
                                onChange={(e) => setProgressForm({ ...progressForm, description: e.target.value })}
                                placeholder="What was accomplished?" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>GPS Latitude</Label>
                                <Input value={progressForm.gpsLatitude}
                                    onChange={(e) => setProgressForm({ ...progressForm, gpsLatitude: e.target.value })}
                                    placeholder="6.9271" />
                            </div>
                            <div className="space-y-2">
                                <Label>GPS Longitude</Label>
                                <Input value={progressForm.gpsLongitude}
                                    onChange={(e) => setProgressForm({ ...progressForm, gpsLongitude: e.target.value })}
                                    placeholder="79.8612" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsProgressDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleLogProgress}>Log Progress</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dependency Dialog */}
            <Dialog open={isDependencyDialogOpen} onOpenChange={setIsDependencyDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Dependency</DialogTitle>
                        <DialogDescription>
                            Set prerequisite for: <strong>{selectedTask?.name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Prerequisite Task *</Label>
                            <Select value={dependencyForm.dependsOnTaskId}
                                onValueChange={(val) => setDependencyForm({ ...dependencyForm, dependsOnTaskId: val })}>
                                <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                                <SelectContent>
                                    {allTasks.filter(t => t.id !== selectedTask?.id).map((task: Task) => (
                                        <SelectItem key={task.id} value={task.id}>
                                            {task.wbsCode} - {task.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Dependency Type</Label>
                            <Select value={dependencyForm.type}
                                onValueChange={(val) => setDependencyForm({ ...dependencyForm, type: val })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FINISH_TO_START">Finish to Start</SelectItem>
                                    <SelectItem value="START_TO_START">Start to Start</SelectItem>
                                    <SelectItem value="FINISH_TO_FINISH">Finish to Finish</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Lag Days</Label>
                            <Input type="number" value={dependencyForm.lagDays}
                                onChange={(e) => setDependencyForm({ ...dependencyForm, lagDays: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDependencyDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddDependency}>Add Dependency</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Timesheet Dialog */}
            <Dialog open={isTimesheetDialogOpen} onOpenChange={setIsTimesheetDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log Hours</DialogTitle>
                        <DialogDescription>
                            Record work hours against a task.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Task *</Label>
                            <Select value={timesheetForm.taskId}
                                onValueChange={(val) => setTimesheetForm({ ...timesheetForm, taskId: val })}>
                                <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                                <SelectContent>
                                    {allTasks.map((task: Task) => (
                                        <SelectItem key={task.id} value={task.id}>
                                            {task.wbsCode} - {task.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={timesheetForm.date}
                                    onChange={(e) => setTimesheetForm({ ...timesheetForm, date: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Hours *</Label>
                                <Input type="number" step="0.5" min="0" max="24" value={timesheetForm.hours}
                                    onChange={(e) => setTimesheetForm({ ...timesheetForm, hours: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={timesheetForm.description}
                                onChange={(e) => setTimesheetForm({ ...timesheetForm, description: e.target.value })}
                                placeholder="Work description" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTimesheetDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTimesheet}>Save Hours</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface TimesheetEntry {
    id: string;
    date: string;
    task?: {
        wbsCode: string;
        name: string;
    };
    description?: string;
    hours: number;
    status: string;
}

// Timesheet sub-component
function TimesheetView({ projectId }: { projectId: string }) {
    const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTimesheets = useCallback(async () => {
        try {
            const res = await fetch(`/api/projects/timesheets?projectId=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setTimesheets(data);
            }
        } catch (error) {
            console.error('Error fetching timesheets:', error);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchTimesheets();
    }, [projectId, fetchTimesheets]);

    const totalHours = timesheets.reduce((sum, t) => sum + t.hours, 0);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{timesheets.length} entries</p>
                <p className="text-sm font-bold text-slate-900">Total: {totalHours}h</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Task</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Description</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Hours</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {loading ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : timesheets.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No timesheet entries</td></tr>
                        ) : (
                            timesheets.map((ts: TimesheetEntry) => (
                                <tr key={ts.id} className="hover:bg-slate-50 border-b border-slate-100">
                                    <td className="px-4 py-2 text-sm">{format(new Date(ts.date), 'MMM dd, yyyy')}</td>
                                    <td className="px-4 py-2 text-sm text-slate-700">{ts.task?.wbsCode} - {ts.task?.name}</td>
                                    <td className="px-4 py-2 text-sm text-slate-500">{ts.description || '-'}</td>
                                    <td className="px-4 py-2 text-sm font-medium text-right">{ts.hours}h</td>
                                    <td className="px-4 py-2 text-center">
                                        <Badge className={`text-xs ${
                                            ts.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                            ts.status === 'VERIFIED' ? 'bg-blue-100 text-blue-700' :
                                            ts.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>{ts.status}</Badge>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
