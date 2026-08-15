'use client';
import { ROLE_GROUPS } from '@/config/roles';

import {  useState, useEffect  } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

const rentSchema = z.object({
  supplierName: z.string().min(1, 'Landlord/Supplier Name is required'),
  accountNo: z.string().optional(),
  category: z.string().optional(),
  slipNo: z.string().min(1, 'Slip No is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
});

type RentFormValues = z.infer<typeof rentSchema>;

export default function RentsPage() {
  const [rents, setRents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(rentSchema),
    defaultValues: { category: 'Office Rent' }
  });

  const fetchRents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/finance/osp-account/rents?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setRents(data.data);
      }
    } catch (error) {
      console.error('Error fetching Rents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRents();
  }, []);

  const onSubmit = async (data: any) => {
    try {
      const res = await fetch('/api/finance/osp-account/rents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create Rent Payment');
      }
      toast.success('Rent Payment Created successfully (Status: PENDING)');
      setIsModalOpen(false);
      reset();
      fetchRents();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/osp-account/rents/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      if (!res.ok) throw new Error('Approval failed');
      toast.success('Rent Payment Approved');
      fetchRents();
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
                  <h1 className="text-2xl font-bold text-slate-900">Property & Office Rents</h1>
                  <p className="text-sm text-slate-500">Manage rent payments and landlord slips.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  + Add New Rent Payment
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 font-medium text-slate-600">Landlord/Supplier</th>
                        <th className="p-4 font-medium text-slate-600">Account No</th>
                        <th className="p-4 font-medium text-slate-600">Slip No</th>
                        <th className="p-4 font-medium text-slate-600">Category</th>
                        <th className="p-4 font-medium text-slate-600">Amount (LKR)</th>
                        <th className="p-4 font-medium text-slate-600">Status</th>
                        <th className="p-4 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr><td colSpan={7} className="p-4 text-center">Loading...</td></tr>
                      ) : rents.length === 0 ? (
                        <tr><td colSpan={7} className="p-4 text-center text-slate-500">No Rent Payments found</td></tr>
                      ) : (
                        rents.map((rent) => (
                          <tr key={rent.id} className="hover:bg-slate-50">
                            <td className="p-4 font-medium text-slate-900">{rent.supplierName}</td>
                            <td className="p-4 text-slate-600">{rent.accountNo || '-'}</td>
                            <td className="p-4 text-slate-600 font-mono text-xs">{rent.slipNo}</td>
                            <td className="p-4 text-slate-500">{rent.category}</td>
                            <td className="p-4 text-slate-900 font-semibold">{rent.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                rent.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                rent.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {rent.status}
                              </span>
                            </td>
                            <td className="p-4">
                              {rent.status === 'PENDING' && (
                                <button
                                  onClick={() => handleApprove(rent.id)}
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
            <h2 className="text-xl font-bold text-slate-900 mb-4">Record Rent Payment</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Landlord/Supplier Name</label>
                <input
                  {...register('supplierName')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. HDHP Martinus"
                />
                {errors.supplierName && <p className="text-red-500 text-xs mt-1">{errors.supplierName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slip No</label>
                  <input
                    {...register('slipNo')}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. SLIP-10293"
                  />
                  {errors.slipNo && <p className="text-red-500 text-xs mt-1">{errors.slipNo.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account No</label>
                  <input
                    {...register('accountNo')}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 1000-xxxx-xxxx"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  {...register('category')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Office Rent">Office Rent</option>
                  <option value="Land Rent">Land Rent</option>
                  <option value="Store Rent">Store Rent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount')}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
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
                  {isSubmitting ? 'Creating...' : 'Submit Rent Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
