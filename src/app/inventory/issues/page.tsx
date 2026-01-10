"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PackageMinus, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

interface IssueItem {
    itemId: string;
    quantity: string;
    remarks: string;
}

export default function StockIssuePage() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

    // Issue Form State
    const [showIssueDialog, setShowIssueDialog] = useState(false);
    const [issueType, setIssueType] = useState<'PROJECT' | 'CONTRACTOR' | 'TEAM' | 'OTHER'>('PROJECT');
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedContractor, setSelectedContractor] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [issueItems, setIssueItems] = useState<IssueItem[]>([]);
    const [issueRemarks, setIssueRemarks] = useState('');
    const [selectedIssue, setSelectedIssue] = useState<any>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    // Fetch items for dropdown
    const { data: items = [] } = useQuery({
        queryKey: ["items"],
        queryFn: async () => (await fetch("/api/inventory/items")).json()
    });

    // Fetch projects
    const { data: projects = [] } = useQuery({
        queryKey: ["projects"],
        queryFn: async () => (await fetch("/api/projects")).json()
    });

    // Fetch contractors
    const { data: contractors = [] } = useQuery({
        queryKey: ["contractors"],
        queryFn: async () => (await fetch("/api/contractors")).json()
    });

    // Fetch stock issues history
    const { data: issues = [], isLoading } = useQuery({
        queryKey: ['stock-issues'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/issues');
            return res.json();
        }
    });

    // Create issue mutation
    const createIssueMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/inventory/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create stock issue');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Stock issued successfully!');
            queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            handleCloseIssueDialog();
        },
        onError: () => toast.error('Failed to issue stock')
    });

    const handleOpenIssueDialog = () => {
        setIssueItems([{ itemId: '', quantity: '', remarks: '' }]);
        setShowIssueDialog(true);
    };

    const handleCloseIssueDialog = () => {
        setShowIssueDialog(false);
        setIssueType('PROJECT');
        setSelectedProject('');
        setSelectedContractor('');
        setSelectedTeam('');
        setRecipientName('');
        setIssueItems([]);
        setIssueRemarks('');
    };

    const addIssueItem = () => {
        setIssueItems([...issueItems, { itemId: '', quantity: '', remarks: '' }]);
    };

    const removeIssueItem = (index: number) => {
        setIssueItems(issueItems.filter((_, i) => i !== index));
    };

    const updateIssueItem = (index: number, field: keyof IssueItem, value: string) => {
        const updated = [...issueItems];
        updated[index] = { ...updated[index], [field]: value };
        setIssueItems(updated);
    };

    const handleCreateIssue = () => {
        if (issueItems.length === 0 || issueItems.some(i => !i.itemId || !i.quantity)) {
            toast.error('Please add at least one item with quantity');
            return;
        }

        if (!recipientName) {
            toast.error('Please enter recipient name');
            return;
        }

        const payload = {
            storeId: user?.storeId,
            issuedById: user?.id,
            issueType,
            projectId: issueType === 'PROJECT' ? selectedProject : null,
            contractorId: issueType === 'CONTRACTOR' ? selectedContractor : null,
            teamId: issueType === 'TEAM' ? selectedTeam : null,
            recipientName,
            remarks: issueRemarks,
            items: issueItems.map(item => ({
                itemId: item.itemId,
                quantity: parseFloat(item.quantity),
                remarks: item.remarks
            }))
        };

        createIssueMutation.mutate(payload);
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Stock Issue</h1>
                                <p className="text-slate-500">Issue materials to projects, contractors, and teams</p>
                            </div>
                            <Button onClick={handleOpenIssueDialog} className="bg-blue-600 hover:bg-blue-700">
                                <PackageMinus className="w-4 h-4 mr-2" />
                                Issue Stock
                            </Button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b">
                            <button
                                onClick={() => setActiveTab('NEW')}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'NEW'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Recent Issues
                            </button>
                            <button
                                onClick={() => setActiveTab('HISTORY')}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'HISTORY'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                All History
                            </button>
                        </div>

                        {/* Issues List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Stock Issues</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="text-center p-8 text-slate-500">Loading...</div>
                                ) : issues.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">
                                        No stock issues found
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Issue No</th>
                                                    <th className="px-4 py-3 text-left">Date</th>
                                                    <th className="px-4 py-3 text-left">Type</th>
                                                    <th className="px-4 py-3 text-left">Recipient</th>
                                                    <th className="px-4 py-3 text-left">Items</th>
                                                    <th className="px-4 py-3 text-left">Issued By</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {issues.slice(0, activeTab === 'NEW' ? 10 : undefined).map((issue: any) => (
                                                    <tr key={issue.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{issue.issueNumber}</td>
                                                        <td className="px-4 py-3">
                                                            {new Date(issue.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="outline">{issue.issueType}</Badge>
                                                        </td>
                                                        <td className="px-4 py-3">{issue.recipientName}</td>
                                                        <td className="px-4 py-3 text-center">{issue.items?.length || 0}</td>
                                                        <td className="px-4 py-3">{issue.issuedBy?.name || '-'}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedIssue(issue);
                                                                    setShowDetailsDialog(true);
                                                                }}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Create Issue Dialog */}
            <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Issue Stock</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Issue Type & Recipient */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Issue Type</label>
                                <select
                                    className="w-full mt-1 h-9 rounded border px-3 text-sm"
                                    value={issueType}
                                    onChange={e => setIssueType(e.target.value as any)}
                                >
                                    <option value="PROJECT">Project</option>
                                    <option value="CONTRACTOR">Contractor</option>
                                    <option value="TEAM">Team</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            {issueType === 'PROJECT' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Project</label>
                                    <select
                                        className="w-full mt-1 h-9 rounded border px-3 text-sm"
                                        value={selectedProject}
                                        onChange={e => setSelectedProject(e.target.value)}
                                    >
                                        <option value="">Select Project...</option>
                                        {projects.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {issueType === 'CONTRACTOR' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Contractor</label>
                                    <select
                                        className="w-full mt-1 h-9 rounded border px-3 text-sm"
                                        value={selectedContractor}
                                        onChange={e => setSelectedContractor(e.target.value)}
                                    >
                                        <option value="">Select Contractor...</option>
                                        {contractors.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Recipient Name</label>
                            <Input
                                className="mt-1"
                                value={recipientName}
                                onChange={e => setRecipientName(e.target.value)}
                                placeholder="Person receiving the materials"
                            />
                        </div>

                        {/* Items Table */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-600 uppercase">Items to Issue</label>
                                <Button size="sm" onClick={addIssueItem}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Item
                                </Button>
                            </div>
                            <div className="border rounded overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-center w-[120px]">Quantity</th>
                                            <th className="px-3 py-2 text-left">Remarks</th>
                                            <th className="px-3 py-2 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {issueItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2">
                                                    <select
                                                        className="w-full h-8 rounded border text-xs px-2"
                                                        value={item.itemId}
                                                        onChange={e => updateIssueItem(idx, 'itemId', e.target.value)}
                                                    >
                                                        <option value="">Select Item...</option>
                                                        {items.map((i: any) => (
                                                            <option key={i.id} value={i.id}>
                                                                {i.name} ({i.code})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-center"
                                                        value={item.quantity}
                                                        onChange={e => updateIssueItem(idx, 'quantity', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        className="h-8"
                                                        value={item.remarks}
                                                        onChange={e => updateIssueItem(idx, 'remarks', e.target.value)}
                                                        placeholder="Optional"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        onClick={() => removeIssueItem(idx)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Remarks</label>
                            <Textarea
                                className="mt-1"
                                rows={2}
                                value={issueRemarks}
                                onChange={e => setIssueRemarks(e.target.value)}
                                placeholder="Optional notes"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseIssueDialog}>Cancel</Button>
                        <Button
                            onClick={handleCreateIssue}
                            disabled={createIssueMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {createIssueMutation.isPending ? 'Issuing...' : 'Issue Stock'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Details Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Issue Details</DialogTitle>
                    </DialogHeader>
                    {selectedIssue && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded">
                                <div><span className="font-bold">Issue No:</span> {selectedIssue.issueNumber}</div>
                                <div><span className="font-bold">Date:</span> {new Date(selectedIssue.createdAt).toLocaleString()}</div>
                                <div><span className="font-bold">Type:</span> {selectedIssue.issueType}</div>
                                <div><span className="font-bold">Recipient:</span> {selectedIssue.recipientName}</div>
                                {selectedIssue.remarks && (
                                    <div className="col-span-2"><span className="font-bold">Remarks:</span> {selectedIssue.remarks}</div>
                                )}
                            </div>
                            <table className="w-full text-xs border">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="p-2 border text-left">Item</th>
                                        <th className="p-2 border text-center">Quantity</th>
                                        <th className="p-2 border text-left">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedIssue.items?.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="p-2 border">{item.item?.name}</td>
                                            <td className="p-2 border text-center">{item.quantity}</td>
                                            <td className="p-2 border">{item.remarks || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
