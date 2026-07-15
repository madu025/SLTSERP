"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PackageMinus, Plus, Trash2, Eye, Info, Calendar, Building2, User, AlertCircle, PenSquare, Tag, TrendingUp, X, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createStockIssue } from "@/actions/inventory-actions";

interface User {
    id: string;
    name: string;
    role: string;
    storeId?: string;
}

interface IssueItem {
    itemId: string;
    quantity: string;
    remarks: string;
    serials?: string[];
    hasSerial?: boolean;
    availableSerials?: Array<{ id: string; serialNumber: string }>;
}

interface StockIssue {
    id: string;
    issueNumber: string;
    issueType: string;
    recipientName: string;
    issuedById: string;
    issuedBy: { id: string; name: string };
    items: Array<{
        id: string;
        itemId: string;
        item: { name: string; unit: string };
        quantity: number;
        remarks?: string;
    }>;
    remarks?: string;
    createdAt: string;
}

export default function StockIssuePage() {
    const queryClient = useQueryClient();
    const [user] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        }
        return null;
    });
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
    const [selectedIssue, setSelectedIssue] = useState<StockIssue | null>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    // Fetch items for dropdown
    const { data: items = [] } = useQuery<Array<{ id: string; name: string; code: string; hasSerial?: boolean }>>({
        queryKey: ["items"],
        queryFn: async (): Promise<Array<{ id: string; name: string; code: string; hasSerial?: boolean }>> => {
            const res = await fetch("/api/inventory/items");
            return res.json();
        }
    });

    // Fetch projects
    const { data: projects = [] } = useQuery<Array<{ id: string; name: string }>>({
        queryKey: ["projects"],
        queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
            const res = await fetch("/api/projects");
            return res.json();
        }
    });

    // Fetch teams
    const { data: teams = [] } = useQuery<Array<{ id: string; name: string }>>({
        queryKey: ["teams"],
        queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
            const res = await fetch("/api/contractors/teams");
            return res.json();
        }
    });

    // Fetch contractors
    interface ContractorResponse {
        success: boolean;
        data?: {
            contractors: Array<{ id: string; name: string }>;
        };
        contractors?: Array<{ id: string; name: string }>;
    }

    const { data: contractorsData } = useQuery<ContractorResponse>({
        queryKey: ["contractors"],
        queryFn: async () => {
            const res = await fetch("/api/contractors?page=1&limit=1000");
            return res.json();
        }
    });
    const contractors: Array<{ id: string; name: string }> = contractorsData?.success && Array.isArray(contractorsData.data?.contractors)
        ? contractorsData.data.contractors
        : Array.isArray(contractorsData?.contractors)
            ? contractorsData.contractors
            : [];

    // Fetch stock issues history
    const { data: issues = [], isLoading } = useQuery<StockIssue[]>({
        queryKey: ['stock-issues'],
        queryFn: async (): Promise<StockIssue[]> => {
            const res = await fetch('/api/inventory/issues');
            return res.json();
        }
    });

    // Create issue mutation
    const createIssueMutation = useMutation({
        mutationFn: async (data: {
            storeId: string | undefined;
            issuedById: string | undefined;
            issueType: string;
            projectId: string | null;
            contractorId: string | null;
            teamId: string | null;
            recipientName: string;
            remarks: string;
            items: Array<{ itemId: string; quantity: number; remarks: string; serials?: string[] }>;
        }) => {
            return await createStockIssue(data);
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success('Stock issued successfully!');
                queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
                queryClient.invalidateQueries({ queryKey: ['stock'] });
                handleCloseIssueDialog();
            } else {
                toast.error(result.error || 'Failed to issue stock');
            }
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to issue stock');
        }
    });

    const handleOpenIssueDialog = () => {
        setIssueItems([{ itemId: '', quantity: '', remarks: '', serials: [], hasSerial: false, availableSerials: [] }]);
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
        setIssueItems([...issueItems, { itemId: '', quantity: '', remarks: '', serials: [], hasSerial: false, availableSerials: [] }]);
    };

    const removeIssueItem = (index: number) => {
        setIssueItems(issueItems.filter((_, i) => i !== index));
    };

    const updateIssueItem = async (index: number, field: keyof IssueItem, value: string) => {
        const updated = [...issueItems];
        if (field === 'itemId') {
            const selectedItem = items.find(i => i.id === value);
            const hasSerial = selectedItem?.hasSerial || false;
            updated[index] = {
                ...updated[index],
                itemId: value,
                hasSerial,
                serials: [],
                quantity: hasSerial ? '0' : updated[index].quantity,
                availableSerials: []
            };
            setIssueItems(updated);

            if (hasSerial && value && user?.storeId) {
                try {
                    const res = await fetch(`/api/inventory/serials?storeId=${user.storeId}&itemId=${value}`);
                    if (res.ok) {
                        const serialsData = await res.json();
                        setIssueItems(prev => {
                            const newItems = [...prev];
                            if (newItems[index] && newItems[index].itemId === value) {
                                newItems[index] = {
                                    ...newItems[index],
                                    availableSerials: serialsData
                                };
                            }
                            return newItems;
                        });
                    }
                } catch (err) {
                    console.error("Failed to fetch serials", err);
                    toast.error("Failed to load serial numbers for the selected item");
                }
            }
        } else {
            updated[index] = { ...updated[index], [field]: value };
            setIssueItems(updated);
        }
    };

    const handleCreateIssue = () => {
        if (issueItems.length === 0 || issueItems.some(i => !i.itemId || !i.quantity || parseFloat(i.quantity) <= 0)) {
            toast.error('Please add at least one item with valid quantity');
            return;
        }

        if (!recipientName) {
            toast.error('Please enter recipient name');
            return;
        }

        // Validate serials count
        for (const item of issueItems) {
            if (item.hasSerial) {
                const selectedCount = item.serials?.length || 0;
                if (selectedCount === 0) {
                    const itemName = items.find(i => i.id === item.itemId)?.name || 'Serialized item';
                    toast.error(`Please select at least one serial number for ${itemName}`);
                    return;
                }
                if (selectedCount !== parseFloat(item.quantity)) {
                    const itemName = items.find(i => i.id === item.itemId)?.name || 'Serialized item';
                    toast.error(`Selected serial numbers count does not match the quantity for ${itemName}`);
                    return;
                }
            }
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
                remarks: item.remarks,
                serials: item.hasSerial ? item.serials : undefined
            }))
        };

        createIssueMutation.mutate(payload);
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock Issue</h1>
                                <p className="text-xs text-slate-500">Issue materials to projects, contractors, and teams</p>
                            </div>
                            <Button onClick={handleOpenIssueDialog} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">
                                <PackageMinus className="w-3.5 h-3.5" />
                                Issue Stock
                            </Button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b border-slate-200">
                            <button
                                onClick={() => setActiveTab('NEW')}
                                className={`px-3 py-1.5 font-bold text-xs transition-colors ${activeTab === 'NEW'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Recent Issues
                            </button>
                            <button
                                onClick={() => setActiveTab('HISTORY')}
                                className={`px-3 py-1.5 font-bold text-xs transition-colors ${activeTab === 'HISTORY'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                All History
                            </button>
                        </div>

                        {/* Issues List */}
                        <div className="erp-table-container flex flex-col bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Stock Issues</span>
                            </div>
                            {isLoading ? (
                                <div className="text-center p-8 text-slate-400 text-xs font-semibold">Loading...</div>
                            ) : issues.length === 0 ? (
                                <div className="text-center p-8 text-slate-400 text-xs font-semibold">
                                    No stock issues found
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-2">Issue No</th>
                                                <th className="px-3 py-2">Date</th>
                                                <th className="px-3 py-2">Type</th>
                                                <th className="px-3 py-2">Recipient</th>
                                                <th className="px-3 py-2 text-center">Items</th>
                                                <th className="px-3 py-2">Issued By</th>
                                                <th className="px-4 py-2 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {issues.slice(0, activeTab === 'NEW' ? 10 : undefined).map((issue: StockIssue) => (
                                                <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="px-4 py-1.5 font-bold text-slate-800">{issue.issueNumber}</td>
                                                    <td className="px-3 py-1.5 text-slate-500">
                                                        {new Date(issue.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 bg-white text-slate-600 font-medium">{issue.issueType}</Badge>
                                                    </td>
                                                    <td className="px-3 py-1.5 font-semibold text-slate-700">{issue.recipientName}</td>
                                                    <td className="px-3 py-1.5 text-center font-semibold text-slate-700">{issue.items?.length || 0}</td>
                                                    <td className="px-3 py-1.5 text-slate-500">{issue.issuedBy?.name || '-'}</td>
                                                    <td className="px-4 py-1.5 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                            onClick={() => {
                                                                setSelectedIssue(issue);
                                                                setShowDetailsDialog(true);
                                                            }}
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Issue Form Drawer */}
            <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {/* Header Banner */}
                    <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                        <div className="absolute top-0 right-0 p-5">
                            <button 
                                onClick={handleCloseIssueDialog} 
                                className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inventory Management</span>
                                <Badge className="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                    Stock Issue
                                </Badge>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                Issue Materials from Store
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Record dispatch of materials to projects, contractors, or internal teams.
                            </p>
                        </div>
                    </div>

                    {/* Split Panels Body */}
                    <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                        
                        {/* LEFT PANEL (65% Scrollable Form) */}
                        <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                            
                            {/* General details grid */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Issue Type</label>
                                        <select
                                            className="w-full h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                            value={issueType}
                                            onChange={e => setIssueType(e.target.value as 'PROJECT' | 'CONTRACTOR' | 'TEAM' | 'OTHER')}
                                        >
                                            <option value="PROJECT">Project</option>
                                            <option value="CONTRACTOR">Contractor</option>
                                            <option value="TEAM">Team</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>

                                    {issueType === 'PROJECT' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Project</label>
                                            <select
                                                className="w-full h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                value={selectedProject}
                                                onChange={e => setSelectedProject(e.target.value)}
                                            >
                                                <option value="">Select Project...</option>
                                                {projects.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {issueType === 'CONTRACTOR' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contractor</label>
                                            <select
                                                className="w-full h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                value={selectedContractor}
                                                onChange={e => setSelectedContractor(e.target.value)}
                                            >
                                                <option value="">Select Contractor...</option>
                                                {contractors.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {issueType === 'TEAM' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Team</label>
                                            <select
                                                className="w-full h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                value={selectedTeam}
                                                onChange={e => setSelectedTeam(e.target.value)}
                                            >
                                                <option value="">Select Team...</option>
                                                {teams.map((t) => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Recipient Name</label>
                                    <Input
                                        value={recipientName}
                                        onChange={e => setRecipientName(e.target.value)}
                                        placeholder="Person receiving the materials"
                                        className="h-9 rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs focus-visible:ring-1 focus-visible:ring-blue-500 font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Items Selection */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <PackageMinus className="w-3.5 h-3.5 text-blue-500" /> Items to Issue
                                    </h3>
                                    <Button size="sm" onClick={addIssueItem} className="h-7 text-xs font-bold rounded-lg px-2.5 bg-blue-600 hover:bg-blue-700">
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                                    </Button>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Material / Item</th>
                                                <th className="px-4 py-3 text-center w-36">Quantity</th>
                                                <th className="px-4 py-3">Remarks</th>
                                                <th className="px-4 py-3 w-12 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {issueItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No materials added. Click &ldquo;Add Item&rdquo; to start.</td>
                                                </tr>
                                            ) : (
                                                issueItems.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-colors">
                                                        <td className="px-4 py-3.5 space-y-2">
                                                            <select
                                                                className="w-full h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs px-2 focus-visible:ring-1 focus-visible:ring-blue-500 font-bold"
                                                                value={item.itemId}
                                                                onChange={e => updateIssueItem(idx, 'itemId', e.target.value)}
                                                            >
                                                                <option value="">Select Item...</option>
                                                                {items.map((i) => (
                                                                    <option key={i.id} value={i.id}>
                                                                        {i.name} ({i.code})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {item.hasSerial && (
                                                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Select Serial Numbers:</span>
                                                                    {item.availableSerials && item.availableSerials.length > 0 ? (
                                                                        <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 border border-slate-150 dark:border-slate-800/80 p-2 rounded-lg bg-white dark:bg-slate-950 scrollbar-thin">
                                                                            {item.availableSerials.map((s) => {
                                                                                const isChecked = item.serials?.includes(s.serialNumber) || false;
                                                                                return (
                                                                                    <label key={s.id} className="flex items-center gap-2 text-[10px] font-mono font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 p-1 rounded-lg">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isChecked}
                                                                                            onChange={(e) => {
                                                                                                const checked = e.target.checked;
                                                                                                const updatedItems = [...issueItems];
                                                                                                const currentSerials = updatedItems[idx].serials || [];
                                                                                                let newSerials = [];
                                                                                                if (checked) {
                                                                                                    newSerials = [...currentSerials, s.serialNumber];
                                                                                                } else {
                                                                                                    newSerials = currentSerials.filter(sn => sn !== s.serialNumber);
                                                                                                }
                                                                                                updatedItems[idx].serials = newSerials;
                                                                                                updatedItems[idx].quantity = newSerials.length.toString();
                                                                                                setIssueItems(updatedItems);
                                                                                            }}
                                                                                            className="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500"
                                                                                        />
                                                                                        {s.serialNumber}
                                                                                    </label>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-red-500 font-bold italic">No serial numbers available in store.</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <Input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={e => updateIssueItem(idx, 'quantity', e.target.value)}
                                                                disabled={item.hasSerial}
                                                                placeholder={item.hasSerial ? "Auto" : "0"}
                                                                className="h-8 text-right font-bold"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <Input
                                                                value={item.remarks}
                                                                onChange={e => updateIssueItem(idx, 'remarks', e.target.value)}
                                                                placeholder="Optional remarks"
                                                                className="h-8 text-xs"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeIssueItem(idx)}
                                                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dispatch Remarks</label>
                                <Textarea
                                    rows={2}
                                    value={issueRemarks}
                                    onChange={e => setIssueRemarks(e.target.value)}
                                    placeholder="Add any internal dispatch notes, shipping details, or tracking codes..."
                                    className="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* RIGHT PANEL (35% Sticky Details Preview) */}
                        <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                            
                            {/* Materials Included Preview Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <PackageMinus className="w-3.5 h-3.5 text-blue-500" /> Dispatch Summary
                                </h4>
                                
                                <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {issueItems.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 text-xs italic">No items added to dispatch checklist.</div>
                                    ) : (
                                        issueItems.map((item, idx) => {
                                            const matchItem = items.find(i => i.id === item.itemId);
                                            return (
                                                <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex justify-between items-start">
                                                    <div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{matchItem?.name || 'Unselected Material'}</div>
                                                        {matchItem?.code && <div className="text-[9px] text-slate-400 font-mono mt-0.5">{matchItem.code}</div>}
                                                        {item.serials && item.serials.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {item.serials.map(sn => (
                                                                    <Badge key={sn} variant="outline" className="text-[8px] px-1 py-0 font-mono bg-white text-slate-600">{sn}</Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-black text-slate-800 dark:text-slate-200 ml-2 whitespace-nowrap">
                                                        {item.quantity || '0'} Unit(s)
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {(() => {
                                    const totalItems = issueItems.filter(i => i.itemId).length;
                                    const totalQty = issueItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
                                    return (
                                        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs flex justify-between items-center font-bold">
                                            <span className="text-slate-400">Total Dispatch Qty</span>
                                            <span className="text-slate-800 dark:text-slate-200">{totalItems} Material(s) ({totalQty.toLocaleString()})</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Sticky Footer */}
                    <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                        <Button variant="outline" onClick={handleCloseIssueDialog} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateIssue}
                            disabled={createIssueMutation.isPending}
                            className="h-9 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-500/10"
                        >
                            {createIssueMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Issue Materials</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Details Drawer - Premium Enterprise Redesign */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none"
                >
                    {selectedIssue && (
                        <>
                            {/* Header Banner */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        onClick={() => setShowDetailsDialog(false)} 
                                        className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Issue Log Details</span>
                                        <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-955/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            Completed &amp; Dispatched
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                        {selectedIssue.issueNumber}
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Date Issued: <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(selectedIssue.createdAt).toLocaleString()}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Split Panels Body */}
                            <div className="flex-1 flex overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                
                                {/* LEFT PANEL (65% Scrollable) */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    
                                    {/* Issue Information - 6 Cards */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Info className="w-3.5 h-3.5 text-blue-500" /> Dispatch Details
                                        </h3>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Tag className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Issue Type</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedIssue.issueType}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <User className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Recipient</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedIssue.recipientName}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Issued By</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">
                                                        {selectedIssue.issuedBy?.name || 'Storekeeper'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Timestamp</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[10px] truncate block">{new Date(selectedIssue.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                                                <AlertCircle className="w-4 h-4 text-emerald-500" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Dispatch Status</span>
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold px-2 py-0 rounded">DISPATCHED</Badge>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-2.5 font-sans">
                                                <PenSquare className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Remarks</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">{selectedIssue.remarks || 'None'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <PackageMinus className="w-3.5 h-3.5 text-blue-500" /> Issued Materials
                                        </h3>
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur">
                                                    <tr>
                                                        <th className="px-4 py-3">Material / Item</th>
                                                        <th className="px-4 py-3 text-right">Quantity Issued</th>
                                                        <th className="px-4 py-3">Remarks</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedIssue.items?.map((item) => (
                                                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-150 group">
                                                            <td className="px-4 py-3.5">
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className="w-7 h-7 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 font-black text-slate-500 dark:text-slate-400 text-[9px]">
                                                                        {item.item?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div className="font-bold text-slate-900 dark:text-white text-xs">{item.item?.name}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-black text-slate-800 dark:text-slate-200">
                                                                {item.quantity} {item.item?.unit}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-semibold">
                                                                {item.remarks || '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT PANEL (35% Sticky) */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border-l border-slate-200/50 dark:border-slate-800/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    
                                    {/* Summary card */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Summary Metrics
                                        </h4>
                                        {(() => {
                                            const totalItems = selectedIssue.items?.length || 0;
                                            const totalQty = selectedIssue.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                                            return (
                                                <div className="space-y-3 text-xs">
                                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Items Dispatched</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalItems}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5">
                                                        <span className="text-slate-500 dark:text-slate-400">Total Dispatch Qty</span>
                                                        <span className="font-black text-slate-800 dark:text-slate-200">{totalQty.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Dispatch Timeline */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-blue-500" /> Dispatch Timeline
                                        </h4>
                                        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 text-xs">
                                            <div className="relative">
                                                <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">Stock Checked &amp; Allocated</div>
                                                <div className="text-[10px] text-slate-400">Passed store validation check</div>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">Dispatched from Warehouse</div>
                                                <div className="text-[10px] text-slate-400">Received by {selectedIssue.recipientName}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowDetailsDialog(false)}
                                    className="h-9 px-4 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                                >
                                    <X className="w-3.5 h-3.5" /> Close Details
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
