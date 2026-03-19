"use client";

import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Search, ShieldCheck, Landmark, CreditCard, Zap } from "lucide-react";

interface Step3BankInfoProps {
    banks: { id: string; name: string }[];
    branches: { id: string; name: string }[];
    onUpload: (file: File, fieldName: string) => Promise<string | null>;
    uploadProgress: Record<string, number>;
}

export function Step3BankInfo({ banks, branches, onUpload, uploadProgress }: Step3BankInfoProps) {
    const { control, watch, setValue } = useFormContext<PublicRegistrationSchema>();
    const [manualBank, setManualBank] = useState(false);
    const [branchSearch, setBranchSearch] = useState(watch("bankBranch") || "");
    const [isSearching, setIsSearching] = useState(false);

    const filteredBranches = branches.filter(b => 
        b.name.toLowerCase().includes(branchSearch.toLowerCase())
    );

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Elite Sub-Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-8 border-b border-white/10 group">
                <div className="p-4 bg-blue-600/20 text-blue-400 rounded-3xl border border-blue-500/20 shadow-2xl transition-all group-hover:scale-110">
                    <Building2 className="w-8 h-8" />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Landmark className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Financial Trust Architecture</span>
                    </div>
                    <h3 className="text-3xl font-black text-white tracking-tight">Financial Information</h3>
                    <p className="text-base text-slate-400 font-semibold leading-relaxed">Register your corporate bank details for automated payment synchronization</p>
                </div>
            </div>

            {/* Financial Credentials Dynamic Hub */}
            <div className="relative group">
                <div className="absolute inset-x-0 inset-y-0 bg-blue-600/5 blur-3xl rounded-[32px] pointer-events-none" />
                <div className="relative bg-white/[0.03] backdrop-blur-3xl p-8 sm:p-12 rounded-[48px] border border-white/10 space-y-12 shadow-2xl ring-1 ring-white/5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Bank Selection */}
                        <div className="space-y-4">
                            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">Corporate Financial Institution</label>
                            {!manualBank ? (
                                <Select 
                                    onValueChange={(v) => setValue("bankName", v)} 
                                    value={watch("bankName") || ""}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-14 text-sm font-bold text-white bg-white/[0.03] border-white/10 rounded-2xl focus:ring-blue-500/20 focus:border-blue-500/50 transition-all shadow-inner">
                                            <SelectValue placeholder="Select Bank" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-3xl">
                                        {banks.map(b => (
                                            <SelectItem key={b.id} value={b.name} className="py-3 text-white font-bold focus:bg-blue-600/20 focus:text-blue-400">
                                                {b.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input 
                                    {...control.register("bankName")} 
                                    className="h-14 text-sm font-bold text-white bg-white/[0.03] border-white/10 rounded-2xl shadow-inner focus:ring-blue-500/20"
                                    placeholder="Specify institution name" 
                                />
                            )}
                            <div className="flex items-center gap-3 mt-3 ml-2">
                                <Checkbox 
                                    id="manualBank" 
                                    checked={manualBank} 
                                    onCheckedChange={(checked) => setManualBank(!!checked)}
                                    className="border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-400"
                                />
                                <label htmlFor="manualBank" className="text-[10px] font-black text-slate-500 cursor-pointer uppercase tracking-[0.2em] hover:text-blue-400 transition-colors">Alternative Entry (Manual)</label>
                            </div>
                        </div>

                        {/* Branch Selection */}
                        <div className="space-y-4 relative">
                            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">Branch Registry Location</label>
                            <div className="relative group/search">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within/search:text-blue-500 transition-colors" />
                                <Input 
                                    placeholder="Search location parameters..." 
                                    value={branchSearch}
                                    onChange={(e) => setBranchSearch(e.target.value)}
                                    onFocus={() => setIsSearching(true)}
                                    className="h-14 pl-14 text-sm font-bold text-white bg-white/[0.03] border-white/10 rounded-2xl focus:ring-blue-500/20 focus:border-blue-500/50 transition-all shadow-inner placeholder:text-slate-700"
                                />
                                
                                {isSearching && filteredBranches.length > 0 && (
                                    <ul className="absolute z-[100] mt-4 w-full bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300 ring-1 ring-white/10">
                                        {filteredBranches.map((b) => (
                                            <li 
                                                key={b.id}
                                                onClick={() => {
                                                    setValue("bankBranch", b.name);
                                                    setBranchSearch(b.name);
                                                    setIsSearching(false);
                                                }}
                                                className="px-8 py-5 text-sm font-bold text-white border-b border-white/5 last:border-0 hover:bg-blue-600/20 hover:text-blue-400 cursor-pointer transition-all flex items-center justify-between group/item"
                                            >
                                                {b.name}
                                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Account Number Field */}
                    <div className="pt-6 relative">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-6 py-1 bg-blue-600 text-white rounded-full text-[9px] font-black uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(37,99,235,0.4)] z-20">
                            Verified Account Entry
                        </div>
                        <FormField
                            control={control}
                            name="bankAccountNumber"
                            render={({ field }) => (
                                <FormItem className="space-y-6">
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            className="h-24 text-4xl font-black tracking-[0.5em] text-white bg-slate-950/50 border-white/10 rounded-[32px] focus:border-blue-500/50 focus:ring-blue-500/10 transition-all text-center placeholder:text-slate-800 shadow-inner"
                                            placeholder="0000000000"
                                        />
                                    </FormControl>
                                    <div className="flex items-center justify-center gap-2 px-2 text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
                                        <CreditCard className="w-3.5 h-3.5" /> Synchronize exactly with your passbook details
                                    </div>
                                    <FormMessage className="text-[10px] font-bold text-rose-400 text-center" />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Premium Document Matrix */}
            <div className="space-y-10">
                <div className="flex items-center gap-3 px-2">
                    <div className="h-4 w-1 bg-blue-600 rounded-full" />
                    <h4 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Financial Documentation (Audit Ready)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <FileUploadField
                        label="Account Passbook Specimen"
                        description="Front page with identity & account data"
                        fieldName="bankPassbookUrl"
                        value={watch("bankPassbookUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.bankPassbookUrl}
                        required
                    />

                    <FileUploadField
                        label="Operational Slip Specimen"
                        description="Attach the latest transaction validation"
                        fieldName="registrationFeeSlipUrl"
                        value={watch("registrationFeeSlipUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.registrationFeeSlipUrl}
                        required
                        allowCamera={false}
                    />
                </div>
            </div>

            {/* Financial Verification Professional Banner */}
            <div className="p-8 bg-blue-600/10 rounded-[32px] text-white border border-blue-500/20 flex flex-col lg:flex-row lg:items-center gap-8 animate-in slide-in-from-bottom-4 duration-1000 mt-6 shadow-2xl">
                <div className="p-4 bg-blue-500/20 rounded-2xl h-fit border border-blue-400/20 shadow-xl">
                    <ShieldCheck className="w-8 h-8 text-blue-400" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-blue-500" />
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-400">Financial Integrity Audit</p>
                    </div>
                    <p className="text-[13px] text-blue-100/70 leading-relaxed font-semibold">
                        Automated payment synchronization is enabled. Ensure the <strong className="text-white underline decoration-blue-500">Account Holder Identity</strong> matches your registered legal name exactly.
                    </p>
                </div>
            </div>
        </div>
    );
}
