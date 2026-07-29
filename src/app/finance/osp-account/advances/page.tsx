import { ROLE_GROUPS } from '@/config/roles';
'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

const advanceSchema = z.object({
  refNumber: z.string().min(1, 'Reference Number is required'),
  supplierName: z.string().min(1, 'Supplier Name is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  vatAmount: z.coerce.number().nonnegative().optional(),
});

type AdvanceFormValues = z.infer<typeof advanceSchema>;

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(advanceSchema)
  });

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/finance/osp-account/advances?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setAdvances(data.data);
      }
    } catch (error) {
      console.error('Error fetching Advances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  const onSubmit = async (data: any) => {
    try {
      const res = await fetch('/api/finance/osp-account/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create Advance');
      }
      toast.success('Advance Created successfully (Status: PENDING)');
      setIsModalOpen(false);
      reset();
      fetchAdvances();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/osp-account/advances/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      if (!res.ok) throw new Error('Approval failed');
      toast.success('Advance Approved');
      fetchAdvances();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <RoleGuard allowedRoles={ROLE_GROUPS.PROJECT_MANAGERS}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Project Advances</h1>
                  <p className="text-sm text-slate-500">Manage operational project advances and VAT claims.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  + Add New Advance
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 font-medium text-slate-600">Ref Number</th>
                        <th className="p-4 font-medium text-slate-600">Supplier Name</th>
                        <th className="p-4 font-medium text-slate-600">Base Amount</th>
                        <th className="p-4 font-medium text-slate-600">VAT (18%)</th>
                        <th className="p-4 font-medium text-slate-600">Total Amount</th>
                        <th className="p-4 font-medium text-slate-600">Status</th>
                        <th className="p-4 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr><td colSpan={7} className="p-4 text-center">Loading...</td></tr>
                      ) : advances.length === 0 ? (
                        <tr><td colSpan={7} className="p-4 text-center text-slate-500">No Advances found</td></tr>
                      ) : (
                        advances.map((adv) => (
                          <tr key={adv.id} className="hover:bg-slate-50">
                            <td className="p-4 font-medium text-slate-900">{adv.refNumber}</td>
                            <td className="p-4 text-slate-600">{adv.supplierName || '-'}</td>
                            <td className="p-4 text-slate-600">{adv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-4 text-slate-500">{adv.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-4 text-slate-900 font-semibold">{adv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                adv.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                adv.status === 'SETTLED' ? 'bg-blue-100 text-blue-700' :
                                adv.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {adv.status}
                              </span>
                            </td>
                            <td className="p-4">
                              {adv.status === 'PENDING' && (
                                <button
                                  onClick={() => handleApprove(adv.id)}
                                  className="text-xs font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded"
                                >
                                  Approve
                                </button>
                              )}
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
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Advance</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference Number</label>
                <input
                  {...register('refNumber')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. OSP-ADV-001"
                />
                {errors.refNumber && <p className="text-red-500 text-xs mt-1">{errors.refNumber.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier/Contractor Name</label>
                <input
                  {...register('supplierName')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. ABC Constructions"
                />
                {errors.supplierName && <p className="text-red-500 text-xs mt-1">{errors.supplierName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  {...register('description')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Material advance"
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Base Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('amount')}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                  {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VAT Amount (18%)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('vatAmount')}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Submit Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
