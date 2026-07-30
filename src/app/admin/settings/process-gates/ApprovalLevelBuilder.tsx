import { useState } from 'react';
import { X, Trash2, Plus, GitMerge, DollarSign, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ProcessGatePolicy, ProcessApprovalLevel } from '@prisma/client';

type GatePolicyWithLevels = ProcessGatePolicy & {
  approvalLevels: ProcessApprovalLevel[];
};

export function ApprovalLevelBuilder({ 
  gate, 
  onClose, 
  onSuccess 
}: { 
  gate: GatePolicyWithLevels, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    requiredRole: '',
    description: '',
    minAmount: '',
    maxAmount: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.requiredRole) {
      toast.error('Required role is mandatory');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        requiredRole: formData.requiredRole,
        description: formData.description || null,
        minAmount: formData.minAmount ? parseFloat(formData.minAmount) : null,
        maxAmount: formData.maxAmount ? parseFloat(formData.maxAmount) : null,
      };

      const res = await fetch(`/api/admin/process-gates/${gate.id}/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to add level');

      toast.success('Approval level added');
      setFormData({ requiredRole: '', description: '', minAmount: '', maxAmount: '' });
      onSuccess();
    } catch {
      toast.error('Error adding approval level');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLevel = async (levelId: string) => {
    if (!confirm('Remove this approval level? The chain will be automatically reordered.')) return;
    
    try {
      const res = await fetch(`/api/admin/process-gates/${gate.id}/levels/${levelId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete level');
      
      toast.success('Level removed');
      onSuccess();
    } catch {
      toast.error('Error removing level');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-indigo-600" />
              Approval Chain Builder
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              {gate.entityType}: {gate.fromStatus} → {gate.toStatus}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Left Col: Current Chain */}
            <div className="lg:col-span-3 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Current Chain</h3>
              
              {gate.approvalLevels.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center flex flex-col items-center justify-center text-slate-500">
                  <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm font-medium">No approval levels defined.</p>
                  <p className="text-xs mt-1">This transition will bypass approvals entirely if hard verifications pass.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gate.approvalLevels.map((level: ProcessApprovalLevel, index: number) => (
                    <div key={level.id} className="relative flex gap-4">
                      {/* Connection Line */}
                      {index !== gate.approvalLevels.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-[-16px] w-0.5 bg-slate-200" />
                      )}
                      
                      {/* Level Number Node */}
                      <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm z-10 border-2 border-white shadow-sm">
                        {level.level}
                      </div>

                      {/* Level Card */}
                      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="w-4 h-4 text-slate-400" />
                              <span className="font-bold text-slate-800">{level.requiredRole}</span>
                            </div>
                            {level.description && (
                              <p className="text-xs text-slate-500 mb-2">{level.description}</p>
                            )}
                            {(level.minAmount !== null || level.maxAmount !== null) && (
                              <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-flex border border-emerald-100">
                                <DollarSign className="w-3 h-3" />
                                {level.minAmount !== null ? `Min: ${level.minAmount}` : ''}
                                {level.minAmount !== null && level.maxAmount !== null ? ' - ' : ''}
                                {level.maxAmount !== null ? `Max: ${level.maxAmount}` : ''}
                              </div>
                            )}
                          </div>
                          
                          <button 
                            onClick={() => handleDeleteLevel(level.id)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove Level"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Add New Level */}
            <div className="lg:col-span-2">
              <div className="bg-white border rounded-xl shadow-sm p-4 sticky top-0">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Add Next Step</h3>
                
                <form onSubmit={handleAddLevel} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Required Role *</label>
                    <select
                      name="requiredRole"
                      value={formData.requiredRole}
                      onChange={handleChange}
                      required
                      className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Select Role...</option>
                      <option value="ENGINEER">ENGINEER</option>
                      <option value="AREA_MANAGER">AREA MANAGER</option>
                      <option value="OSP_MANAGER">OSP MANAGER</option>
                      <option value="STORES_MANAGER">STORES MANAGER</option>
                      <option value="FINANCE_MANAGER">FINANCE MANAGER</option>
                      <option value="CEO">CEO</option>
                      <option value="SUPER_ADMIN">SUPER ADMIN</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Instructions</label>
                    <input
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="e.g. Verify budget limits"
                      className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Min Amount (Optional)</label>
                      <input
                        type="number"
                        name="minAmount"
                        value={formData.minAmount}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Max Amount (Optional)</label>
                      <input
                        type="number"
                        name="maxAmount"
                        value={formData.maxAmount}
                        onChange={handleChange}
                        placeholder="Uncapped"
                        className="w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {loading ? 'Adding...' : 'Add Level'}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
