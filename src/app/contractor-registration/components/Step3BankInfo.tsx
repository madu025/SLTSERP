"use client";

import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { Banknote, Building2, CreditCard, Search, ArrowRight } from "lucide-react";

interface Bank { id: string; name: string }
interface Branch { id: string; name: string; bankId?: string }

interface Step3BankInfoProps {
    banks: Bank[];
    branches: Branch[];
    onUpload: (file: File, fieldName: string) => Promise<string | null>;
    uploadProgress: Record<string, number>;
}

export function Step3BankInfo({ banks, branches, onUpload, uploadProgress }: Step3BankInfoProps) {
    const { control, watch, setValue } = useFormContext<PublicRegistrationSchema>();
    const [branchSearch, setBranchSearch] = useState("");
    const [showBranches, setShowBranches] = useState(false);
    const [manualBank, setManualBank] = useState(false);

    const filteredBranches = branches.filter(b => 
        b.name.toLowerCase().includes(branchSearch.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
                <div className="p-3 bg-blue-100/50 rounded-2xl text-blue-600 w-fit">
                    <Banknote className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Financial Registration</h3>
                    <p className="text-sm text-slate-500">Provide bank details and payment evidence for account verification</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                {/* Left Column: Bank Selection */}
                <div className="lg:col-span-7 space-y-8">
                    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                        <div>
                            <h4 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-6 flex items-center gap-2">
                                <Building2 className="w-4 h-4" /> Bank Account Details
                            </h4>
                            
                            <div className="grid grid-cols-1 gap-8">
                                <FormField
                                    control={control}
                                    name="bankName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">Corporate Bank</FormLabel>
                                            {!manualBank ? (
                                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100">
                                                            <SelectValue placeholder="Select your bank" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-slate-200">
                                                        {banks.map(b => (
                                                            <SelectItem key={b.id} value={b.name} className="py-3">{b.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <FormControl>
                                                    <Input {...field} className="h-12 text-sm bg-slate-50 border-slate-200 rounded-xl" placeholder="Enter bank name manually" />
                                                </FormControl>
                                            )}
                                            <FormMessage className="text-[10px]" />
                                            <div className="flex items-center space-x-2 pt-2 ml-1">
                                                <Checkbox id="manualBank" checked={manualBank} onCheckedChange={(c) => setManualBank(!!c)} className="rounded border-slate-300" />
                                                <label htmlFor="manualBank" className="text-[10px] font-bold text-slate-400 cursor-pointer hover:text-blue-500 transition-colors">Bank not listed? Enter manually</label>
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={control}
                                    name="bankBranch"
                                    render={({ field }) => (
                                        <FormItem className="relative">
                                            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">Branch Name</FormLabel>
                                            <div className="relative group">
                                                <FormControl>
                                                    <Input 
                                                        {...field} 
                                                        value={field.value || branchSearch}
                                                        onChange={(e) => {
                                                            setBranchSearch(e.target.value);
                                                            field.onChange(e.target.value);
                                                            setShowBranches(true);
                                                        }}
                                                        onFocus={() => setShowBranches(true)}
                                                        className="h-12 text-sm pr-10 bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100" 
                                                        placeholder="Search or enter branch" 
                                                    />
                                                </FormControl>
                                                <Search className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                            </div>

                                            {showBranches && branchSearch.length > 1 && filteredBranches.length > 0 && (
                                                <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-[250px] overflow-auto animate-in fade-in slide-in-from-top-2 border-t-0 ring-4 ring-blue-50/50">
                                                    {filteredBranches.map(b => (
                                                        <div 
                                                            key={b.id} 
                                                            className="px-5 py-4 text-[13px] font-medium text-slate-700 hover:bg-blue-50 cursor-pointer flex items-center justify-between group border-b border-slate-50 last:border-0"
                                                            onClick={() => {
                                                                setValue("bankBranch", b.name);
                                                                setBranchSearch(b.name);
                                                                setShowBranches(false);
                                                            }}
                                                        >
                                                            <span>{b.name}</span>
                                                            <ArrowRight className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    <FileUploadField
                        label="Registration Fee Slip"
                        description="Attach the final bank/payment slip"
                        fieldName="registrationFeeSlipUrl"
                        value={watch("registrationFeeSlipUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.registrationFeeSlipUrl}
                        required
                        allowCamera={false}
                    />
                </div>

                {/* Right Column: Evidence & Results */}
                <div className="lg:col-span-5 space-y-8">
                    <div className="bg-blue-50/50 p-6 sm:p-8 rounded-3xl border border-blue-100/50 space-y-8 shadow-sm h-full">
                        <FileUploadField
                            label="Bank Passbook Front"
                            description="Front page showing account info"
                            fieldName="bankPassbookUrl"
                            value={watch("bankPassbookUrl")}
                            onUpload={onUpload}
                            progress={uploadProgress.bankPassbookUrl}
                            required
                        />

                        <FormField
                            control={control}
                            name="bankAccountNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2 pt-2">
                                        Detected Account Number <CreditCard className="w-4 h-4" />
                                    </FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-14 text-xl font-black tracking-[0.2em] bg-white border-blue-200 focus:ring-blue-100 shadow-sm rounded-2xl placeholder:opacity-20" placeholder="0000 0000 0000" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                    <p className="text-[10px] text-blue-500 font-bold italic ml-1 mt-2">This is extracted from your passbook upload.</p>
                                </FormItem>
                            )}
                        />
                        
                        <div className="p-5 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-200/50 flex gap-4">
                            <div className="p-2.5 bg-white/20 rounded-xl h-fit">
                                <Building2 className="w-5 h-5 text-white" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Official Notice</p>
                                <p className="text-[11px] text-blue-50 leading-relaxed font-medium">
                                    All contract payments will be released strictly to the verified account provided above.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
