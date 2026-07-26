"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, Edit2, ShieldAlert, Star, Building, Phone, Mail, User } from "lucide-react";
import { toast } from 'sonner';

interface Vendor {
    id: string;
    code: string;
    name: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    brNumber: string | null;
    registrationNo: string | null;
    bankName: string | null;
    bankBranch: string | null;
    bankAccountNo: string | null;
    status: string;
    type: string;
    rating: number | null;
    notes: string | null;
}

export default function VendorManagementPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        brNumber: '',
        bankName: '',
        bankBranch: '',
        bankAccountNo: '',
        type: 'SUPPLIER',
        status: 'ACTIVE',
        notes: ''
    });

    // --- QUERIES ---
    const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
        queryKey: ["vendors"],
        queryFn: async () => {
            const res = await fetch("/api/vendors");
            if (!res.ok) return [];
            return res.json();
        }
    });

    // --- MUTATIONS ---
    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await fetch('/api/vendors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create vendor');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Vendor created successfully');
            queryClient.invalidateQueries({ queryKey: ["vendors"] });
            setShowModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<typeof formData> }) => {
            const res = await fetch(`/api/vendors/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update vendor');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Vendor updated successfully');
            queryClient.invalidateQueries({ queryKey: ["vendors"] });
            setShowModal(false);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/vendors/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete vendor');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Vendor deactivated successfully');
            queryClient.invalidateQueries({ queryKey: ["vendors"] });
            setDeleteTarget(null);
        },
        onError: () => {
            toast.error('Failed to deactivate vendor');
        }
    });

    const handleOpenModal = (vendor?: Vendor) => {
        if (vendor) {
            setSelectedVendor(vendor);
            setFormData({
                name: vendor.name,
                contactPerson: vendor.contactPerson || '',
                email: vendor.email || '',
                phone: vendor.phone || '',
                address: vendor.address || '',
                brNumber: vendor.brNumber || '',
                bankName: vendor.bankName || '',
                bankBranch: vendor.bankBranch || '',
                bankAccountNo: vendor.bankAccountNo || '',
                type: vendor.type || 'SUPPLIER',
                status: vendor.status || 'ACTIVE',
                notes: vendor.notes || ''
            });
        } else {
            setSelectedVendor(null);
            setFormData({
                name: '',
                contactPerson: '',
                email: '',
                phone: '',
                address: '',
                brNumber: '',
                bankName: '',
                bankBranch: '',
                bankAccountNo: '',
                type: 'SUPPLIER',
                status: 'ACTIVE',
                notes: ''
            });
        }
        setShowModal(true);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedVendor) {
            updateMutation.mutate({ id: selectedVendor.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const filteredVendors = vendors.filter(v => {
        const query = searchTerm.toLowerCase();
        return v.name.toLowerCase().includes(query) ||
            v.code.toLowerCase().includes(query) ||
            (v.contactPerson && v.contactPerson.toLowerCase().includes(query)) ||
            (v.email && v.email.toLowerCase().includes(query));
    });

    return (
        <div className="h-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 space-y-4">
                    
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                <Building className="w-6 h-6 text-blue-600" />
                                Vendor Registry
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage official suppliers, partners and financial details
                            </p>
                        </div>
                        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Vendor
                        </Button>
                    </div>

                    <div className="flex gap-2 items-center bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Search by code, name, email or contact..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></span>
                            </div>
                        ) : filteredVendors.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                <Building className="w-12 h-12 mb-2 opacity-50" />
                                No vendors found.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="p-4">Code</th>
                                        <th className="p-4">Vendor Details</th>
                                        <th className="p-4">Contact Info</th>
                                        <th className="p-4">Bank Details</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {filteredVendors.map(vendor => (
                                        <tr key={vendor.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="p-4 font-mono font-bold text-blue-600">{vendor.code}</td>
                                            <td className="p-4">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">{vendor.name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{vendor.type}</div>
                                                {vendor.rating && (
                                                    <div className="flex items-center gap-1 mt-1 text-amber-500">
                                                        <Star className="w-3.5 h-3.5 fill-current" />
                                                        <span className="text-xs font-semibold">{vendor.rating}.0</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 space-y-1">
                                                {vendor.contactPerson && (
                                                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{vendor.contactPerson}</span>
                                                    </div>
                                                )}
                                                {vendor.email && (
                                                    <div className="flex items-center gap-1 text-slate-500">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-xs">{vendor.email}</span>
                                                    </div>
                                                )}
                                                {vendor.phone && (
                                                    <div className="flex items-center gap-1 text-slate-500">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-xs">{vendor.phone}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {vendor.bankAccountNo ? (
                                                    <div>
                                                        <div className="font-semibold text-slate-800 dark:text-slate-200">{vendor.bankAccountNo}</div>
                                                        <div className="text-xs text-slate-500">{vendor.bankName} - {vendor.bankBranch}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No details</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    vendor.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                                }`}>
                                                    {vendor.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenModal(vendor)}>
                                                        <Edit2 className="w-4 h-4 text-slate-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(vendor)} disabled={vendor.status === 'INACTIVE'}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Create/Edit Dialog */}
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{selectedVendor ? 'Edit Vendor Details' : 'Add New Vendor'}</DialogTitle>
                            <DialogDescription>
                                Enter vendor business information and bank credentials.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Business Name</label>
                                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Contact Person</label>
                                    <Input value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Phone</label>
                                    <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Email Address</label>
                                    <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Office Address</label>
                                    <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">BR Number</label>
                                    <Input value={formData.brNumber} onChange={e => setFormData({...formData, brNumber: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Business Type</label>
                                    <select 
                                        value={formData.type} 
                                        onChange={e => setFormData({...formData, type: e.target.value})}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:outline-none"
                                    >
                                        <option value="SUPPLIER">SUPPLIER</option>
                                        <option value="SUBCONTRACTOR">SUBCONTRACTOR</option>
                                        <option value="SERVICE_PROVIDER">SERVICE PROVIDER</option>
                                    </select>
                                </div>
                                <div className="col-span-2 border-t pt-2 mt-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Settlement Bank Details</h4>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Bank Name</label>
                                    <Input value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Branch Name</label>
                                    <Input value={formData.bankBranch} onChange={e => setFormData({...formData, bankBranch: e.target.value})} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Account Number</label>
                                    <Input value={formData.bankAccountNo} onChange={e => setFormData({...formData, bankAccountNo: e.target.value})} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Vendor</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Soft Delete Alert */}
                <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <ShieldAlert className="w-5 h-5" />
                                Deactivate Vendor?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to deactivate <strong>{deleteTarget?.name}</strong>? This vendor&apos;s status will be set to INACTIVE.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Deactivate
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </main>
        </div>
    );
}
