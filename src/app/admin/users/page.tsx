"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface User {
    id: string;
    username: string;
    email: string;
    name: string | null;
    role: string;
    employeeId?: string | null;
    createdAt: string;
    accessibleOpmcs: { id: string, rtom: string }[];
}

interface OPMC {
    id: string;
    name: string;
    rtom: string;
}

export default function UserRegistrationPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [opmcs, setOpmcs] = useState<OPMC[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editUserId, setEditUserId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        name: '',
        role: 'ENGINEER',
        employeeId: '',
        opmcIds: [] as string[]
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchOpmcs();
    }, []);

    const fetchUsers = async () => {
        try {
            const resp = await fetch('/api/users');
            const data = await resp.json();
            if (Array.isArray(data)) setUsers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchOpmcs = async () => {
        try {
            const resp = await fetch('/api/opmcs');
            const data = await resp.json();
            if (Array.isArray(data)) setOpmcs(data);
        } catch (err) { console.error('Failed to fetch OPMCs'); }
    };

    const resetForm = () => {
        setFormData({
            username: '', email: '', password: '', name: '', role: 'ENGINEER', employeeId: '', opmcIds: []
        });
        setIsEditing(false);
        setEditUserId(null);
        setShowModal(false);
    };

    const handleEditClick = (user: User) => {
        setFormData({
            username: user.username,
            email: user.email,
            password: '', // Leave empty to keep unchanged
            name: user.name || '',
            role: user.role,
            employeeId: user.employeeId || '', // Assuming this comes from API
            opmcIds: user.accessibleOpmcs ? user.accessibleOpmcs.map(o => o.id) : []
        });
        setEditUserId(user.id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDeleteClick = async (id: string, role: string) => {
        if (role === 'SUPER_ADMIN') {
            alert('Cannot delete Super Admin user.');
            return;
        }
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            const resp = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (resp.ok) {
                alert('User deleted successfully');
                fetchUsers();
            } else {
                const data = await resp.json();
                alert(data.message || 'Failed to delete user');
            }
        } catch (err) {
            alert('Error deleting user');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const url = '/api/users';
        const method = isEditing ? 'PUT' : 'POST';
        const body = isEditing ? { ...formData, id: editUserId } : formData;

        try {
            const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await resp.json();
            if (resp.ok) {
                resetForm();
                fetchUsers();
                alert(isEditing ? 'User updated successfully!' : 'User registered successfully!');
            } else {
                alert(data.message || 'Operation failed');
            }
        } catch (err) {
            alert('Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const roleCategories = {
        'OSP Category': ['MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
        'Office Admin Category': ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT'],
        'Finance Category': ['FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
        'Invoice Section': ['INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
        'Stores Category': ['STORES_MANAGER', 'STORES_ASSISTANT'],
        'Service Fulfillment': ['SA_MANAGER', 'SA_ASSISTANT'],
        'System Admin': ['SUPER_ADMIN', 'ADMIN']
    };

    const toggleOpmc = (id: string) => {
        setFormData(prev => {
            const ids = prev.opmcIds.includes(id)
                ? prev.opmcIds.filter(x => x !== id)
                : [...prev.opmcIds, id];
            return { ...prev, opmcIds: ids };
        });
    };

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Registration</h1>
                                <p className="text-slate-500 mt-1">Manage personnel, roles, and OPMC access rights.</p>
                            </div>
                            <button
                                onClick={() => { resetForm(); setShowModal(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Register New User
                            </button>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">User Details</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Role</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Access</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Status</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Loading Users...</td></tr>
                                    ) : users.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">No users found.</td></tr>
                                    ) : (
                                        users.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold mr-3">
                                                            {(user.name || user.username).substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{user.name || 'No Name'}</p>
                                                            <p className="text-xs text-slate-500">{user.username} | {user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-600">
                                                        {user.role.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex -space-x-2">
                                                        {user.accessibleOpmcs?.slice(0, 3).map(opmc => (
                                                            <div key={opmc.id} title={opmc.rtom} className="h-6 w-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                                {opmc.rtom.substring(0, 2)}
                                                            </div>
                                                        ))}
                                                        {user.accessibleOpmcs?.length > 3 && (
                                                            <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">
                                                                +{user.accessibleOpmcs.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center text-emerald-600 text-sm">
                                                        <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                                                        Active
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleEditClick(user)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                            title="Edit User"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        {user.role !== 'SUPER_ADMIN' && (
                                                            <button
                                                                onClick={() => handleDeleteClick(user.id, user.role)}
                                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                                title="Delete User"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Enhanced Registration Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">{isEditing ? 'Edit User' : 'New User Registration'}</h3>
                                    <p className="text-slate-500 text-sm mt-1">
                                        {isEditing ? 'Modify user details and permissions.' : 'Fill in the details to create a new system account.'}
                                    </p>
                                </div>
                                <button onClick={resetForm} className="bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-slate-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Username</label>
                                        <input type="text" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. jdoe" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                        <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. John Doe" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Employee No</label>
                                        <input type="text" value={formData.employeeId} onChange={e => setFormData({ ...formData, employeeId: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. EMP001" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                                        <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="j.doe@slt.lk" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Role Category</label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer font-medium text-slate-700"
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        >
                                            {Object.entries(roleCategories).map(([category, roles]) => (
                                                <optgroup key={category} label={category}>
                                                    {roles.map(role => (
                                                        <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">OPMC Access (Multi-Select)</label>
                                    <div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50 max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                                        {opmcs.map(opmc => (
                                            <label key={opmc.id} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    checked={formData.opmcIds.includes(opmc.id)}
                                                    onChange={() => toggleOpmc(opmc.id)}
                                                />
                                                <span className="text-sm font-medium text-slate-700">{opmc.rtom}</span>
                                            </label>
                                        ))}
                                        {opmcs.length === 0 && <span className="text-sm text-slate-400 col-span-2">No OPMCs available to select.</span>}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Access Password {isEditing && <span className="text-xs font-normal text-slate-400 lowercase">(leave blank to keep current)</span>}</label>
                                    <input type="password" required={!isEditing} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="••••••••" />
                                </div>

                                <button type="submit" disabled={submitting} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 text-lg mt-4">
                                    {submitting ? 'Saving Changes...' : (isEditing ? 'Update User' : 'Complete Registration')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
