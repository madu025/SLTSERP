import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Plus, Trash2, Receipt, DollarSign } from 'lucide-react';

interface ProjectExpensesProps {
    project: any;
    refreshProject: () => void;
}

export default function ProjectExpenses({ project, refreshProject }: ProjectExpensesProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        type: 'MISC',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        invoiceRef: '',
        remarks: ''
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const handleAddNew = () => {
        setFormData({
            type: 'MISC',
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            invoiceRef: '',
            remarks: ''
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense record?')) return;
        try {
            const res = await fetch(`/api/projects/expenses?id=${id}`, { method: 'DELETE' });
            if (res.ok) refreshProject();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleSubmit = async () => {
        if (!formData.description || !formData.amount || !formData.date) {
            alert('Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/projects/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...formData })
            });

            if (res.ok) {
                setIsDialogOpen(false);
                refreshProject();
            } else {
                alert('Failed to add expense');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalExpenses = project.expenses?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Project Expenses</h3>
                    <p className="text-sm text-slate-500">Track additional costs (Labor, Transport, etc.)</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-red-50 px-4 py-2 rounded-lg text-right border border-red-100">
                        <p className="text-xs text-red-600 uppercase font-semibold">Total Expenses</p>
                        <p className="text-lg font-bold text-red-700">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <Button onClick={handleAddNew} className="self-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Expense
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden">
                <ResponsiveTable>
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Reference</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {project.expenses?.length > 0 ? (
                                project.expenses.map((expense: any) => (
                                    <tr key={expense.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(expense.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-900">
                                            <Badge variant="outline">{expense.type}</Badge>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                                            {expense.description}
                                            {expense.remarks && (
                                                <p className="text-xs text-slate-500 mt-0.5">{expense.remarks}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {expense.invoiceRef || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                                            {formatCurrency(expense.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(expense.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        No expenses recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </ResponsiveTable>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Expense Record</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Type *</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(val) => setFormData({ ...formData, type: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MATERIAL">Material (Non-BOQ)</SelectItem>
                                    <SelectItem value="LABOR">Labor</SelectItem>
                                    <SelectItem value="TRANSPORT">Transport</SelectItem>
                                    <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                                    <SelectItem value="MISC">Miscellaneous</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Description *</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Expense description"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Amount (LKR) *</Label>
                            <Input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Invoice/Ref No</Label>
                            <Input
                                value={formData.invoiceRef}
                                onChange={(e) => setFormData({ ...formData, invoiceRef: e.target.value })}
                                placeholder="Optional"
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Remarks</Label>
                            <Textarea
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                placeholder="Additional details..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Saving...' : 'Add Expense'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
