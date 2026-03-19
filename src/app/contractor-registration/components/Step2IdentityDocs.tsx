"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { ShieldCheck, Scan, Fingerprint } from "lucide-react";

interface Step2Props {
    handleUpload: (file: File, fieldName: string) => Promise<string | null>;
}

export function Step2IdentityDocs({ handleUpload }: Step2Props) {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Professional Step Header */}
            <div className="pb-8 border-b border-slate-200 mb-8">
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                    <Fingerprint className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Module Stage 02 | Biometric & Registry Audit</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Legislative Documentation</h3>
                <p className="text-sm text-slate-900 max-w-2xl mt-2 leading-relaxed font-bold opacity-90">
                    Upload digitized high-resolution specimens of your official identification. These documents are verified against the national database 
                    to ensure legal compliance and eligibility within the SLTS network.
                </p>
            </div>

            <div className="space-y-10 group/id">
                {/* NIC Number Direct Entry */}
                <FormField
                    control={control}
                    name="nic"
                    render={({ field }) => (
                        <FormItem className="space-y-4 max-w-md">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-[0.3em] flex items-center gap-2">
                                <Scan className="w-3.5 h-3.5 text-blue-600" /> Identity Synchronization Terminal
                            </FormLabel>
                            <FormControl>
                                <div className="group relative transition-all">
                                    <Input 
                                        {...field} 
                                        value={field.value || ""}
                                        placeholder="Syncing from scanned specimens..." 
                                        className="h-16 px-8 rounded-2xl border-2 border-slate-200 bg-white shadow-inner transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 font-black text-lg tracking-widest placeholder:text-slate-300" 
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                                            <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Active Scan</span>
                                        </div>
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploadField
                        label="NIC Specimen (Alpha/Front)"
                        description="National Identity Card digitized front specimen."
                        fieldName="nicFront"
                        onUpload={handleUpload}
                    />
                    <FileUploadField
                        label="NIC Specimen (Beta/Back)"
                        description="National Identity Card digitized back specimen."
                        fieldName="nicBack"
                        onUpload={handleUpload}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploadField
                        label="Corporate Certification (BRN)"
                        description="Business Registration document authorizing organizational operation."
                        fieldName="brnFile"
                        onUpload={handleUpload}
                    />
                    <FileUploadField
                        label="Executive Authorization Specimen"
                        description="Form 20/40 or equivalent corporate identity documentation."
                        fieldName="form20"
                        onUpload={handleUpload}
                    />
                </div>
            </div>

            {/* Official Notice */}
            <div className="p-8 rounded-3xl bg-slate-50 border-2 border-slate-200 flex items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-blue-100 shadow-sm flex items-center justify-center flex-shrink-0 animate-pulse">
                    <ShieldCheck className="w-7 h-7 text-blue-600" />
                </div>
                <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Automated Registry Audit</h4>
                    <p className="text-sm text-slate-900 leading-relaxed font-bold">
                        Our integrated OCR (Optical Character Recognition) terminal will automatically parse the uploaded specimens to verify 
                        institutional authenticity. Ensure all captures are high-resolution and maintain architectural framing.
                    </p>
                </div>
            </div>
        </div>
    );
}
