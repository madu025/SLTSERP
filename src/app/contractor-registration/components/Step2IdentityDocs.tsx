"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useOCR } from "@/hooks/useOCR";
import { ShieldCheck, FileText, ImageIcon, BadgeCheck, Zap, Scan } from "lucide-react";

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface Step2IdentityDocsProps {
    onUpload: (file: File, fieldName: string) => Promise<string | null>;
    uploadProgress: Record<string, number>;
}

export function Step2IdentityDocs({ onUpload, uploadProgress }: Step2IdentityDocsProps) {
    const { watch, setValue, control } = useFormContext<PublicRegistrationSchema>();
    const { scanImage, isScanning } = useOCR();

    const handleNICScan = async (url: string) => {
        const nic = await scanImage(url, "NIC Number");
        if (nic) setValue("nic", nic, { shouldValidate: true });
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Elite Sub-Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-8 border-b border-white/10 group">
                <div className="p-4 bg-emerald-600/20 text-emerald-400 rounded-3xl border border-emerald-500/20 shadow-2xl transition-all group-hover:scale-110">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Scan className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Security & Credentials</span>
                    </div>
                    <h3 className="text-3xl font-black text-white tracking-tight">Identity Verification</h3>
                    <p className="text-base text-slate-400 font-semibold leading-relaxed">Upload official documents to automatically verify your enterprise status</p>
                </div>
            </div>

            {/* Smart Detection Dynamic Hub */}
            <div className="relative group">
                <div className="absolute inset-x-0 inset-y-0 bg-blue-600/5 blur-3xl rounded-[32px] pointer-events-none" />
                <div className="relative bg-white/[0.03] backdrop-blur-3xl p-8 sm:p-10 rounded-[40px] border border-white/10 space-y-8 shadow-2xl shadow-blue-500/5 ring-1 ring-white/5">
                    <FormField
                        control={control}
                        name="nic"
                        render={({ field }) => (
                            <FormItem className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <FormLabel className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-3">
                                        NIC IDENTITY PARAMETER <BadgeCheck className="w-4 h-4 text-blue-500" />
                                    </FormLabel>
                                    {field.value && (
                                        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full border border-emerald-500/20 animate-pulse transition-all">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Registry Scan</span>
                                        </div>
                                    )}
                                </div>
                                <FormControl>
                                    <div className="relative group/input">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-[28px] blur opacity-25 group-hover/input:opacity-50 transition-opacity" />
                                        <Input 
                                            {...field} 
                                            className="relative h-20 text-3xl font-black tracking-[0.5em] border-white/10 bg-slate-950/50 shadow-inner focus:ring-blue-500/20 transition-all rounded-[24px] text-white placeholder:text-slate-800 text-center uppercase" 
                                            placeholder="AUTO-EXTRACT" 
                                        />
                                    </div>
                                </FormControl>
                                <div className="flex items-center gap-2 px-2 text-[11px] text-blue-400 font-black italic uppercase tracking-[0.1em] opacity-70">
                                    <Zap className="w-3.5 h-3.5" /> AI-powered extraction active for NIC front/back documents
                                </div>
                                <FormMessage className="text-[10px] font-bold text-rose-400" />
                            </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Premium Document Matrix */}
            <div className="space-y-10">
                <div className="flex items-center gap-3 px-2">
                    <div className="h-4 w-1 bg-emerald-600 rounded-full" />
                    <h4 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Registry Documentation (Required)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <FileUploadField
                        label="NIC Front Specimen"
                        description="High-resolution frontal scan"
                        fieldName="nicFrontUrl"
                        value={watch("nicFrontUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.nicFrontUrl}
                        isScanning={isScanning}
                        onScan={handleNICScan}
                        required
                    />

                    <FileUploadField
                        label="NIC Reverse Specimen"
                        description="High-resolution reverse scan"
                        fieldName="nicBackUrl"
                        value={watch("nicBackUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.nicBackUrl}
                        required
                    />

                    <FileUploadField
                        label="Identity Portrait"
                        description="Recent verify-ready photograph"
                        fieldName="photoUrl"
                        value={watch("photoUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.photoUrl}
                        required
                        allowCamera={false}
                    />

                    <FileUploadField
                        label="BR Certificate"
                        description="Latest legal registration scan"
                        fieldName="brCertUrl"
                        value={watch("brCertUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.brCertUrl}
                        allowCamera={false}
                    />

                    <FileUploadField
                        label="Law Enforcement Report"
                        description="Valid clearance certification"
                        fieldName="policeReportUrl"
                        value={watch("policeReportUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.policeReportUrl}
                        required
                        allowCamera={false}
                    />

                    <FileUploadField
                        label="JD Jurisdictional Cert"
                        description="Valid residence documentation"
                        fieldName="gramaCertUrl"
                        value={watch("gramaCertUrl")}
                        onUpload={onUpload}
                        progress={uploadProgress.gramaCertUrl}
                        required
                        allowCamera={false}
                    />
                </div>
            </div>

            {/* Smart Processing Professional Banner */}
            <div className="p-8 bg-blue-600/10 rounded-[32px] text-white border border-blue-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-8 animate-in slide-in-from-bottom-4 duration-1000 mt-4">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-blue-500/20 rounded-2xl h-fit border border-blue-400/20 shadow-xl">
                        <ImageIcon className="w-7 h-7 text-blue-400" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-400">Intelligent Document Pipeline</p>
                        <p className="text-[13px] text-blue-100/70 font-semibold leading-relaxed">Cross-verification and multi-modal number extraction active for all uploaded ID sets.</p>
                    </div>
                </div>
                <div className="flex items-center -space-x-3 px-4">
                    <div className="h-12 w-12 rounded-2xl border-2 border-slate-900 bg-blue-600 flex items-center justify-center text-[11px] font-black text-white shadow-2xl ring-1 ring-white/10 z-30">AI</div>
                    <div className="h-12 w-12 rounded-2xl border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-blue-400 shadow-2xl ring-1 ring-white/10 z-20"><FileText className="w-5 h-5" /></div>
                    <div className="h-12 w-12 rounded-2xl border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-blue-400 shadow-2xl ring-1 ring-white/10 z-10"><BadgeCheck className="w-5 h-5" /></div>
                    <div className="h-12 w-12 rounded-2xl border-2 border-slate-900 bg-blue-900 flex items-center justify-center text-[10px] font-black text-white shadow-2xl ring-1 ring-white/10 z-0">+5</div>
                </div>
            </div>
        </div>
    );
}
