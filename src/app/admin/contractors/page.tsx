"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface TeamMember {
    id?: string;
    name: string;
    idCopyNumber: string;
    contractorIdCopyNumber: string;
}

interface Contractor {
    id: string;
    name: string;
    address: string;
    registrationNumber: string;
    brNumber?: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
    registrationFeePaid: boolean;
    agreementSigned: boolean;
    agreementDate?: string | null;
    bankAccountNumber?: string | null;
    bankBranch?: string | null;
    teamMembers: TeamMember[];
    _count?: { invoices: number };
    createdAt: string;
}

export default function ContractorsPage() {
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContractorId, setEditContractorId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        registrationNumber: '',
        brNumber: '',
        status: 'PENDING' as 'ACTIVE' | 'INACTIVE' | 'PENDING',
        registrationFeePaid: false,
        agreementSigned: false,
        agreementDate: '',
        bankAccountNumber: '',
        bankBranch: '',
        teamMembers: [] as TeamMember[]
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchContractors();
    }, []);

    const fetchContractors = async () => {
        try {
            const resp = await fetch('/api/contractors');
            const data = await resp.json();
            if (Array.isArray(data)) setContractors(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            address: '',
            registrationNumber: '',
            brNumber: '',
            status: 'PENDING',
            registrationFeePaid: false,
            agreementSigned: false,
            agreementDate: '',
            bankAccountNumber: '',
            bankBranch: '',
            teamMembers: []
        });
        setIsEditing(false);
        setEditContractorId(null);
        setShowModal(false);
    };

    const handleEditClick = (contractor: Contractor) => {
        setFormData({
            name: contractor.name,
            address: contractor.address,
            registrationNumber: contractor.registrationNumber,
            brNumber: contractor.brNumber || '',
            status: contractor.status,
            registrationFeePaid: contractor.registrationFeePaid,
            agreementSigned: contractor.agreementSigned,
            agreementDate: contractor.agreementDate ? contractor.agreementDate.split('T')[0] : '',
            bankAccountNumber: contractor.bankAccountNumber || '',
            bankBranch: contractor.bankBranch || '',
            teamMembers: contractor.teamMembers.map(tm => ({
                name: tm.name,
                idCopyNumber: tm.idCopyNumber,
                contractorIdCopyNumber: tm.contractorIdCopyNumber
            }))
        });
        setEditContractorId(contractor.id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!confirm('Are you sure you want to delete this contractor? This action cannot be undone.')) return;

        try {
            const resp = await fetch(`/api/contractors?id=${id}`, { method: 'DELETE' });
            if (resp.ok) {
                alert('Contractor deleted successfully');
                fetchContractors();
            } else {
                const data = await resp.json();
                alert(data.message || 'Failed to delete contractor');
            }
        } catch (err) {
            alert('Error deleting contractor');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const url = '/api/contractors';
        const method = isEditing ? 'PUT' : 'POST';
        const body = isEditing ? { ...formData, id: editContractorId } : formData;

        try {
            const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await resp.json();
            if (resp.ok) {
                resetForm();
                fetchContractors();
                alert(isEditing ? 'Contractor updated successfully!' : 'Contractor registered successfully!');
            } else {
                alert(data.message || 'Operation failed');
            }
        } catch (err) {
            alert('Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const addTeamMember = () => {
        setFormData(prev => ({
            ...prev,
            teamMembers: [...prev.teamMembers, { name: '', idCopyNumber: '', contractorIdCopyNumber: '' }]
        }));
    };

    const removeTeamMember = (index: number) => {
        setFormData(prev => ({
            ...prev,
            teamMembers: prev.teamMembers.filter((_, i) => i !== index)
        }));
    };

    const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
        setFormData(prev => ({
            ...prev,
            teamMembers: prev.teamMembers.map((tm, i) =>
                i === index ? { ...tm, [field]: value } : tm
            )
        }));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-emerald-100 text-emerald-600';
            case 'INACTIVE': return 'bg-red-100 text-red-600';
            case 'PENDING': return 'bg-amber-100 text-amber-600';
            default: return 'bg-slate-100 text-slate-600';
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
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Contractor Management</h1>
                                <p className="text-slate-500 mt-1">Manage contractor registrations, team members, and agreements.</p>
                            </div>
                            <button
                                onClick={() => { resetForm(); setShowModal(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Register Contractor
                            </button>
                        </div>

                        {/* Contractors Table */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Contractor Details</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Registration</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Team</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Status</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900">Agreement</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading Contractors...</td></tr>
                                    ) : contractors.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">No contractors found.</td></tr>
                                    ) : (
                                        contractors.map(contractor => (
                                            <tr key={contractor.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{contractor.name}</p>
                                                        <p className="text-xs text-slate-500">{contractor.address}</p>
                                                        {contractor.brNumber && <p className="text-xs text-slate-400 mt-1">BR: {contractor.brNumber}</p>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-700">{contractor.registrationNumber}</p>
                                                        <div className="flex items-center mt-1">
                                                            {contractor.registrationFeePaid ? (
                                                                <span className="text-xs text-emerald-600 flex items-center">
                                                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Fee Paid
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-amber-600">Fee Pending</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                                                        {contractor.teamMembers.length} Members
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(contractor.status)}`}>
                                                        {contractor.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {contractor.agreementSigned ? (
                                                        <div>
                                                            <span className="text-xs text-emerald-600 font-medium">Signed</span>
                                                            {contractor.agreementDate && (
                                                                <p className="text-xs text-slate-400">{new Date(contractor.agreementDate).toLocaleDateString()}</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Not Signed</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleEditClick(contractor)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                            title="Edit Contractor"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(contractor.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                            title="Delete Contractor"
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

                {/* Registration Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">{isEditing ? 'Edit Contractor' : 'New Contractor Registration'}</h3>
                                    <p className="text-slate-500 text-sm mt-1">
                                        {isEditing ? 'Modify contractor details and team members.' : 'Fill in the details to register a new contractor.'}
                                    </p>
                                </div>
                                <button onClick={resetForm} className="bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-slate-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                {/* Basic Information */}
                                <div>
                                    <h4 className="text-lg font-bold text-slate-900 mb-4">Basic Information</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Contractor Name</label>
                                            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. ABC Construction" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Registration Number</label>
                                            <input type="text" required value={formData.registrationNumber} onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="e.g. CR-2024-001" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Address</label>
                                            <textarea required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" rows={2} placeholder="Full address" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">BR Number (Optional)</label>
                                            <input type="text" value={formData.brNumber} onChange={e => setFormData({ ...formData, brNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="Business Registration Number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer font-medium text-slate-700">
                                                <option value="PENDING">Pending</option>
                                                <option value="ACTIVE">Active</option>
                                                <option value="INACTIVE">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Information */}
                                <div>
                                    <h4 className="text-lg font-bold text-slate-900 mb-4">Financial Information</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bank Account Number</label>
                                            <input type="text" value={formData.bankAccountNumber} onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="Account Number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bank Branch</label>
                                            <input type="text" value={formData.bankBranch} onChange={e => setFormData({ ...formData, bankBranch: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="Branch Name" />
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input type="checkbox" id="regFee" checked={formData.registrationFeePaid} onChange={e => setFormData({ ...formData, registrationFeePaid: e.target.checked })} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                            <label htmlFor="regFee" className="text-sm font-medium text-slate-700">Registration Fee Paid</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input type="checkbox" id="agreement" checked={formData.agreementSigned} onChange={e => setFormData({ ...formData, agreementSigned: e.target.checked })} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                            <label htmlFor="agreement" className="text-sm font-medium text-slate-700">Agreement Signed</label>
                                        </div>
                                        {formData.agreementSigned && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Agreement Date</label>
                                                <input type="date" value={formData.agreementDate} onChange={e => setFormData({ ...formData, agreementDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Team Members */}
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-lg font-bold text-slate-900">Team Members</h4>
                                        <button type="button" onClick={addTeamMember} className="bg-blue-100 hover:bg-blue-200 text-blue-600 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center text-sm">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                            </svg>
                                            Add Member
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {formData.teamMembers.map((member, index) => (
                                            <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="text-sm font-semibold text-slate-600">Member {index + 1}</span>
                                                    <button type="button" onClick={() => removeTeamMember(index)} className="text-red-500 hover:text-red-700">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
                                                        <input type="text" required value={member.name} onChange={e => updateTeamMember(index, 'name', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="Full Name" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">ID Copy Number</label>
                                                        <input type="text" required value={member.idCopyNumber} onChange={e => updateTeamMember(index, 'idCopyNumber', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="ID Number" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Contractor ID Copy</label>
                                                        <input type="text" required value={member.contractorIdCopyNumber} onChange={e => updateTeamMember(index, 'contractorIdCopyNumber', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-blue-500 focus:outline-none transition-all" placeholder="Contractor ID" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {formData.teamMembers.length === 0 && (
                                            <p className="text-center text-slate-400 py-8">No team members added yet. Click "Add Member" to add team members.</p>
                                        )}
                                    </div>
                                </div>

                                <button type="submit" disabled={submitting} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 text-lg mt-4">
                                    {submitting ? 'Saving...' : (isEditing ? 'Update Contractor' : 'Register Contractor')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
