"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
    Search, 
    User, 
    Building, 
    ArrowRight, 
    AlertTriangle, 
    UserCheck,
    RefreshCw,
    Laptop,
    X
} from "lucide-react";
import { toast } from "sonner";

interface StaffType {
    id: string;
    name: string;
    employeeId: string;
}

interface StoreType {
    id: string;
    name: string;
}

interface SerialItem {
    id: string;
    serialNumber: string;
    status: string;
    itemId: string;
    storeId?: string | null;
    assignedStaffId?: string | null;
    item: { name: string; code: string };
    store?: { name: string } | null;
    assignedStaff?: { name: string; employeeId: string } | null;
    updatedAt: string;
}

export default function AssetCustodyPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [staffFilter, setStaffFilter] = useState('');
    
    // Action Dialog States
    const [selectedSerial, setSelectedSerial] = useState<SerialItem | null>(null);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [showHandoverDialog, setShowHandoverDialog] = useState(false);
    const [showRetireDialog, setShowRetireDialog] = useState(false);

    // Form States
    const [targetStaffId, setTargetStaffId] = useState('');
    const [retireStatus, setRetireStatus] = useState<'FAULTY' | 'IN_STORE'>('FAULTY');
    const [targetStoreId, setTargetStoreId] = useState('');

    // Fetch Serials/Assets
    const { data: serials = [], isLoading: isLoadingSerials } = useQuery<SerialItem[]>({
        queryKey: ['assets', searchQuery, staffFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (staffFilter) params.append('staffId', staffFilter);
            const res = await fetch(`/api/inventory/serials?${params.toString()}`);
            return res.json();
        }
    });

    // Fetch Staff Members for dropdowns
    const { data: staffList = [] } = useQuery<StaffType[]>({
        queryKey: ['staff-list'],
        queryFn: async () => {
            const res = await fetch('/api/staff');
            return res.json();
        }
    });

    const { data: stores = [] } = useQuery<StoreType[]>({
        queryKey: ['stores'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/stores');
            return res.json();
        }
    });

    // Mutations
    const assignMutation = useMutation({
        mutationFn: async (payload: { serialNumber: string; staffId: string }) => {
            const res = await fetch('/api/inventory/serials/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to assign asset');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Asset assigned successfully!');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            setShowAssignDialog(false);
            setTargetStaffId('');
        },
        onError: (err: Error) => toast.error(err.message || 'Error assigning asset')
    });

    const handoverMutation = useMutation({
        mutationFn: async (payload: { serialNumber: string; fromStaffId: string; toStaffId: string }) => {
            const res = await fetch('/api/inventory/serials/handover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to transfer asset');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Asset custody transferred successfully!');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            setShowHandoverDialog(false);
            setTargetStaffId('');
        },
        onError: (err: Error) => toast.error(err.message || 'Error transferring asset')
    });

    const retireMutation = useMutation({
        mutationFn: async (payload: { serialNumber: string; status: string; storeId?: string | null }) => {
            const res = await fetch('/api/inventory/serials/retire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to return/retire asset');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Asset status updated successfully!');
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            setShowRetireDialog(false);
            setTargetStoreId('');
        },
        onError: (err: Error) => toast.error(err.message || 'Error updating asset status')
    });

    const handleAssign = () => {
        if (!selectedSerial || !targetStaffId) return;
        assignMutation.mutate({
            serialNumber: selectedSerial.serialNumber,
            staffId: targetStaffId
        });
    };

    const handleHandover = () => {
        if (!selectedSerial || !targetStaffId) return;
        handoverMutation.mutate({
            serialNumber: selectedSerial.serialNumber,
            fromStaffId: selectedSerial.assignedStaffId!,
            toStaffId: targetStaffId
        });
    };

    const handleRetire = () => {
        if (!selectedSerial) return;
        retireMutation.mutate({
            serialNumber: selectedSerial.serialNumber,
            status: retireStatus,
            storeId: retireStatus === 'IN_STORE' ? targetStoreId : null
        });
    };

    return (
        <div className="flex h-screen bg-[#0F172A] text-slate-100 font-sans overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
                <Header />
                <main className="p-6 space-y-6">
                    {/* Header Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-[#1E293B] border-slate-700/50 shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-400 text-xs font-bold uppercase tracking-wide">Total Registered Assets</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold font-mono text-[#0072BB]">{serials.length}</span>
                                    <Laptop className="w-5 h-5 text-slate-400" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[#1E293B] border-slate-700/50 shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-400 text-xs font-bold uppercase tracking-wide">Currently Assigned</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold font-mono text-emerald-500">
                                        {serials.filter(s => s.status === 'ASSIGNED').length}
                                    </span>
                                    <UserCheck className="w-5 h-5 text-emerald-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[#1E293B] border-slate-700/50 shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-400 text-xs font-bold uppercase tracking-wide">Faulty / Retired</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold font-mono text-rose-500">
                                        {serials.filter(s => s.status === 'FAULTY').length}
                                    </span>
                                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filter and Search Bar */}
                    <Card className="bg-[#1E293B] border-slate-700/50 shadow-md">
                        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex flex-1 w-full md:w-auto items-center gap-2 bg-[#0F172A] border border-slate-700 rounded px-3 py-1.5 focus-within:ring-1 focus-within:ring-sky-500">
                                <Search className="w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search Serial Number..."
                                    className="bg-transparent border-none outline-none text-sm w-full text-slate-100 placeholder-slate-500"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex w-full md:w-auto items-center gap-4">
                                <select
                                    className="bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded px-3 py-1.5 outline-none cursor-pointer"
                                    value={staffFilter}
                                    onChange={e => setStaffFilter(e.target.value)}
                                >
                                    <option value="">All Assignees</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.employeeId})</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Main Assets Table */}
                    <Card className="bg-[#1E293B] border-slate-700/50 shadow-md">
                        <CardHeader className="border-b border-slate-700/50 pb-4">
                            <CardTitle className="text-sm font-bold text-slate-300">Serial Assets Custody Directory</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoadingSerials ? (
                                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                                    Loading serial data...
                                </div>
                            ) : serials.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    No serial records found.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-[#0F172A] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700/50">
                                            <tr>
                                                <th className="px-4 py-3">Serial Number</th>
                                                <th className="px-4 py-3">Item Details</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Current Custodian</th>
                                                <th className="px-4 py-3">Last Updated</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {serials.map((serial) => (
                                                <tr key={serial.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3.5 font-semibold font-mono text-slate-100">{serial.serialNumber}</td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-200">{serial.item?.name}</span>
                                                            <span className="text-[10px] text-slate-500 font-mono">{serial.item?.code}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        {serial.status === 'ASSIGNED' && (
                                                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Assigned</Badge>
                                                        )}
                                                        {serial.status === 'IN_STORE' && (
                                                            <Badge className="bg-blue-500/10 text-sky-400 border border-blue-500/20">In Store</Badge>
                                                        )}
                                                        {serial.status === 'FAULTY' && (
                                                            <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20">Faulty</Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        {serial.status === 'ASSIGNED' ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-slate-200">{serial.assignedStaff?.name}</span>
                                                                    <span className="text-[9px] text-slate-500 font-mono">{serial.assignedStaff?.employeeId}</span>
                                                                </div>
                                                            </div>
                                                        ) : serial.status === 'IN_STORE' && serial.store ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                                                <span className="text-slate-300">{serial.store.name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500">Unassigned / None</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-slate-400 font-mono">
                                                        {new Date(serial.updatedAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            {serial.status === 'IN_STORE' && (
                                                                <Button 
                                                                    size="sm" 
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-xs px-2.5 h-7"
                                                                    onClick={() => {
                                                                        setSelectedSerial(serial);
                                                                        setShowAssignDialog(true);
                                                                    }}
                                                                >
                                                                    Assign
                                                                </Button>
                                                            )}
                                                            {serial.status === 'ASSIGNED' && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline"
                                                                    className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs px-2.5 h-7"
                                                                    onClick={() => {
                                                                        setSelectedSerial(serial);
                                                                        setShowHandoverDialog(true);
                                                                    }}
                                                                >
                                                                    Handover
                                                                </Button>
                                                            )}
                                                            {serial.status !== 'FAULTY' && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs px-2 h-7"
                                                                    onClick={() => {
                                                                        setSelectedSerial(serial);
                                                                        setShowRetireDialog(true);
                                                                    }}
                                                                >
                                                                    Retire/Return
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>

            {/* ASSIGN ASSET DRAWER - Premium Design */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-slate-900 border-l border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-slate-100"
                >
                    {selectedSerial && (
                        <>
                            {/* Header */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-950/60 border-b border-slate-800/80">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        type="button"
                                        onClick={() => setShowAssignDialog(false)} 
                                        className="p-2 rounded-full hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Management</span>
                                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            Assign Custody
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-white leading-tight">
                                        Assign Asset Custody
                                    </h2>
                                    <p className="text-xs text-slate-400">
                                        Assign a serialized asset to an active staff member for field deployment.
                                    </p>
                                </div>
                            </div>

                            {/* Body Split */}
                            <div className="flex-1 flex overflow-hidden bg-slate-950/20">
                                {/* Left Panel */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-800/50">
                                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Recipient Staff</label>
                                            <select 
                                                className="w-full h-10 bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-xl px-3 outline-none focus:ring-1 focus:ring-sky-500"
                                                value={targetStaffId}
                                                onChange={e => setTargetStaffId(e.target.value)}
                                            >
                                                <option value="">Choose Staff Member...</option>
                                                {staffList.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.employeeId})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-950/40 border-l border-slate-800/50">
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Laptop className="w-3.5 h-3.5 text-sky-500" /> Asset Profile
                                        </h4>
                                        <div className="space-y-3.5 text-xs">
                                            <div className="pb-3 border-b border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Serial Number</span>
                                                <span className="font-mono font-bold text-slate-200 text-xs">{selectedSerial.serialNumber}</span>
                                            </div>
                                            <div className="pb-3 border-b border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Material Name</span>
                                                <span className="font-bold text-slate-200 text-xs">{selectedSerial.item?.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Product Code</span>
                                                <span className="font-mono font-bold text-slate-400 text-xs">{selectedSerial.item?.code}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button variant="outline" onClick={() => setShowAssignDialog(false)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-800 hover:bg-slate-850 text-slate-300">
                                    Cancel
                                </Button>
                                <Button className="h-9 px-5 text-xs font-bold text-white rounded-xl bg-sky-600 hover:bg-sky-700 shadow-sm" onClick={handleAssign} disabled={assignMutation.isPending}>
                                    {assignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* HANDOVER ASSET DRAWER - Premium Design */}
            <Dialog open={showHandoverDialog} onOpenChange={setShowHandoverDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-slate-900 border-l border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-slate-100"
                >
                    {selectedSerial && (
                        <>
                            {/* Header */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-950/60 border-b border-slate-800/80">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        type="button"
                                        onClick={() => setShowHandoverDialog(false)} 
                                        className="p-2 rounded-full hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Management</span>
                                        <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            Transfer Custody
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-white leading-tight">
                                        Transfer Custody (Handover)
                                    </h2>
                                    <p className="text-xs text-slate-400">
                                        Transfer ownership and accountability of this asset from one staff member to another.
                                    </p>
                                </div>
                            </div>

                            {/* Body Split */}
                            <div className="flex-1 flex overflow-hidden bg-slate-950/20">
                                {/* Left Panel */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-800/50">
                                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Recipient Staff</label>
                                            <select 
                                                className="w-full h-10 bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-xl px-3 outline-none focus:ring-1 focus:ring-sky-500"
                                                value={targetStaffId}
                                                onChange={e => setTargetStaffId(e.target.value)}
                                            >
                                                <option value="">Choose Recipient Staff...</option>
                                                {staffList.filter(s => s.id !== selectedSerial.assignedStaffId).map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.employeeId})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-950/40 border-l border-slate-800/50">
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Laptop className="w-3.5 h-3.5 text-sky-500" /> Asset Profile
                                        </h4>
                                        <div className="space-y-3.5 text-xs">
                                            <div className="pb-3 border-b border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Serial Number</span>
                                                <span className="font-mono font-bold text-slate-200 text-xs">{selectedSerial.serialNumber}</span>
                                            </div>
                                            <div className="pb-3 border-b border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Current Custodian</span>
                                                <span className="font-bold text-emerald-400 text-xs">{selectedSerial.assignedStaff?.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Item Name</span>
                                                <span className="font-bold text-slate-350 text-xs">{selectedSerial.item?.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button variant="outline" onClick={() => setShowHandoverDialog(false)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-800 hover:bg-slate-850 text-slate-300">
                                    Cancel
                                </Button>
                                <Button className="h-9 px-5 text-xs font-bold text-white rounded-xl bg-sky-600 hover:bg-sky-700 shadow-sm" onClick={handleHandover} disabled={handoverMutation.isPending}>
                                    {handoverMutation.isPending ? 'Transferring...' : 'Transfer Custody'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* RETIRE / RETURN ASSET DRAWER - Premium Design */}
            <Dialog open={showRetireDialog} onOpenChange={setShowRetireDialog}>
                <DialogContent 
                    showCloseButton={false}
                    className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[65vw] !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-slate-900 border-l border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-slate-100"
                >
                    {selectedSerial && (
                        <>
                            {/* Header */}
                            <div className="relative p-6 pb-4 flex-shrink-0 bg-slate-950/60 border-b border-slate-800/80">
                                <div className="absolute top-0 right-0 p-5">
                                    <button 
                                        type="button"
                                        onClick={() => setShowRetireDialog(false)} 
                                        className="p-2 rounded-full hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Management</span>
                                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] px-2 py-0 font-bold rounded-full">
                                            Return / Retire
                                        </Badge>
                                    </div>
                                    <h2 className="text-xl font-black text-white leading-tight">
                                        Retire or Return Serial Asset
                                    </h2>
                                    <p className="text-xs text-slate-400">
                                        Change asset status to faulty or return it to inventory stores database.
                                    </p>
                                </div>
                            </div>

                            {/* Body Split */}
                            <div className="flex-1 flex overflow-hidden bg-slate-950/20">
                                {/* Left Panel */}
                                <div className="w-[65%] h-full overflow-y-auto p-6 space-y-6 border-r border-slate-800/50">
                                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action / Status</label>
                                            <select 
                                                className="w-full h-10 bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-xl px-3 outline-none focus:ring-1 focus:ring-sky-500"
                                                value={retireStatus}
                                                onChange={e => setRetireStatus(e.target.value as 'FAULTY' | 'IN_STORE')}
                                            >
                                                <option value="FAULTY">Retire as Faulty (Broken)</option>
                                                <option value="IN_STORE">Return to Inventory Store</option>
                                            </select>
                                        </div>

                                        {retireStatus === 'IN_STORE' && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Target Store</label>
                                                <select 
                                                    className="w-full h-10 bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-xl px-3 outline-none focus:ring-1 focus:ring-sky-500"
                                                    value={targetStoreId}
                                                    onChange={e => setTargetStoreId(e.target.value)}
                                                >
                                                    <option value="">Select target store...</option>
                                                    {stores.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Panel */}
                                <div className="w-[35%] h-full overflow-y-auto p-6 space-y-6 bg-slate-950/40 border-l border-slate-800/50">
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Laptop className="w-3.5 h-3.5 text-sky-500" /> Asset Profile
                                        </h4>
                                        <div className="space-y-3.5 text-xs">
                                            <div className="pb-3 border-b border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Serial Number</span>
                                                <span className="font-mono font-bold text-slate-200 text-xs">{selectedSerial.serialNumber}</span>
                                            </div>
                                            <div className="pb-3 border-b border-slate-800/80">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Item Name</span>
                                                <span className="font-bold text-slate-200 text-xs">{selectedSerial.item?.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end items-center flex-shrink-0 gap-3">
                                <Button variant="outline" onClick={() => setShowRetireDialog(false)} className="h-9 px-4 text-xs font-bold rounded-xl border-slate-800 hover:bg-slate-850 text-slate-300">
                                    Cancel
                                </Button>
                                <Button className="h-9 px-5 text-xs font-bold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-sm" onClick={handleRetire} disabled={retireMutation.isPending}>
                                    {retireMutation.isPending ? 'Updating...' : 'Confirm Update'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
