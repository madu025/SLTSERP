import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface ProjectMilestonesProps {
    project: any;
    refreshProject: () => void;
}

export default function ProjectMilestones({ project, refreshProject }: ProjectMilestonesProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        targetDate: '',
        status: 'PENDING'
    });

    const handleAddNew = () => {
        setEditingItem(null);
        setFormData({
            name: '',
            description: '',
            targetDate: '',
            status: 'PENDING'
        });
        setIsDialogOpen(true);
    };

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            description: item.description || '',
            targetDate: item.targetDate ? new Date(item.targetDate).toISOString().split('T')[0] : '',
            status: item.status
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this milestone?')) return;
        try {
            const res = await fetch(`/api/projects/milestones?id=${id}`, { method: 'DELETE' });
            if (res.ok) refreshProject();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.targetDate) {
            alert('Name and Target Date are required');
            return;
        }

        setLoading(true);
        try {
            const endpoint = '/api/projects/milestones';
            const method = editingItem ? 'PATCH' : 'POST';
            const body = editingItem
                ? { id: editingItem.id, ...formData }
                : { projectId: project.id, ...formData };

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setIsDialogOpen(false);
                refreshProject();
            } else {
                alert('Operation failed');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-200';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'DELAYED': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const sortedMilestones = [...(project.milestones || [])].sort((a: any, b: any) =>
        new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Project Timeline</h3>
                    <p className="text-sm text-slate-500">Track key milestones and deadlines</p>
                </div>
                <Button onClick={handleAddNew} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Milestone
                </Button>
            </div>

            <div className="space-y-4">
                {sortedMilestones.length > 0 ? (
                    sortedMilestones.map((milestone: any) => (
                        <Card key={milestone.id} className={`border-l-4 ${milestone.status === 'COMPLETED' ? 'border-l-green-500' :
                                milestone.status === 'DELAYED' ? 'border-l-red-500' :
                                    milestone.status === 'IN_PROGRESS' ? 'border-l-blue-500' : 'border-l-slate-300'
                            }`}>
                            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-semibold text-slate-900">{milestone.name}</h4>
                                        <Badge variant="outline" className={getStatusColor(milestone.status)}>
                                            {milestone.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-slate-600 max-w-xl">{milestone.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Target: {new Date(milestone.targetDate).toLocaleDateString()}
                                        </div>
                                        {milestone.completedDate && (
                                            <div className="flex items-center gap-1 text-green-600">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Completed: {new Date(milestone.completedDate).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(milestone)} className="flex-1 sm:flex-none">
                                        Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(milestone.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                        Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No milestones set. Create one to start tracking.</p>
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Milestone Name *</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Foundation Complete"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Details about this milestone..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Target Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.targetDate}
                                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="DELAYED">Delayed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Milestone'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
