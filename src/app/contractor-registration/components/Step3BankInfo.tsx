"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { Landmark, Building, CreditCard } from "lucide-react";

interface Step3Props {
    handleUpload: (file: File, fieldName: string) => Promise<string | null>;
    uploadProgress: Record<string, number>;
    staticData: { 
        banks: { id: string; name: string }[], 
        branches: { id: string; name: string }[] 
    };
}

export function Step3BankInfo({ handleUpload, staticData }: Step3Props) {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Simple Step Header */}
            <div className="pb-6 border-b border-slate-200">
                <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">
                    Step 3 of 5
                </h2>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    Bank Information
                </h1>
                <p className="text-sm text-slate-900 mt-2 font-bold opacity-80">
                    Provide bank details for payments and settlements.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Bank Name */}
                <FormField
                    control={control}
                    name="bankName"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                Bank Name *
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                <FormControl>
                                    <SelectTrigger className="h-14 px-5 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-900 focus:border-blue-600 focus:ring-0">
                                        <SelectValue placeholder="Select Bank" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                    {staticData.banks.map(bank => (
                                        <SelectItem key={bank.id} value={bank.name} className="font-bold py-3">
                                            {bank.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />

                {/* Account Number */}
                <FormField
                    control={control}
                    name="bankAccountNumber"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                Account Number *
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input 
                                        {...field} 
                                        placeholder="Enter account number" 
                                        className="h-14 px-5 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm" 
                                    />
                                    <CreditCard className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />

                {/* Branch */}
                <FormField
                    control={control}
                    name="bankBranch"
                    render={({ field }) => (
                        <FormItem className="space-y-2 md:col-span-2">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                Bank Branch *
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                <FormControl>
                                    <SelectTrigger className="h-14 px-5 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-900 focus:border-blue-600 focus:ring-0">
                                        <SelectValue placeholder="Select Branch" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl border-slate-200 shadow-xl h-80 overflow-y-auto">
                                    {staticData.branches.map(branch => (
                                        <SelectItem key={branch.id} value={branch.name} className="font-bold py-3">
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />
            </div>

            <div className="pt-8 space-y-8 border-t border-slate-200">
                <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-wider">Required Bank Documents</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FileUploadField
                        label="Passbook Photo"
                        description="Account details page"
                        fieldName="bankPassbookUrl"
                        onUpload={handleUpload}
                    />
                    <FileUploadField
                        label="Payment Receipt"
                        description="Onboarding payment slip"
                        fieldName="registrationFeeSlipUrl"
                        onUpload={handleUpload}
                    />
                    <FileUploadField
                        label="GN Certificate"
                        description="Official GN certificate"
                        fieldName="gramaCertUrl"
                        onUpload={handleUpload}
                    />
                </div>
            </div>
        </div>
    );
}
