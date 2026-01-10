import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface ProjectBOQProps {
    project: any;
    refreshProject: () => void;
}

export default function ProjectBOQ({ project, refreshProject }: ProjectBOQProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        itemCode: '',
        description: '',
        unit: 'm',
        quantity: '',
        unitRate: '',
        category: 'CIVIL'
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setFormData({
            itemCode: item.itemCode,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity.toString(),
            unitRate: item.unitRate.toString(),
            category: item.category || 'CIVIL'
        });
        setIsDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingItem(null);
        setFormData({
            itemCode: '',
            description: '',
            unit: 'm',
            quantity: '',
            unitRate: '',
            category: 'CIVIL'
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this BOQ item?')) return;

        try {
            const res = await fetch(`/api/projects/boq?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                refreshProject();
            } else {
                alert('Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const handleSubmit = async () => {
        if (!formData.itemCode || !formData.description || !formData.quantity || !formData.unitRate) {
            alert('Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            const endpoint = '/api/projects/boq';
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
                const error = await res.json();
                alert(error.error || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving item:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalBOQValue = project.boqItems?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;
    const totalActualCost = project.boqItems?.reduce((sum: number, item: any) => sum + item.actualCost, 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Bill of Quantities (BOQ)</h3>
                    <p className="text-sm text-slate-500">Manage project estimation and material requirements</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-slate-100 px-4 py-2 rounded-lg text-right">
                        <p className="text-xs text-slate-500 uppercase font-semibold">Total Value</p>
                        <p className="text-lg font-bold text-slate-900">{formatCurrency(totalBOQValue)}</p>
                    </div>
                    <Button onClick={handleAddNew} className="self-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Item
                    </Button>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actual Cost</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {project.boqItems?.length > 0 ? (
                                project.boqItems.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                            {item.itemCode}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 max-w-md truncate" title={item.description}>
                                            {item.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant="outline" className="text-xs bg-slate-50">
                                                {item.category}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                                            {item.unit}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-medium">
                                            {item.quantity}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                                            {formatCurrency(item.unitRate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 text-right">
                                            {formatCurrency(item.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                                            {item.actualCost > 0 ? (
                                                <span className={item.actualCost > item.amount ? 'text-red-600' : 'text-green-600'}>
                                                    {formatCurrency(item.actualCost)}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(item)}>
                                                    <Edit2 className="w-4 h-4 text-slate-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                        No BOQ items added yet. Click "Add Item" to start.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {project.boqItems?.length > 0 && (
                            <tfoot className="bg-slate-50 font-semibold">
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-right text-sm text-slate-900">Total</td>
                                    <td className="px-6 py-4 text-right text-sm text-slate-900">{formatCurrency(totalBOQValue)}</td>
                                    <td className="px-6 py-4 text-right text-sm text-slate-900">{formatCurrency(totalActualCost)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit BOQ Item' : 'Add BOQ Item'}</DialogTitle>
                        <DialogDescription>
                            Enter item details for the Bill of Quantities.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-1 space-y-2">
                            <Label>Item Code *</Label>
                            <Input
                                value={formData.itemCode}
                                onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                                placeholder="A.1.1"
                            />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(val) => setFormData({ ...formData, category: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CIVIL">Civil</SelectItem>
                                    <SelectItem value="ELECTRICAL">Electrical</SelectItem>
                                    <SelectItem value="MATERIAL">Material</SelectItem>
                                    <SelectItem value="LABOR">Labor</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Description *</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Item description"
                            />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Unit</Label>
                            <Input
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                placeholder="m, km, Nos"
                            />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Quantity *</Label>
                            <Input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Unit Rate (LKR) *</Label>
                            <Input
                                type="number"
                                value={formData.unitRate}
                                onChange={(e) => setFormData({ ...formData, unitRate: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Amount (Auto)</Label>
                            <div className="h-10 px-3 py-2 bg-slate-100 rounded-md border border-slate-200 text-sm flex items-center">
                                {formatCurrency((parseFloat(formData.quantity) || 0) * (parseFloat(formData.unitRate) || 0))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Item'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
