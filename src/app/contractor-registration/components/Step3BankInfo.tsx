"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { Banknote, Building, CreditCard, ShieldCheck, Landmark } from "lucide-react";

interface Step3Props {
    handleUpload: (file: File, fieldName: string) => Promise<string | null>;
    uploadProgress: Record<string, number>;
    staticData: { 
        banks: { id: string; name: string }[], 
        branches: { id: string; name: string }[] 
    };
}

export function Step3BankInfo({ handleUpload, uploadProgress, staticData }: Step3Props) {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Professional Step Header */}
            <div className="pb-8 border-b border-slate-200 mb-8">
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                    <Banknote className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Module Stage 03 | Financial Trust Synchronization</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Settlement Data Profile</h3>
                <p className="text-sm text-slate-900 max-w-2xl mt-2 leading-relaxed font-bold opacity-90">
                    Provide the official financial settlement details for your enterprise. All settlements will be synchronized with these credentials 
                    following a mandatory registry audit and physical specimen verification.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                {/* Bank Name Selection */}
                <FormField
                    control={control}
                    name="bankName"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Building className="w-3.5 h-3.5 text-blue-500" /> Authorized Financial Institution <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                <FormControl>
                                    <SelectTrigger className="h-14 px-6 rounded-xl border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-100 font-bold text-slate-900">
                                        <SelectValue placeholder="Select Registered Bank" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl border-slate-200 shadow-2xl">
                                    {staticData.banks.map(bank => (
                                        <SelectItem key={bank.id} value={bank.name} className="font-bold py-3">
                                            {bank.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                        </FormItem>
                    )}
                />

                {/* Account Number */}
                <FormField
                    control={control}
                    name="bankAccountNumber"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <CreditCard className="w-3.5 h-3.5 text-blue-500" /> Verified Account Terminus <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="group relative transition-all">
                                    <Input 
                                        {...field} 
                                        placeholder="Enter Bank Account Number" 
                                        className="h-14 px-6 rounded-xl border-slate-200 bg-white shadow-sm transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-bold placeholder:text-slate-300 tracking-widest" 
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-blue-500 transition-colors">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                </div>
                            </FormControl>
                            <FormDescription className="text-[9px] font-bold text-slate-900 uppercase tracking-widest px-1 opacity-70">Verify digits for automated payroll synchronization</FormDescription>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600 px-1" />
                        </FormItem>
                    )}
                />

                {/* Bank Branch Selection */}
                <FormField
                    control={control}
                    name="bankBranch"
                    render={({ field }) => (
                        <FormItem className="space-y-4 md:col-span-2">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Landmark className="w-3.5 h-3.5 text-blue-500" /> Operational Branch Office <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                <FormControl>
                                    <SelectTrigger className="h-14 px-6 rounded-xl border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-100 font-bold text-slate-900">
                                        <SelectValue placeholder="Select Account Branch" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl border-slate-200 shadow-2xl h-80 overflow-y-auto">
                                    {staticData.branches.map(branch => (
                                        <SelectItem key={branch.id} value={branch.name} className="font-bold py-3">
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                        </FormItem>
                    )}
                />
            </div>

            <div className="pt-12 space-y-10 border-t border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-[0.2em]">Financial Documentation Audit Specimens</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <FileUploadField
                        label="Bank Passbook / Statement"
                        description="Front page showing Name and Account Details"
                        fieldName="bankPassbookUrl"
                        onUpload={handleUpload}
                        progress={uploadProgress.bankPassbookUrl}
                        required
                    />
                    <FileUploadField
                        label="Registration Operational Fee"
                        description="Official SLT Onboarding Payment Receipt"
                        fieldName="registrationFeeSlipUrl"
                        onUpload={handleUpload}
                        progress={uploadProgress.registrationFeeSlipUrl}
                        required
                    />
                    <FileUploadField
                        label="Grama Niladhari Registry"
                        description="Official Residency Certificate (Original Copy)"
                        fieldName="gramaCertUrl"
                        onUpload={handleUpload}
                        progress={uploadProgress.gramaCertUrl}
                        required
                    />
                </div>
            </div>
        </div>
    );
}
