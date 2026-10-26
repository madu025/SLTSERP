import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Plus, Trash2, Receipt } from 'lucide-react';

import { toast } from 'sonner';

async function getResponseError(response: Response, fallback: string) {
    try {
        const body: unknown = await response.json();
        if (body && typeof body === 'object') {
            const message = (body as { error?: unknown; message?: unknown }).error
                ?? (body as { message?: unknown }).message;
            if (typeof message === 'string' && message.trim()) return message;
        }
    } catch {
        // Fall back to a clear operation-specific message for non-JSON errors.
    }
    return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}
interface ProjectExpense {
    id: string;
    type: string;
    description: string;
    amount: number;
    date: string;
    invoiceRef?: string;
    remarks?: string;
}

interface ProjectWithExpenses {
    id: string;
    expenses?: ProjectExpense[];
}

interface ProjectExpensesProps {
    project: ProjectWithExpenses;
    refreshProject: () => void;
}

export default function ProjectExpenses({ project, refreshProject }: ProjectExpensesProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
    const [fetchLoading, setFetchLoading] = useState(true);

    const fetchExpenses = useCallback(async () => {
        try {
            setFetchLoading(true);
            const res = await fetch(`/api/projects/${project.id}/expenses`);
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to load project expenses.'));
            const data: unknown = await res.json();
            setExpenses(Array.isArray(data) ? data as ProjectExpense[] : []);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to load project expenses.'));
        }
        finally { setFetchLoading(false); }
    }, [project.id]);

    // Fetch expenses independently if not available on project object
    useEffect(() => {
        if (project.expenses?.length) {
            setExpenses(project.expenses);
            setFetchLoading(false);
        } else {
            fetchExpenses();
        }
    }, [fetchExpenses, project.expenses]);

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
            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to delete the expense.'));
            toast.success('Expense record deleted.');
            refreshProject();
            await fetchExpenses();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to delete the expense.'));
}
    };

    const handleSubmit = async () => {
        if (!formData.description || !formData.amount || !formData.date) {
            toast.error('Please fill all required fields');
            return;
        }
        if (!window.confirm(`Add this ${formatCurrency(Number(formData.amount))} expense record?`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/projects/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, ...formData })
            });

            if (!res.ok) throw new Error(await getResponseError(res, 'Unable to add the expense.'));
            setIsDialogOpen(false);
            toast.success('Expense record added.');
            refreshProject();
            await fetchExpenses();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Unable to add the expense.'));
} finally {
            setLoading(false);
        }
    };

    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Project Expenses</h3>
                    <p className="text-sm text-slate-500">Track additional costs (Labor, Transport, etc.)</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-red-50 px-4 py-2 rounded-lg text-right border border-red-100">
                        <p className="text-xs text-red-700 uppercase font-semibold">Total Expenses</p>
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Reference</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Amount</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {expenses.length > 0 ? (
                                expenses.map((expense) => (
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
                                                className="text-red-700 hover:text-red-900 hover:bg-red-50"
                                                aria-label={`Delete expense: ${expense.description}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        {fetchLoading ? <span>Loading...</span> : <><Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />No expenses recorded yet.</>}
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
