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
    Laptop
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

    // Fetch Stores for return dialog
    const { data: stores = [] } = useQuery<StoreType[]>({
        queryKey: ['stores'],
        queryFn: async () => {
            const res = await fetch('/api/stores');
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

            {/* ASSIGN ASSET DIALOG */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent className="bg-[#1E293B] border-slate-700 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Assign Asset Custody</DialogTitle>
                    </DialogHeader>
                    {selectedSerial && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 bg-[#0F172A] rounded border border-slate-700 text-xs space-y-1">
                                <p><span className="font-bold text-slate-400">Asset Serial:</span> {selectedSerial.serialNumber}</p>
                                <p><span className="font-bold text-slate-400">Item Name:</span> {selectedSerial.item?.name}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Select Recipient Staff</label>
                                <select 
                                    className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded p-2 outline-none"
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
                    )}
                    <DialogFooter>
                        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
                        <Button className="bg-[#0072BB] hover:bg-[#005B96]" onClick={handleAssign} disabled={assignMutation.isPending}>
                            {assignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* HANDOVER ASSET DIALOG */}
            <Dialog open={showHandoverDialog} onOpenChange={setShowHandoverDialog}>
                <DialogContent className="bg-[#1E293B] border-slate-700 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Transfer Custody (Handover)</DialogTitle>
                    </DialogHeader>
                    {selectedSerial && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 bg-[#0F172A] rounded border border-slate-700 text-xs space-y-2">
                                <p><span className="font-bold text-slate-400">Asset Serial:</span> {selectedSerial.serialNumber}</p>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-400">Current Custodian:</span>
                                    <span className="text-emerald-400 font-semibold">{selectedSerial.assignedStaff?.name}</span>
                                </div>
                            </div>
                            <div className="flex justify-center text-slate-500">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Select Target Staff</label>
                                <select 
                                    className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded p-2 outline-none"
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
                    )}
                    <DialogFooter>
                        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowHandoverDialog(false)}>Cancel</Button>
                        <Button className="bg-[#0072BB] hover:bg-[#005B96]" onClick={handleHandover} disabled={handoverMutation.isPending}>
                            {handoverMutation.isPending ? 'Transferring...' : 'Transfer Custody'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* RETIRE / RETURN ASSET DIALOG */}
            <Dialog open={showRetireDialog} onOpenChange={setShowRetireDialog}>
                <DialogContent className="bg-[#1E293B] border-slate-700 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Retire or Return Serial Asset</DialogTitle>
                    </DialogHeader>
                    {selectedSerial && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 bg-[#0F172A] rounded border border-slate-700 text-xs space-y-1">
                                <p><span className="font-bold text-slate-400">Asset Serial:</span> {selectedSerial.serialNumber}</p>
                                <p><span className="font-bold text-slate-400">Item Name:</span> {selectedSerial.item?.name}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Action/Status</label>
                                <select 
                                    className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded p-2 outline-none"
                                    value={retireStatus}
                                    onChange={e => setRetireStatus(e.target.value as 'FAULTY' | 'IN_STORE')}
                                >
                                    <option value="FAULTY">Retire as Faulty (Broken)</option>
                                    <option value="IN_STORE">Return to Inventory Store</option>
                                </select>
                            </div>
                            {retireStatus === 'IN_STORE' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Select Target Store</label>
                                    <select 
                                        className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded p-2 outline-none"
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
                    )}
                    <DialogFooter>
                        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowRetireDialog(false)}>Cancel</Button>
                        <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleRetire} disabled={retireMutation.isPending}>
                            {retireMutation.isPending ? 'Updating...' : 'Confirm Update'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
