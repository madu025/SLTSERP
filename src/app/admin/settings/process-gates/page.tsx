'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ROLE_GROUPS } from '@/config/roles';
import { Plus, Settings2, Trash2, ShieldAlert, GitMerge } from 'lucide-react';
import { ProcessGateForm } from './ProcessGateForm';
import { ApprovalLevelBuilder } from './ApprovalLevelBuilder';
import { ProcessGatePolicy, ProcessApprovalLevel } from '@prisma/client';
import { toast } from 'sonner';

type GatePolicyWithLevels = ProcessGatePolicy & {
  approvalLevels: ProcessApprovalLevel[];
};

export default function ProcessGatesAdminPage() {
  const [gates, setGates] = useState<GatePolicyWithLevels[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedGate, setSelectedGate] = useState<GatePolicyWithLevels | null>(null);

  useEffect(() => {
    fetchGates();
  }, []);

  const fetchGates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/process-gates?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch process gates');
      const data = await res.json();
      setGates(data.data);
    } catch (error) {
      toast.error('Error fetching process gates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this process gate? This will remove all associated approval rules.')) return;
    
    try {
      const res = await fetch(`/api/admin/process-gates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Process gate deleted');
      setGates(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete process gate');
    }
  };

  const handleEdit = (gate: GatePolicyWithLevels) => {
    setSelectedGate(gate);
    setIsFormOpen(true);
  };

  const handleOpenBuilder = (gate: GatePolicyWithLevels) => {
    setSelectedGate(gate);
    setIsBuilderOpen(true);
  };

  return (
    <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS as unknown as string[]}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-indigo-600" />
                    Process Gate & Approval Policy Engine
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Dynamically configure transition gates, verifications, and multi-tier approval chains across all modules.
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedGate(null); setIsFormOpen(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Gate Policy
                </button>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-slate-500 text-sm">
                        <th className="p-4 font-semibold">Entity Type</th>
                        <th className="p-4 font-semibold">Transition</th>
                        <th className="p-4 font-semibold">Label</th>
                        <th className="p-4 font-semibold">Verifications</th>
                        <th className="p-4 font-semibold">Approval Chain</th>
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">Loading process gates...</td>
                        </tr>
                      ) : gates.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">No process gate policies found. Click &apos;New Gate Policy&apos; to create one.</td>
                        </tr>
                      ) : (
                        gates.map((gate) => (
                          <tr key={gate.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium text-slate-900">
                              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">
                                {gate.entityType}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 text-slate-600 font-mono text-xs">
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{gate.fromStatus}</span>
                                <span>→</span>
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">{gate.toStatus}</span>
                              </div>
                            </td>
                            <td className="p-4 text-slate-700">{gate.label}</td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {gate.reqPhotoProof && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Photo</span>}
                                {gate.reqGpsLocation && <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">GPS</span>}
                                {gate.reqSltsPat && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">SLTS PAT</span>}
                                {gate.reqOpmcPat && <span className="bg-fuchsia-50 text-fuchsia-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">OPMC PAT</span>}
                                {gate.reqDocUpload && <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Doc</span>}
                                {!gate.reqPhotoProof && !gate.reqGpsLocation && !gate.reqSltsPat && !gate.reqOpmcPat && !gate.reqHoPat && !gate.reqDocUpload && 
                                  <span className="text-slate-400 text-xs italic">None</span>
                                }
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 font-medium">
                                  {gate.approvalLevels.length} Level{gate.approvalLevels.length !== 1 ? 's' : ''}
                                </span>
                                <button
                                  onClick={() => handleOpenBuilder(gate)}
                                  className="text-xs flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition-colors"
                                >
                                  <GitMerge className="w-3 h-3" /> Config
                                </button>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${gate.isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {gate.isEnabled ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleEdit(gate)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  title="Edit Policy"
                                >
                                  <Settings2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(gate.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete Policy"
                                >
                                  <Trash2 className="w-4 h-4" />
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
        </div>
      </div>
      
      {isFormOpen && (
        <ProcessGateForm 
          gate={selectedGate} 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            setIsFormOpen(false);
            fetchGates();
          }} 
        />
      )}

      {isBuilderOpen && selectedGate && (
        <ApprovalLevelBuilder
          gate={selectedGate}
          onClose={() => setIsBuilderOpen(false)}
          onSuccess={() => fetchGates()}
        />
      )}
    </RoleGuard>
  );
}
