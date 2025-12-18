"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

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

export default function StaffHierarchyPage() {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [treeData, setTreeData] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
    const [draggedNode, setDraggedNode] = useState<Staff | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        employeeId: '',
        designation: 'ENGINEER',
        reportsToId: '',
        opmcId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [staffRes, usersRes] = await Promise.all([
                fetch('/api/staff'),
                fetch('/api/users')
            ]);

            const staffData = await staffRes.json();
            const usersData = await usersRes.json();

            if (Array.isArray(staffData)) {
                setStaffList(staffData);
                buildTree(staffData);
            }
            if (Array.isArray(usersData)) setUsers(usersData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const buildTree = (data: Staff[]) => {
        const idMapping = data.reduce((acc, el, i) => {
            acc[el.id] = i;
            return acc;
        }, {} as Record<string, number>);

        const rootNodes: Staff[] = [];
        const nodes: Staff[] = data.map(item => ({ ...item, children: [], isOpen: true }));

        nodes.forEach(el => {
            if (el.reportsToId && nodes[idMapping[el.reportsToId]]) {
                const parentEl = nodes[idMapping[el.reportsToId]];
                parentEl.children = parentEl.children || [];
                parentEl.children.push(el);
            } else {
                rootNodes.push(el);
            }
        });

        setTreeData(rootNodes);
    };

    const handleDragStart = (e: React.DragEvent, node: Staff) => {
        e.stopPropagation();
        setDraggedNode(node);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetNode: Staff | null) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedNode) return;
        if (draggedNode.id === targetNode?.id) return;

        const confirmMsg = targetNode
            ? `Move ${draggedNode.name} to report to ${targetNode.name}?`
            : `Make ${draggedNode.name} a top-level manager?`;

        if (!confirm(confirmMsg)) return;

        try {
            const resp = await fetch('/api/staff', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: draggedNode.id, reportsToId: targetNode?.id || null })
            });

            if (resp.ok) {
                fetchData();
            } else {
                alert('Failed to move staff');
            }
        } catch (err) {
            alert('Error moving staff');
        } finally {
            setDraggedNode(null);
        }
    };

    const handleAssignUser = async (userId: string | null) => {
        if (!selectedStaff) return;

        try {
            const resp = await fetch('/api/staff', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedStaff.id, userId })
            });

            if (resp.ok) {
                setShowAssignModal(false);
                setSelectedStaff(null);
                fetchData();
            } else {
                alert('Failed to assign user');
            }
        } catch (err) {
            alert('Error assigning user');
        }
    };

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const resp = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (resp.ok) {
                setShowAddModal(false);
                setFormData({ name: '', employeeId: '', designation: 'ENGINEER', reportsToId: '', opmcId: '' });
                fetchData();
            } else {
                const data = await resp.json();
                alert(data.message || 'Failed to add staff');
            }
        } catch (err) {
            alert('Error adding staff');
        }
    };

    const handleDeleteStaff = async (staff: Staff) => {
        if (!confirm(`Delete ${staff.name}? This action cannot be undone.`)) return;

        try {
            const resp = await fetch(`/api/staff?id=${staff.id}`, { method: 'DELETE' });
            const data = await resp.json();

            if (resp.ok) {
                fetchData();
            } else {
                alert(data.message || 'Failed to delete staff');
            }
        } catch (err) {
            alert('Error deleting staff');
        }
    };

    const unassignedUsers = users.filter(u => !u.staffId);

    const VerticalTreeNode = ({ node, level }: { node: Staff, level: number }) => {
        const hasChildren = node.children && node.children.length > 0;
        const [isOpen, setIsOpen] = useState(node.isOpen !== false);

        return (
            <div className="select-none">
                <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, node)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, node)}
                    className={`group flex items-center p-4 mb-2 rounded-xl border transition-all cursor-move ${draggedNode?.id === node.id
                            ? 'bg-blue-50 border-blue-200 opacity-50'
                            : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
                        }`}
                    style={{ marginLeft: `${level * 32}px` }}
                >
                    <div className="mr-3 text-slate-400 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                        {hasChildren ? (
                            <svg className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        ) : (
                            <span className="w-4 h-4 inline-block"></span>
                        )}
                    </div>

                    <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm mr-4 border-2 border-indigo-100">
                        {node.user ? (
                            node.user.name.substring(0, 2).toUpperCase()
                        ) : (
                            node.name.substring(0, 2).toUpperCase()
                        )}
                    </div>

                    <div className="flex-1">
                        <p className="font-bold text-slate-800">{node.name}</p>
                        <div className="flex items-center text-xs text-slate-500 mt-1 space-x-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                                {node.designation?.replace(/_/g, ' ') || 'Staff'}
                            </span>
                            <span>•</span>
                            <span>{node.employeeId}</span>
                            {node.opmc && (
                                <>
                                    <span>•</span>
                                    <span className="text-blue-600 font-medium">{node.opmc.code}</span>
                                </>
                            )}
                        </div>
                        {node.user && (
                            <div className="mt-1 flex items-center text-xs text-emerald-600">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                Linked to: {node.user.name} ({node.user.username})
                            </div>
                        )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <button
                            onClick={() => { setSelectedStaff(node); setShowAssignModal(true); }}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                            title={node.user ? "Change User" : "Assign User"}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleDeleteStaff(node)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            title="Delete"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {hasChildren && isOpen && (
                    <div className="relative">
                        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-slate-200" style={{ left: `${level * 32 + 27}px` }}></div>
                        {node.children!.map(child => (
                            <VerticalTreeNode key={child.id} node={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const HorizontalOrgChart = ({ nodes, level = 0 }: { nodes: Staff[], level?: number }) => {
        if (nodes.length === 0) return null;

        return (
            <div className="flex flex-col items-center">
                <div className="flex space-x-6 mb-8">
                    {nodes.map((node) => (
                        <div key={node.id} className="flex flex-col items-center">
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, node)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, node)}
                                className={`group relative bg-white border-2 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all cursor-move w-64 ${draggedNode?.id === node.id ? 'border-blue-300 bg-blue-50 opacity-50' : 'border-slate-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex items-start space-x-3">
                                    <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border-2 border-indigo-100 flex-shrink-0">
                                        {node.user ? node.user.name.substring(0, 2).toUpperCase() : node.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 truncate">{node.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{node.designation?.replace(/_/g, ' ')}</p>
                                        {node.user && (
                                            <p className="text-xs text-emerald-600 mt-1 truncate">👤 {node.user.name}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                    <button
                                        onClick={() => { setSelectedStaff(node); setShowAssignModal(true); }}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {node.children && node.children.length > 0 && (
                                <div className="mt-8">
                                    <div className="h-8 w-px bg-slate-300 mx-auto"></div>
                                    <HorizontalOrgChart nodes={node.children} level={level + 1} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Staff Hierarchy</h1>
                                <p className="text-slate-500 mt-1">Organize reporting structure and assign users to positions</p>
                            </div>
                            <div className="flex space-x-3">
                                <div className="bg-white border border-slate-200 rounded-xl p-1 flex">
                                    <button
                                        onClick={() => setLayout('vertical')}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${layout === 'vertical' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Vertical Tree
                                    </button>
                                    <button
                                        onClick={() => setLayout('horizontal')}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${layout === 'horizontal' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Horizontal Chart
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Staff
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 min-h-[600px]">
                            {layout === 'vertical' && (
                                <>
                                    <div
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, null)}
                                        className={`border-2 border-dashed border-slate-100 rounded-xl p-4 mb-6 transition-colors text-center text-slate-400 text-sm font-medium ${draggedNode ? 'bg-blue-50/50 border-blue-200' : ''
                                            }`}
                                    >
                                        Drop here to make a staff member a top-level manager
                                    </div>

                                    {loading ? (
                                        <div className="text-center py-20 text-slate-400">Loading hierarchy...</div>
                                    ) : treeData.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400">No staff records found.</div>
                                    ) : (
                                        treeData.map(node => <VerticalTreeNode key={node.id} node={node} level={0} />)
                                    )}
                                </>
                            )}

                            {layout === 'horizontal' && (
                                <div className="overflow-x-auto">
                                    {loading ? (
                                        <div className="text-center py-20 text-slate-400">Loading hierarchy...</div>
                                    ) : treeData.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400">No staff records found.</div>
                                    ) : (
                                        <HorizontalOrgChart nodes={treeData} />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Unassigned Users Panel */}
                        {unassignedUsers.length > 0 && (
                            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-6">
                                <h3 className="font-bold text-amber-900 mb-3 flex items-center">
                                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Unassigned Users ({unassignedUsers.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {unassignedUsers.map(user => (
                                        <div key={user.id} className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm">
                                            <span className="font-medium text-slate-800">{user.name}</span>
                                            <span className="text-slate-500 ml-2">({user.role.replace(/_/g, ' ')})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Add Staff Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-slate-900">Add Staff Member</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddStaff} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.employeeId}
                                    onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="e.g. EMP001"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.designation}
                                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="e.g. ENGINEER"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                                >
                                    Add Staff
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign User Modal */}
            {showAssignModal && selectedStaff && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-slate-900">Assign User to {selectedStaff.name}</h3>
                            <button onClick={() => { setShowAssignModal(false); setSelectedStaff(null); }} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6">
                            {selectedStaff.user && (
                                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <p className="text-sm text-blue-900">
                                        Currently linked to: <strong>{selectedStaff.user.name}</strong> ({selectedStaff.user.username})
                                    </p>
                                    <button
                                        onClick={() => handleAssignUser(null)}
                                        className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Unlink User
                                    </button>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Select User</label>
                                {users.filter(u => !u.staffId || u.staffId === selectedStaff.id).map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleAssignUser(user.id)}
                                        className="w-full p-4 text-left border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                                    >
                                        <p className="font-medium text-slate-900">{user.name}</p>
                                        <p className="text-sm text-slate-500">{user.username} • {user.role.replace(/_/g, ' ')}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
