"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface OPMC {
    id: string;
    name: string;
    rtom: string;
    region: string;
    province: string;
    createdAt: string;
    _count?: {
        staff: number;
        projects: number;
    };
}

export default function OPMCRegistrationPage() {
    const [opmcs, setOpmcs] = useState<OPMC[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', rtom: '', region: 'METRO', province: 'METRO 01' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchOpmcs();
    }, []);

    const fetchOpmcs = async () => {
        try {
            const resp = await fetch('/api/opmcs');
            const data = await resp.json();
            if (Array.isArray(data)) setOpmcs(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', rtom: '', region: 'METRO', province: 'METRO 01' });
        setIsEditing(false);
        setEditId(null);
        setShowModal(false);
    };

    const handleEdit = (opmc: OPMC) => {
        setFormData({ name: opmc.name, rtom: opmc.rtom, region: opmc.region, province: opmc.province });
        setEditId(opmc.id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (opmc: OPMC) => {
        const confirmMsg = `Are you sure you want to delete "${opmc.name}"? This action cannot be undone.`;
        if (!confirm(confirmMsg)) return;

        try {
            const resp = await fetch(`/api/opmcs?id=${opmc.id}`, { method: 'DELETE' });
            const data = await resp.json();

            if (resp.ok) {
                alert('OPMC deleted successfully');
                fetchOpmcs();
            } else {
                alert(data.message || 'Failed to delete OPMC');
            }
        } catch (err) {
            alert('Error deleting OPMC');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const url = '/api/opmcs';
        const method = isEditing ? 'PUT' : 'POST';
        const body = isEditing ? { ...formData, id: editId } : formData;

        try {
            const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await resp.json();

            if (resp.ok) {
                resetForm();
                fetchOpmcs();
                alert(isEditing ? 'OPMC updated successfully!' : 'OPMC registered successfully!');
            } else {
                alert(data.message || 'Operation failed');
            }
        } catch (err) {
            alert('Failed to save OPMC');
        } finally {
            setSubmitting(false);
        }
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
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">OPMC Registration</h1>
                                <p className="text-slate-500 mt-1">Manage Outside Plant Maintenance Centers across regions.</p>
                            </div>
                            <button
                                onClick={() => { resetForm(); setShowModal(true); }}
                                className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                New OPMC
                            </button>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Name</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">RTOM</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Region</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Province</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Usage</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading OPMCs...</td></tr>
                                    ) : opmcs.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">No OPMCs registered yet.</td></tr>
                                    ) : (
                                        opmcs.map(opmc => (
                                            <tr key={opmc.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900">{opmc.name || '-'}</td>
                                                <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-600">{opmc.rtom}</span></td>
                                                <td className="px-6 py-4 text-slate-600">{opmc.region}</td>
                                                <td className="px-6 py-4 text-slate-600">{opmc.province}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3 text-xs">
                                                        <span className="text-slate-500">
                                                            <span className="font-semibold text-slate-700">{opmc._count?.staff || 0}</span> staff
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-slate-500">
                                                            <span className="font-semibold text-slate-700">{opmc._count?.projects || 0}</span> projects
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleEdit(opmc)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                            title="Edit OPMC"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(opmc)}
                                                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                            title="Delete OPMC"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
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
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                            <h3 className="text-xl font-bold text-slate-900">{isEditing ? 'Edit OPMC' : 'Add New OPMC'}</h3>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">OPMC Name (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    placeholder="e.g. Homagama OPMC"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">RTOM Code</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.rtom}
                                    onChange={e => setFormData({ ...formData, rtom: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    placeholder="e.g. R-HK"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                                <select
                                    required
                                    value={formData.region}
                                    onChange={e => setFormData({ ...formData, region: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                >
                                    <option value="METRO">METRO</option>
                                    <option value="REGION 01">REGION 01</option>
                                    <option value="REGION 02">REGION 02</option>
                                    <option value="REGION 03">REGION 03</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Province</label>
                                <select
                                    required
                                    value={formData.province}
                                    onChange={e => setFormData({ ...formData, province: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                >
                                    <option value="METRO 01">METRO 01</option>
                                    <option value="METRO 02">METRO 02</option>
                                    <option value="CP">CP</option>
                                    <option value="NWP">NWP</option>
                                    <option value="EP">EP</option>
                                    <option value="NP">NP</option>
                                    <option value="SAB">SAB</option>
                                    <option value="SP">SP</option>
                                    <option value="WPS">WPS</option>
                                    <option value="UVA">UVA</option>
                                </select>
                            </div>
                            <div className="pt-4 flex space-x-4">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : (isEditing ? 'Update OPMC' : 'Register OPMC')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
