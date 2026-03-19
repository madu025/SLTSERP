"use client";

import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Search, ShieldCheck } from "lucide-react";

const banks = [
    { id: "1", name: "Bank of Ceylon" },
    { id: "2", name: "Commercial Bank of Ceylon PLC" },
    { id: "3", name: "Hatton National Bank PLC" },
    { id: "4", name: "Sampath Bank PLC" },
    { id: "5", name: "Seylan Bank PLC" },
    { id: "6", name: "People's Bank" },
];

const branches = [
    { id: "1", name: "Anuradhapura" },
    { id: "2", name: "Colombo Fort" },
    { id: "3", name: "Kandy" },
    { id: "4", name: "Matara" },
    { id: "5", name: "Galle" },
    { id: "6", name: "Jaffna" },
    { id: "7", name: "Kurunegala" },
    { id: "8", name: "Ratnapura" },
];

interface Step3BankInfoProps {
    onUpload: (file: File, fieldName: string) => Promise<string | null>;
    uploadProgress: Record<string, number>;
}

export function Step3BankInfo({ onUpload, uploadProgress }: Step3BankInfoProps) {
    const { control, watch, setValue } = useFormContext<PublicRegistrationSchema>();
    const [manualBank, setManualBank] = useState(false);
    const [branchSearch, setBranchSearch] = useState(watch("bankBranch") || "");
    const [isSearching, setIsSearching] = useState(false);

    const filteredBranches = branches.filter(b => 
        b.name.toLowerCase().includes(branchSearch.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
                <div className="p-3 bg-blue-100/50 rounded-2xl text-blue-600 w-fit">
                    <Building2 className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Financial Information</h3>
                    <p className="text-sm text-slate-500">Register your corporate bank details for payment processing</p>
                </div>
            </div>

            {/* Financial Details Card */}
            <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Bank Selection */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 ml-1">Corporate Bank</label>
                        {!manualBank ? (
                            <Select 
                                onValueChange={(v) => setValue("bankName", v)} 
                                value={watch("bankName") || ""}
                            >
                                <FormControl>
                                    <SelectTrigger className="h-14 text-sm font-bold text-slate-900 bg-slate-50 border-slate-200 rounded-2xl focus:ring-blue-100 focus:border-blue-400 transition-all shadow-inner">
                                        <SelectValue placeholder="Select Financial Institution" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-white border-2 border-slate-200 rounded-2xl shadow-2xl">
                                    {banks.map(b => (
                                        <SelectItem key={b.id} value={b.name} className="py-3 text-slate-900 font-bold focus:bg-blue-50">
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input 
                                {...control.register("bankName")} 
                                className="h-14 text-sm font-bold text-slate-900 bg-slate-50 border-slate-200 rounded-2xl shadow-inner"
                                placeholder="Enter Bank Name manually" 
                            />
                        )}
                        <div className="flex items-center gap-2 mt-2 ml-1">
                            <Checkbox 
                                id="manualBank" 
                                checked={manualBank} 
                                onCheckedChange={(checked) => setManualBank(!!checked)}
                                className="border-slate-300 data-[state=checked]:bg-blue-600"
                            />
                            <label htmlFor="manualBank" className="text-[10px] font-bold text-slate-500 cursor-pointer uppercase tracking-wider">Bank not listed? Enter manually</label>
                        </div>
                    </div>

                    {/* Branch Selection */}
                    <div className="space-y-3 relative">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 ml-1">Branch Name</label>
                        <div className="relative group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/search:text-blue-500 transition-colors" />
                            <Input 
                                placeholder="Search branch location..." 
                                value={branchSearch}
                                onChange={(e) => setBranchSearch(e.target.value)}
                                onFocus={() => setIsSearching(true)}
                                className="h-14 pl-12 text-sm font-bold text-slate-900 bg-slate-50 border-slate-200 rounded-2xl focus:ring-blue-100 focus:border-blue-400 transition-all shadow-inner"
                            />
                            
                            {isSearching && filteredBranches.length > 0 && (
                                <ul className="absolute z-[100] mt-3 w-full bg-white border-2 border-slate-200 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300">
                                    {filteredBranches.map((b) => (
                                        <li 
                                            key={b.id}
                                            onClick={() => {
                                                setValue("bankBranch", b.name);
                                                setBranchSearch(b.name);
                                                setIsSearching(false);
                                            }}
                                            className="px-6 py-4 text-sm font-black text-slate-900 border-b border-slate-50 last:border-0 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-all flex items-center justify-between group"
                                        >
                                            {b.name}
                                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                <div className="pt-2">
                    <FormField
                        control={control}
                        name="bankAccountNumber"
                        render={({ field }) => (
                            <FormItem className="space-y-4">
                                <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 block ml-1 text-center">
                                    Official Bank Account Number
                                </FormLabel>
                                <FormControl>
                                    <Input 
                                        {...field} 
                                        className="h-20 text-3xl font-black tracking-[0.2em] text-slate-900 bg-slate-50/50 border-2 border-slate-100 rounded-3xl focus:border-blue-400 focus:ring-0 transition-all text-center placeholder:text-slate-200 shadow-inner"
                                        placeholder="0000000000"
                                    />
                                </FormControl>
                                <FormMessage className="text-[10px] text-center" />
                            </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Document Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <FileUploadField
                    label="Bank Passbook / Statement"
                    description="Upload front page with name & A/C details"
                    fieldName="bankPassbookUrl"
                    value={watch("bankPassbookUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.bankPassbookUrl}
                    required
                />

                <FileUploadField
                    label="Registration Fee Slip"
                    description="Attach the processed bank/payment slip"
                    fieldName="registrationFeeSlipUrl"
                    value={watch("registrationFeeSlipUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.registrationFeeSlipUrl}
                    required
                    allowCamera={false}
                />
            </div>

            {/* Verification Notice */}
            <div className="p-6 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-200/50 flex gap-6 mt-6 animate-in slide-in-from-bottom-2 duration-700">
                <div className="p-3 bg-white/20 rounded-2xl h-fit shadow-inner">
                    <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100">Financial Verification</p>
                    <p className="text-[11px] text-blue-50 leading-relaxed font-semibold">
                        Your account will be verified for automated payment processing. Please ensure the <strong>Account Holder Name</strong> matches your registration name.
                    </p>
                </div>
            </div>
        </div>
    );
}
