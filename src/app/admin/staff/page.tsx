"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash, User as UserIcon, Network, ChevronRight, ChevronDown } from "lucide-react";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

// --- TYPES ---
interface Staff {
    id: string;
    name: string;
    employeeId: string;
    designation: string;
    reportsToId: string | null;
    opmcId: string | null;
    opmc?: { code: string; name: string };
    user?: { id: string; username: string; name: string; role: string } | null;
    children?: Staff[];
    isOpen?: boolean;
}

interface User {
    id: string;
    username: string;
    name: string;
    role: string;
    staffId: string | null;
}

// --- ZOD ---
const staffSchema = z.object({
    name: z.string().min(2),
    employeeId: z.string().min(2),
    designation: z.string().min(2),
    reportsToId: z.string().optional().nullable(),
    opmcId: z.string().optional().nullable(),
});
type StaffFormValues = z.infer<typeof staffSchema>

export default function StaffHierarchyPage() {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'tree' | 'chart'>('tree');

    // UI State
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

    // --- QUERIES ---
    const { data: staffList = [], isLoading } = useQuery<Staff[]>({
        queryKey: ['staff'],
        queryFn: async () => {
            const res = await fetch('/api/staff');
            return res.json();
        }
    });

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['available-users'],
        queryFn: async () => {
            const res = await fetch('/api/users');
            return res.json();
        }
    });

    // --- DERIVED STATE ---
    const treeData = React.useMemo(() => {
        if (!Array.isArray(staffList)) return [];
        const idMapping = staffList.reduce((acc, el, i) => {
            acc[el.id] = i;
            return acc;
        }, {} as Record<string, number>);

        const rootNodes: Staff[] = [];
        // Deep copy to avoid mutating cache directly if we were modifying it, though re-render handles it
        const nodes: Staff[] = JSON.parse(JSON.stringify(staffList)).map((item: Staff) => ({ ...item, children: [], isOpen: true }));

        nodes.forEach(el => {
            // Handle null possibility carefully
            if (el.reportsToId && nodes.find(n => n.id === el.reportsToId)) {
                const parentEl = nodes.find(n => n.id === el.reportsToId);
                if (parentEl) {
                    parentEl.children = parentEl.children || [];
                    parentEl.children.push(el);
                }
            } else {
                rootNodes.push(el);
            }
        });
        return rootNodes;
    }, [staffList]);

    // --- MUTATIONS ---
    const addMutation = useMutation({
        mutationFn: async (values: StaffFormValues) => {
            const res = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setShowAddModal(false);
            toast.success("Staff member added");
        }
    });

    const assignMutation = useMutation({
        mutationFn: async ({ staffId, userId }: { staffId: string, userId: string | null }) => {
            const res = await fetch('/api/staff', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: staffId, userId })
            });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setShowAssignModal(false);
            toast.success("User assigned successfully");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            toast.success("Staff member deleted");
        }
    });

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Header Controls */}
                    <div className="flex-none p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Staff Hierarchy</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Manage organization structure and user linkage</p>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-white border rounded-lg p-1 flex">
                                    <button
                                        onClick={() => setViewMode('tree')}
                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        List View
                                    </button>
                                    <button
                                        onClick={() => setViewMode('chart')}
                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${viewMode === 'chart' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        Org Chart
                                    </button>
                                </div>
                                <Button size="sm" onClick={() => setShowAddModal(true)} className="h-8 text-xs">
                                    <Plus className="w-4 h-4 mr-2" /> Add Staff
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 mx-4 mb-4 bg-white rounded-xl border shadow-sm flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 overflow-auto p-6">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-full text-slate-400 text-sm">Loading hierarchy...</div>
                            ) : treeData.length === 0 ? (
                                <div className="flex justify-center items-center h-full text-slate-400 text-sm">No staff found. Create the first record.</div>
                            ) : viewMode === 'tree' ? (
                                <div className="space-y-1">
                                    {treeData.map(node => (
                                        <TreeNode
                                            key={node.id}
                                            node={node}
                                            depth={0}
                                            onAssign={(s) => { setSelectedStaff(s); setShowAssignModal(true); }}
                                            onDelete={(id) => { if (confirm('Delete staff member?')) deleteMutation.mutate(id); }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex justify-center min-w-max p-10">
                                    <OrgChart nodes={treeData} onAssign={(s) => { setSelectedStaff(s); setShowAssignModal(true); }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- MODALS --- */}
                <AddStaffModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={(vals) => addMutation.mutate(vals)}
                    staffList={staffList}
                />

                <AssignUserModal
                    isOpen={showAssignModal}
                    staff={selectedStaff}
                    onClose={() => { setShowAssignModal(false); setSelectedStaff(null); }}
                    onAssign={(uid) => selectedStaff && assignMutation.mutate({ staffId: selectedStaff.id, userId: uid })}
                    users={users.filter(u => !u.staffId || (selectedStaff && u.staffId === selectedStaff.id))}
                />

            </main>
        </div>
    );
}

// --- SUB COMPONENTS ---

function TreeNode({ node, depth, onAssign, onDelete }: { node: Staff, depth: number, onAssign: (s: Staff) => void, onDelete: (id: string) => void }) {
    const [isOpen, setIsOpen] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div>
            <div
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100 mb-1"
                style={{ marginLeft: `${depth * 28}px` }}
            >
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 transition-transform ${hasChildren ? '' : 'invisible'}`}
                >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100">
                    {(node.name[0] || '?').toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{node.name}</span>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium border border-slate-200">{node.designation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{node.employeeId}</span>
                        {node.user ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 px-1 rounded">
                                <UserIcon className="w-2.5 h-2.5" /> {node.user.username}
                            </span>
                        ) : (
                            <span className="text-amber-500 flex items-center gap-1 font-medium bg-amber-50 px-1 rounded">No User</span>
                        )}
                    </div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAssign(node)}>
                        {node.user ? 'Change User' : 'Assign User'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(node.id)}>
                        <Trash className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
            {hasChildren && isOpen && (
                <div className="relative">
                    {/* Connector Line */}
                    <div className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-200" style={{ left: `${depth * 28 + 11 + 24}px` }}></div>
                    {node.children!.map(child => (
                        <TreeNode key={child.id} node={child} depth={depth + 1} onAssign={onAssign} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

function OrgChart({ nodes, level = 0, onAssign }: { nodes: Staff[], level?: number, onAssign: (s: Staff) => void }) {
    return (
        <div className="flex gap-8 justify-center">
            {nodes.map(node => (
                <div key={node.id} className="flex flex-col items-center">
                    <div className="relative bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-all w-48 mb-6 group z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-100">
                                {(node.name[0] || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">{node.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{node.designation}</div>
                            </div>
                        </div>
                        {node.user && (
                            <div className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-1 rounded border border-emerald-100 flex items-center gap-1 truncate">
                                <UserIcon className="w-3 h-3" /> {node.user.username}
                            </div>
                        )}

                        <button
                            onClick={() => onAssign(node)}
                            className="absolute top-2 right-2 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <UserIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {node.children && node.children.length > 0 && (
                        <div className="relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-6 bg-slate-300 -mt-6" /> {/* Line from parent to sub-tree */}
                            <div className="flex pt-4 relative">
                                {/* Horizontal Bar connecting children */}
                                {node.children.length > 1 && (
                                    <div className="absolute top-0 left-[10%] right-[10%] h-px bg-slate-300 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)]" />
                                )}
                                <OrgChart nodes={node.children} level={level + 1} onAssign={onAssign} />
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// --- MODAL COMPONENTS ---

function AddStaffModal({ isOpen, onClose, onSubmit, staffList }: { isOpen: boolean, onClose: () => void, onSubmit: (v: StaffFormValues) => void, staffList: Staff[] }) {
    const form = useForm<StaffFormValues>({
        resolver: zodResolver(staffSchema),
        defaultValues: { name: '', employeeId: '', designation: 'ENGINEER', reportsToId: null, opmcId: null }
    });

    // Reset when reopened
    React.useEffect(() => { if (isOpen) form.reset(); }, [isOpen, form]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Staff Member</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Name</FormLabel>
                                    <FormControl><Input className="h-8 text-xs" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="employeeId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Employee ID</FormLabel>
                                    <FormControl><Input className="h-8 text-xs" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="designation" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Designation</FormLabel>
                                <FormControl><Input className="h-8 text-xs" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="reportsToId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Reports To</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                    <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Manager" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">None (Top Level)</SelectItem>
                                        {staffList.map(s => (
                                            <SelectItem key={s.id} value={s.id} className="text-xs">{s.name} - {s.designation}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit">Add Staff</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function AssignUserModal({ isOpen, onClose, onAssign, users, staff }: { isOpen: boolean, onClose: () => void, onAssign: (uid: string | null) => void, users: User[], staff: Staff | null }) {
    if (!staff) return null;
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign User to {staff.name}</DialogTitle>
                    <DialogDescription>Link a system user account to this staff profile.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {staff.user && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center mb-4">
                            <span className="text-xs text-blue-700">Current: <strong>{staff.user.username}</strong></span>
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onAssign(null)}>Unlink</Button>
                        </div>
                    )}
                    {users.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-4">No available users found.</div>
                    ) : (
                        users.map(u => (
                            <button
                                key={u.id}
                                onClick={() => onAssign(u.id)}
                                className="w-full text-left p-3 rounded-lg border hover:bg-slate-50 hover:border-blue-200 transition-all group"
                            >
                                <div className="text-xs font-bold text-slate-800">{u.name}</div>
                                <div className="text-[10px] text-slate-500">{u.username} • {u.role}</div>
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
