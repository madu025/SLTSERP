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
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <div className="p-2 bg-blue-100/50 rounded-lg text-blue-600">
                    <Banknote className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Financial Setup</h3>
                    <p className="text-xs text-slate-500">Provide your official payment and registration fee details</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-6">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                        <FormField
                            control={control}
                            name="bankName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Corporate Bank</FormLabel>
                                    {!manualBank ? (
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 bg-white border-slate-200">
                                                    <SelectValue placeholder="Select your bank" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {banks.map(b => (
                                                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <FormControl>
                                            <Input {...field} className="h-11 text-sm bg-white border-slate-200" placeholder="Enter bank name manually" />
                                        </FormControl>
                                    )}
                                    <FormMessage className="text-[10px]" />
                                    <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox id="manualBank" checked={manualBank} onCheckedChange={(c) => setManualBank(!!c)} />
                                        <label htmlFor="manualBank" className="text-[10px] font-medium text-slate-500 cursor-pointer">Bank not listed? Enter manually</label>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="bankBranch"
                            render={({ field }) => (
                                <FormItem className="relative">
                                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Branch Name</FormLabel>
                                    <div className="relative">
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
                                                className="h-11 text-sm pr-10 bg-white border-slate-200" 
                                                placeholder="Search or enter branch" 
                                            />
                                        </FormControl>
                                        <Search className="absolute right-3 top-3 w-4.5 h-4.5 text-slate-400" />
                                    </div>

                                    {showBranches && branchSearch.length > 1 && filteredBranches.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-[200px] overflow-auto animate-in fade-in slide-in-from-top-2">
                                            {filteredBranches.map(b => (
                                                <div 
                                                    key={b.id} 
                                                    className="px-4 py-2 text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between group border-b last:border-0"
                                                    onClick={() => {
                                                        setValue("bankBranch", b.name);
                                                        setBranchSearch(b.name);
                                                        setShowBranches(false);
                                                    }}
                                                >
                                                    <span>{b.name}</span>
                                                    <ArrowRight className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FileUploadField
                        label="Registration Fee Slip"
                        description="Attach the processed bank/payment slip"
                        fieldName="registrationFeeSlipUrl"
                        value={watch("registrationFeeSlipUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.registrationFeeSlipUrl}
                        required
                    />
                </div>

                <div className="space-y-6">
                    <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100/50 space-y-6">
                        <FileUploadField
                            label="Bank Passbook / Statement"
                            description="Upload front page to verify account"
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
                                    <FormLabel className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5 pt-2">
                                        Detected Account Number <CreditCard className="w-3.5 h-3.5" />
                                    </FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-12 text-lg font-black tracking-widest bg-white border-blue-200 focus:ring-blue-100 shadow-sm rounded-xl" placeholder="Check results here..." />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                    <p className="text-[10px] text-blue-500/70 italic font-medium">This field is automatically filled after upload.</p>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-white flex gap-4 mt-6">
                <div className="p-3 bg-blue-500/20 rounded-full h-fit mt-1">
                    <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-400">Payment Notice</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Your payments will be processed to the account specified above. Please double-check the account number and branch. Payment slips must be clearly legible for approval.
                    </p>
                </div>
            </div>
        </div>
    );
}
