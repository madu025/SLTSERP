"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
    supervisor?: { id: string, name: string | null, username: string };
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
        opmcIds: [] as string[],
        supervisorId: '',
        supervisorSearchTerm: '',
        showSupervisorDropdown: false
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
            username: '', email: '', password: '', name: '', role: 'ENGINEER', employeeId: '', opmcIds: [], supervisorId: '',
            supervisorSearchTerm: '', showSupervisorDropdown: false
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
            employeeId: user.employeeId || '',
            opmcIds: user.accessibleOpmcs ? user.accessibleOpmcs.map(o => o.id) : [],
            supervisorId: user.supervisor?.id || '',
            supervisorSearchTerm: '',
            showSupervisorDropdown: false
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

    const handleSelectAllOpmcs = () => {
        if (formData.opmcIds.length === opmcs.length) {
            setFormData(prev => ({ ...prev, opmcIds: [] })); // Deselect all
        } else {
            setFormData(prev => ({ ...prev, opmcIds: opmcs.map(o => o.id) })); // Select all
        }
    };

    // Supervisor Logic
    const getPotentialSupervisors = useMemo(() => {
        const currentRole = formData.role;
        // Simple hierarchy filter: Allow users with "Admin", "Manager", or specific higher ranks to be supervisors.
        // For strict hierarchy:
        // AREA_COORDINATOR -> AE, ENGINEER, AREA_MANAGER, OSP_MANAGER, MANAGER
        // AE/ENGINEER -> AREA_MANAGER, OSP_MANAGER, MANAGER
        // AREA_MANAGER -> OSP_MANAGER, MANAGER

        let allowedRoles: string[] = [];

        switch (currentRole) {
            case 'AREA_COORDINATOR':
            case 'QC_OFFICER':
                allowedRoles = ['ASSISTANT_ENGINEER', 'ENGINEER', 'AREA_MANAGER', 'OSP_MANAGER', 'MANAGER'];
                break;
            case 'ASSISTANT_ENGINEER':
            case 'ENGINEER':
                allowedRoles = ['AREA_MANAGER', 'OSP_MANAGER', 'MANAGER'];
                break;
            case 'AREA_MANAGER':
                allowedRoles = ['OSP_MANAGER', 'MANAGER'];
                break;
            case 'OSP_MANAGER':
                allowedRoles = ['MANAGER'];
                break;
            default:
                // For other roles, allow any Manager/Admin type
                allowedRoles = ['MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
        }

        return users.filter(u => allowedRoles.includes(u.role) && u.id !== editUserId);
    }, [users, formData.role, editUserId]);


    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />

                <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Registration</h1>
                                <p className="text-sm text-slate-500 mt-0.5">Manage personnel, roles, and OPMC access rights.</p>
                            </div>
                            <button
                                onClick={() => { resetForm(); setShowModal(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md shadow-blue-600/20 transition-all flex items-center text-sm"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Register New User
                            </button>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-900 uppercase tracking-wider">User Details</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-900 uppercase tracking-wider">Role</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-900 uppercase tracking-wider">Access</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-900 uppercase tracking-wider">Supervisor</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-900 uppercase tracking-wider text-right">Actions</th>
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
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold mr-3 text-xs">
                                                            {(user.name || user.username).substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-900 text-sm">{user.name || 'No Name'}</p>
                                                            <p className="text-[11px] text-slate-500">{user.username} | {user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 border border-blue-100">
                                                        {user.role.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex -space-x-1.5">
                                                        {user.accessibleOpmcs?.slice(0, 4).map(opmc => (
                                                            <div key={opmc.id} title={opmc.rtom} className="h-5 w-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[7px] font-bold text-slate-600">
                                                                {opmc.rtom.substring(0, 2)}
                                                            </div>
                                                        ))}
                                                        {user.accessibleOpmcs?.length > 4 && (
                                                            <div className="h-5 w-5 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[7px] font-bold text-slate-500">
                                                                +{user.accessibleOpmcs.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {user.supervisor ? (
                                                        <div className="text-xs text-slate-600 flex items-center">
                                                            <svg className="w-3 h-3 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                            {user.supervisor.name || user.supervisor.username}
                                                        </div>
                                                    ) : <span className="text-[10px] text-slate-400 italic">None</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end space-x-1">
                                                        <button
                                                            onClick={() => handleEditClick(user)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                            title="Edit User"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        {user.role !== 'SUPER_ADMIN' && (
                                                            <button
                                                                onClick={() => handleDeleteClick(user.id, user.role)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                                                title="Delete User"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{isEditing ? 'Edit User' : 'New User Registration'}</h3>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        {isEditing ? 'Modify user details and permissions.' : 'Fill in the details to create a new system account.'}
                                    </p>
                                </div>
                                <button onClick={resetForm} className="bg-slate-50 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Column 1: Personal Info & Role */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Role Category</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer font-medium text-slate-700"
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
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Immediate Supervisor</label>
                                            <div className="relative">
                                                {/* Searchable Dropdown */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                                                        placeholder="Search supervisor..."
                                                        value={
                                                            // If we have a supervisor selected but no search term (e.g. edit mode), show the name
                                                            // Otherwise show what user is typing
                                                            formData.supervisorId && !formData.supervisorSearchTerm
                                                                ? (users.find(u => u.id === formData.supervisorId)?.name || users.find(u => u.id === formData.supervisorId)?.username || '')
                                                                : (formData.supervisorSearchTerm || '')
                                                        }
                                                        onChange={(e) => {
                                                            setFormData({
                                                                ...formData,
                                                                supervisorSearchTerm: e.target.value,
                                                                // If they clear it, clear the ID
                                                                supervisorId: e.target.value === '' ? '' : formData.supervisorId
                                                            });
                                                        }}
                                                        onFocus={() => setFormData(p => ({ ...p, showSupervisorDropdown: true, supervisorSearchTerm: '' }))}
                                                    />
                                                    {formData.supervisorId && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, supervisorId: '', supervisorSearchTerm: '' })}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    )}
                                                </div>

                                                {formData.showSupervisorDropdown && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setFormData(p => ({ ...p, showSupervisorDropdown: false }))}></div>
                                                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                                            <div
                                                                className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-500 italic text-xs border-b border-slate-50"
                                                                onClick={() => setFormData(p => ({ ...p, supervisorId: '', showSupervisorDropdown: false, supervisorSearchTerm: '' }))}
                                                            >
                                                                No Supervisor
                                                            </div>
                                                            {getPotentialSupervisors
                                                                .filter(u => {
                                                                    const term = (formData.supervisorSearchTerm || '').toLowerCase();
                                                                    return (u.name?.toLowerCase().includes(term) || u.username.toLowerCase().includes(term) || u.role.toLowerCase().includes(term));
                                                                })
                                                                .map(u => (
                                                                    <div
                                                                        key={u.id}
                                                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 flex flex-col border-b border-slate-50 last:border-0"
                                                                        onClick={() => setFormData(p => ({
                                                                            ...p,
                                                                            supervisorId: u.id,
                                                                            showSupervisorDropdown: false,
                                                                            supervisorSearchTerm: '' // Clear search term so input shows the name from ID lookup
                                                                        }))}
                                                                    >
                                                                        <span className="font-semibold">{u.name || u.username}</span>
                                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{u.role.replace(/_/g, ' ')}</span>
                                                                    </div>
                                                                ))}
                                                            {getPotentialSupervisors.length === 0 && (
                                                                <div className="px-3 py-2 text-slate-400 text-xs text-center">No supervisors found</div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Access Password</label>
                                            <input type="password" required={!isEditing} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="••••••••" />
                                            {isEditing && <p className="text-[10px] text-slate-400 mt-1">* Leave blank to keep current password</p>}
                                        </div>
                                    </div>

                                    {/* Column 2: Basic Details */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
                                            <input type="text" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. jdoe" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                                            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. John Doe" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Employee No</label>
                                            <input type="text" value={formData.employeeId} onChange={e => setFormData({ ...formData, employeeId: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. EMP001" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                                            <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="j.doe@slt.lk" />
                                        </div>
                                    </div>

                                    {/* Column 3: OPMC Access */}
                                    <div className="md:col-span-1">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">OPMC Access</label>
                                            <button
                                                type="button"
                                                onClick={handleSelectAllOpmcs}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                            >
                                                {formData.opmcIds.length === opmcs.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 h-[280px] overflow-y-auto space-y-1 custom-scrollbar">
                                            {opmcs.map(opmc => (
                                                <label key={opmc.id} className="flex items-center space-x-2.5 cursor-pointer p-1.5 hover:bg-white rounded transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                                        checked={formData.opmcIds.includes(opmc.id)}
                                                        onChange={() => toggleOpmc(opmc.id)}
                                                    />
                                                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{opmc.rtom}</span>
                                                </label>
                                            ))}
                                            {opmcs.length === 0 && <span className="text-sm text-slate-400">No OPMCs available to select.</span>}
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                                <button
                                    onClick={resetForm}
                                    className="mr-3 px-6 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-200 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 text-sm flex items-center"
                                >
                                    {submitting && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {isEditing ? 'Update User' : 'Complete Registration'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
