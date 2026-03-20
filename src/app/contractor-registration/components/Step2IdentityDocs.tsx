"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { ShieldCheck } from "lucide-react";

interface Step2Props {
    handleUpload: (file: File, fieldName: string) => Promise<string | null>;
}

export function Step2IdentityDocs({ handleUpload }: Step2Props) {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Simple Step Header */}
            <div className="pb-6 border-b border-slate-200">
                <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">
                    Step 2 of 5
                </h2>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    Identity Documents
                </h1>
                <p className="text-sm text-slate-900 mt-2 font-bold opacity-80">
                    Upload clear photos of your NIC and other business documents.
                </p>
            </div>

            <div className="space-y-8">
                {/* NIC Number */}
                <FormField
                    control={control}
                    name="nic"
                    render={({ field }) => (
                        <FormItem className="space-y-2 max-w-sm">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                NIC / Registration Number *
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    {...field} 
                                    value={field.value || ""}
                                    placeholder="Enter number here" 
                                    className="h-14 px-5 rounded-xl border-2 border-slate-200 font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm" 
                                />
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FileUploadField
                        label="NIC Front Photo"
                        description="Upload the front side of your NIC."
                        fieldName="nicFrontUrl"
                        onUpload={handleUpload}
                    />
                    <FileUploadField
                        label="NIC Back Photo"
                        description="Upload the back side of your NIC."
                        fieldName="nicBackUrl"
                        onUpload={handleUpload}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FileUploadField
                        label="Business Registration (BR)"
                        description="Upload your BR certificate if applicable."
                        fieldName="brCertUrl"
                        onUpload={handleUpload}
                    />
                    <FileUploadField
                        label="Form 20/40"
                        description="Upload other corporate documents."
                        fieldName="policeReportUrl"
                        onUpload={handleUpload}
                    />
                </div>
            </div>

            {/* Simple Help Notice */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-[13px] text-slate-900 leading-snug font-bold opacity-90">
                    Documents are used for verification. Ensure photos are clear and readable.
                </p>
            </div>
        </div>
    );
}
