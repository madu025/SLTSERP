'use client';

import { useState } from 'react';
import { 
  X, 
  Save, 
  ShieldAlert, 
  ShieldCheck, 
  Camera, 
  MapPin, 
  FileCheck, 
  FileText, 
  Receipt, 
  Layers,
  Sparkles,
  Zap,
  Sliders,
  DollarSign,
  Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { ProcessGatePolicy } from '@prisma/client';
import { MODULE_STATUS_REGISTRY } from '@/config/process-gate-statuses';

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
  const [drawerMode, setDrawerMode] = useState<'simple' | 'full'>('full');
  const [customFromStatus, setCustomFromStatus] = useState(false);
  const [customToStatus, setCustomToStatus] = useState(false);

  const [formData, setFormData] = useState({
    entityType: gate?.entityType || 'MATERIAL_REQUEST',
    fromStatus: gate?.fromStatus || 'DRAFT',
    toStatus: gate?.toStatus || 'PENDING',
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

  const availableStatuses = MODULE_STATUS_REGISTRY[formData.entityType] || [
    { value: 'PENDING', label: 'PENDING' },
    { value: 'COMPLETED', label: 'COMPLETED' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    
    // Reset from/to status dropdown defaults if entityType changes
    if (target.name === 'entityType') {
      const newStatuses = MODULE_STATUS_REGISTRY[target.value] || [];
      setFormData(prev => ({
        ...prev,
        entityType: target.value,
        fromStatus: newStatuses[0]?.value || 'PENDING',
        toStatus: newStatuses[1]?.value || 'COMPLETED',
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [target.name]: value }));
  };

  const handleToggle = (name: string, value: boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
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

      toast.success(gate ? 'Gate policy updated successfully' : 'Gate policy created successfully');
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-right duration-300">
          
          {/* Drawer Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-md relative overflow-hidden shrink-0">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Process Gate Policy Configurator
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                {isEditMode ? `Edit Gate Policy` : 'Create New Process Gate'}
              </h2>
            </div>
            <button 
              onClick={onClose} 
              className="relative z-10 text-slate-300 hover:text-white rounded-xl p-2 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Mode Switcher (Simple vs Full Option) */}
          <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Config Mode:
            </span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setDrawerMode('simple')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  drawerMode === 'simple'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Simple Mode
              </button>
              <button
                type="button"
                onClick={() => setDrawerMode('full')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  drawerMode === 'full'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Full Enterprise Option
              </button>
            </div>
          </div>

          {/* Drawer Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <form id="gate-form" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Section 1: Target Entity & Transition Route */}
              <div className="space-y-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    1. Entity & Transition Route
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Strict Dropdowns (No Typos)
                  </span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Entity / Module</label>
                    <select
                      name="entityType"
                      value={formData.entityType}
                      onChange={handleChange}
                      disabled={isEditMode}
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-100"
                    >
                      <option value="MATERIAL_REQUEST">MATERIAL_REQUEST (Stores & Inventory)</option>
                      <option value="SERVICE_ORDER">SERVICE_ORDER (SOD Field Service)</option>
                      <option value="INVOICE">INVOICE (Client & Contractor Invoices)</option>
                      <option value="PROJECT_TASK">PROJECT_TASK (Project Execution)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Policy Description / Label</label>
                    <input
                      type="text"
                      name="label"
                      value={formData.label}
                      onChange={handleChange}
                      placeholder="e.g. MRN Stores Manager Final Approval"
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  {/* Predefined Dropdowns for Statuses */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">From Status (Current)</label>
                        <button
                          type="button"
                          onClick={() => setCustomFromStatus(!customFromStatus)}
                          className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-0.5"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          {customFromStatus ? 'Select' : 'Custom'}
                        </button>
                      </div>
                      {customFromStatus ? (
                        <input
                          type="text"
                          name="fromStatus"
                          value={formData.fromStatus}
                          onChange={handleChange}
                          placeholder="e.g. CUSTOM_STATUS"
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-amber-800 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        />
                      ) : (
                        <select
                          name="fromStatus"
                          value={formData.fromStatus}
                          onChange={handleChange}
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-amber-800 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        >
                          {availableStatuses.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">To Status (Target)</label>
                        <button
                          type="button"
                          onClick={() => setCustomToStatus(!customToStatus)}
                          className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-0.5"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          {customToStatus ? 'Select' : 'Custom'}
                        </button>
                      </div>
                      {customToStatus ? (
                        <input
                          type="text"
                          name="toStatus"
                          value={formData.toStatus}
                          onChange={handleChange}
                          placeholder="e.g. CUSTOM_TARGET"
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        />
                      ) : (
                        <select
                          name="toStatus"
                          value={formData.toStatus}
                          onChange={handleChange}
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        >
                          {availableStatuses.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 2: Domain-Isolated Verifications (Full Option Mode Only) */}
              {drawerMode === 'full' && (
                <>
                  {/* MATERIAL_REQUEST Domain Options */}
                  {formData.entityType === 'MATERIAL_REQUEST' && (
                    <div className="space-y-3 bg-cyan-50/50 p-5 rounded-2xl border border-cyan-200/80 shadow-xs">
                      <h3 className="text-xs font-extrabold text-cyan-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-cyan-600" />
                        2. Stores & Material Request Specific Rules
                      </h3>

                      <div className="grid grid-cols-1 gap-2.5">
                        {/* Store Issue Note (MIN) */}
                        <div 
                          onClick={() => handleToggle('generateIssueNote', !formData.generateIssueNote)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.generateIssueNote ? 'bg-cyan-100/90 border-cyan-400 text-cyan-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.generateIssueNote ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Enforce Store Issue Note Number (MIN)</div>
                              <div className="text-[10px] text-slate-500">Require MIN Ref (e.g. MIN-2026-07-0012) display on stores UI</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="generateIssueNote"
                            checked={formData.generateIssueNote}
                            onChange={handleChange}
                            className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                          />
                        </div>

                        {/* Audit Ledger */}
                        <div 
                          onClick={() => handleToggle('writeAuditLedger', !formData.writeAuditLedger)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.writeAuditLedger ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.writeAuditLedger ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Write Cryptographic Stock Audit Ledger (SHA-256)</div>
                              <div className="text-[10px] text-slate-500">Immutable ledger log for custody transfers</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="writeAuditLedger"
                            checked={formData.writeAuditLedger}
                            onChange={handleChange}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SERVICE_ORDER Domain Options */}
                  {formData.entityType === 'SERVICE_ORDER' && (
                    <div className="space-y-3 bg-purple-50/50 p-5 rounded-2xl border border-purple-200/80 shadow-xs">
                      <h3 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-purple-600" />
                        2. Field Service Order (SOD) Proof Controls
                      </h3>

                      <div className="grid grid-cols-1 gap-2.5">
                        {/* Photo Proof */}
                        <div 
                          onClick={() => handleToggle('reqPhotoProof', !formData.reqPhotoProof)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.reqPhotoProof ? 'bg-blue-100/90 border-blue-400 text-blue-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.reqPhotoProof ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <Camera className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Require Field Site Photo Proof</div>
                              <div className="text-[10px] text-slate-500">Contractor must upload work execution photos</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="reqPhotoProof"
                            checked={formData.reqPhotoProof}
                            onChange={handleChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </div>

                        {/* GPS Location */}
                        <div 
                          onClick={() => handleToggle('reqGpsLocation', !formData.reqGpsLocation)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.reqGpsLocation ? 'bg-indigo-100/90 border-indigo-400 text-indigo-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.reqGpsLocation ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Require Field Geolocation Capture (GPS)</div>
                              <div className="text-[10px] text-slate-500">Capture exact latitude/longitude coordinates</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="reqGpsLocation"
                            checked={formData.reqGpsLocation}
                            onChange={handleChange}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                        </div>

                        {/* SLTS PAT */}
                        <div 
                          onClick={() => handleToggle('reqSltsPat', !formData.reqSltsPat)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.reqSltsPat ? 'bg-purple-100/90 border-purple-400 text-purple-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.reqSltsPat ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <FileCheck className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Require SLTS Acceptance Test (PAT) Signoff</div>
                              <div className="text-[10px] text-slate-500">Provisional Acceptance Test signoff required</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="reqSltsPat"
                            checked={formData.reqSltsPat}
                            onChange={handleChange}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                        </div>

                        {/* OPMC PAT */}
                        <div 
                          onClick={() => handleToggle('reqOpmcPat', !formData.reqOpmcPat)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.reqOpmcPat ? 'bg-fuchsia-100/90 border-fuchsia-400 text-fuchsia-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.reqOpmcPat ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <FileCheck className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Require OPMC Regional Acceptance</div>
                              <div className="text-[10px] text-slate-500">Regional OPMC office approval required</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="reqOpmcPat"
                            checked={formData.reqOpmcPat}
                            onChange={handleChange}
                            className="w-4 h-4 text-fuchsia-600 rounded focus:ring-fuchsia-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* INVOICE Domain Options */}
                  {formData.entityType === 'INVOICE' && (
                    <div className="space-y-3 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
                      <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        2. Invoice & Financial Compliance Controls
                      </h3>

                      <div className="grid grid-cols-1 gap-2.5">
                        {/* Audit Ledger */}
                        <div 
                          onClick={() => handleToggle('writeAuditLedger', !formData.writeAuditLedger)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.writeAuditLedger ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.writeAuditLedger ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Require Financial Audit Ledger Write</div>
                              <div className="text-[10px] text-slate-500">Cryptographic audit log for billing/payout compliance</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="writeAuditLedger"
                            checked={formData.writeAuditLedger}
                            onChange={handleChange}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                        </div>

                        {/* Document Upload */}
                        <div 
                          onClick={() => handleToggle('reqDocUpload', !formData.reqDocUpload)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formData.reqDocUpload ? 'bg-orange-100/90 border-orange-400 text-orange-950 shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.reqDocUpload ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold">Require Tax Invoice PDF Attachment</div>
                              <div className="text-[10px] text-slate-500">Contractor original invoice attachment required</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="reqDocUpload"
                            checked={formData.reqDocUpload}
                            onChange={handleChange}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Section 4: Enable / Active Toggle */}
              <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Policy Activation Status</div>
                  <div className="text-[10px] text-slate-500">Enable or temporarily suspend this gate policy</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="isEnabled"
                    checked={formData.isEnabled}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

            </form>
          </div>

          {/* Sticky Drawer Footer */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="gate-form"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? (
                <>Saving Policy...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditMode ? 'Update Gate Policy' : 'Create Gate Policy'}
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
