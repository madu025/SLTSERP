import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ProcessGatePolicy } from '@prisma/client';

export function ProcessGateForm({ 
  gate, 
  onClose, 
  onSuccess 
}: { 
  gate: ProcessGatePolicy | null, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    entityType: gate?.entityType || '',
    fromStatus: gate?.fromStatus || '',
    toStatus: gate?.toStatus || '',
    label: gate?.label || '',
    isEnabled: gate ? gate.isEnabled : true,
    reqOpmcPat: gate?.reqOpmcPat || false,
    reqHoPat: gate?.reqHoPat || false,
    reqSltsPat: gate?.reqSltsPat || false,
    reqPhotoProof: gate?.reqPhotoProof || false,
    reqGpsLocation: gate?.reqGpsLocation || false,
    reqDocUpload: gate?.reqDocUpload || false,
    writeAuditLedger: gate ? gate.writeAuditLedger : true,
    generateIssueNote: gate?.generateIssueNote || false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setFormData(prev => ({ ...prev, [target.name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = gate ? `/api/admin/process-gates/${gate.id}` : `/api/admin/process-gates`;
      const method = gate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save gate policy');
      }

      toast.success(gate ? 'Policy updated successfully' : 'Policy created successfully');
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = !!gate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            {isEditMode ? 'Edit Process Gate Policy' : 'Create Process Gate Policy'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <form id="gate-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
                <select
                  name="entityType"
                  value={formData.entityType}
                  onChange={handleChange}
                  disabled={isEditMode}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 disabled:bg-slate-100"
                >
                  <option value="">Select Entity...</option>
                  <option value="SOD">SOD</option>
                  <option value="PROJECT">PROJECT</option>
                  <option value="INVOICE">INVOICE</option>
                  <option value="STOCK_ISSUE">STOCK_ISSUE</option>
                  <option value="MRN">MRN</option>
                  <option value="GRN">GRN</option>
                  <option value="PURCHASE_ORDER">PURCHASE_ORDER</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gate Label</label>
                <input
                  type="text"
                  name="label"
                  value={formData.label}
                  onChange={handleChange}
                  required
                  placeholder="e.g. SOD Invoicable Gate"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From Status</label>
                <input
                  type="text"
                  name="fromStatus"
                  value={formData.fromStatus}
                  onChange={handleChange}
                  disabled={isEditMode}
                  required
                  placeholder="e.g. COMPLETED"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-mono text-sm uppercase disabled:bg-slate-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To Status</label>
                <input
                  type="text"
                  name="toStatus"
                  value={formData.toStatus}
                  onChange={handleChange}
                  disabled={isEditMode}
                  required
                  placeholder="e.g. INVOICABLE"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-mono text-sm uppercase disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Verifications Section */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">Hard Verifications (Checkboxes)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="reqPhotoProof" checked={formData.reqPhotoProof} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Require Photo Proof</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="reqGpsLocation" checked={formData.reqGpsLocation} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Require GPS Validation</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="reqDocUpload" checked={formData.reqDocUpload} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Require Document Upload</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="reqOpmcPat" checked={formData.reqOpmcPat} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Require OPMC PAT</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="reqHoPat" checked={formData.reqHoPat} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Require HO PAT</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="reqSltsPat" checked={formData.reqSltsPat} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Require SLTS PAT</span>
                </label>
              </div>
            </div>

            {/* Audit & Ledger Section */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">Audit & Ledger Rules</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="writeAuditLedger" checked={formData.writeAuditLedger} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Write Immutable Audit Ledger</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200">
                  <input type="checkbox" name="generateIssueNote" checked={formData.generateIssueNote} onChange={handleChange} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Enforce Issue Note / MRN Display</span>
                </label>
              </div>
              <div className="mt-3 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>If financial or quasi-financial (stock), ensure the &apos;Write Immutable Audit Ledger&apos; is checked.</p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg border border-slate-200">
              <input type="checkbox" name="isEnabled" checked={formData.isEnabled} onChange={handleChange} className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
              <span className="text-sm font-medium text-slate-800">Policy is Active (Enabled)</span>
            </label>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="gate-form" 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </div>
    </div>
  );
}
