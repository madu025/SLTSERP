"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useOCR } from "@/hooks/useOCR";
import { ShieldCheck, FileText, ImageIcon, BadgeCheck } from "lucide-react";

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
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
                <div className="p-3 bg-blue-100/50 rounded-2xl text-blue-600 w-fit">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Identity Verification</h3>
                    <p className="text-sm text-slate-500">Upload official documents to automatically verify your identity</p>
                </div>
            </div>

            {/* Smart Detection Card */}
            <div className="bg-blue-50/50 p-6 sm:p-8 rounded-3xl border border-blue-100/50 space-y-6 shadow-sm">
                <FormField
                    control={control}
                    name="nic"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 flex items-center gap-2">
                                    Official NIC Number <BadgeCheck className="w-4 h-4" />
                                </FormLabel>
                                {field.value && (
                                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 animate-pulse">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Verified Scan</span>
                                    </div>
                                )}
                            </div>
                            <FormControl>
                                <Input 
                                    {...field} 
                                    className="h-16 text-2xl font-black tracking-[0.3em] border-blue-200 bg-white shadow-inner focus:ring-blue-100 transition-all rounded-2xl text-slate-900 placeholder:text-slate-400" 
                                    placeholder="SCAN TO EXTRACT" 
                                />
                            </FormControl>
                            <p className="text-[10px] text-blue-400 font-bold italic ml-1">Upload NIC Front/Back below for AI-powered number extraction.</p>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                />
            </div>

            {/* Upload Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                <FileUploadField
                    label="NIC Front"
                    description="Clear image of the front side"
                    fieldName="nicFrontUrl"
                    value={watch("nicFrontUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.nicFrontUrl}
                    isScanning={isScanning}
                    onScan={handleNICScan}
                    required
                />

                <FileUploadField
                    label="NIC Back"
                    description="Clear image of the back side"
                    fieldName="nicBackUrl"
                    value={watch("nicBackUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.nicBackUrl}
                    required
                />

                <FileUploadField
                    label="Passport Photo"
                    description="Recent photo with white background"
                    fieldName="photoUrl"
                    value={watch("photoUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.photoUrl}
                    required
                    allowCamera={false}
                />

                <FileUploadField
                    label="Business Registration (BR)"
                    description="Latest BR certificate image"
                    fieldName="brCertUrl"
                    value={watch("brCertUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.brCertUrl}
                    allowCamera={false}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FileUploadField
                    label="Police Report"
                    description="Valid police clearance report"
                    fieldName="policeReportUrl"
                    value={watch("policeReportUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.policeReportUrl}
                    required
                    allowCamera={false}
                />

                <FileUploadField
                    label="Grama Niladhari Cert"
                    description="Latest residence certificate"
                    fieldName="gramaCertUrl"
                    value={watch("gramaCertUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.gramaCertUrl}
                    required
                    allowCamera={false}
                />
            </div>

            {/* Smart Processing Banner */}
            <div className="p-5 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-6 animate-in slide-in-from-bottom-2 duration-700 mt-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/20 rounded-xl h-fit shadow-inner">
                        <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Smart Document AI</p>
                        <p className="text-[11px] text-blue-50 font-medium">Automatic number extraction is enabled for NIC documents.</p>
                    </div>
                </div>
                <div className="flex items-center -space-x-2.5 px-2">
                    <div className="h-10 w-10 rounded-full border-2 border-blue-500 bg-blue-400 flex items-center justify-center text-[9px] font-black text-white shadow-lg ring-1 ring-white/20">AI</div>
                    <div className="h-10 w-10 rounded-full border-2 border-blue-500 bg-slate-100 flex items-center justify-center text-slate-500 shadow-lg ring-1 ring-white/20"><FileText className="w-4 h-4" /></div>
                    <div className="h-10 w-10 rounded-full border-2 border-blue-500 bg-slate-100 flex items-center justify-center text-slate-500 shadow-lg ring-1 ring-white/20"><BadgeCheck className="w-4 h-4" /></div>
                    <div className="h-10 w-10 rounded-full border-2 border-blue-500 bg-blue-500 flex items-center justify-center text-[9px] font-black text-white shadow-lg ring-1 ring-white/20">+3</div>
                </div>
            </div>
        </div>
    );
}
