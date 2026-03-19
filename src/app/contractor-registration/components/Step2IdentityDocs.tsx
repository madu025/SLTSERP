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
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <div className="p-2 bg-blue-100/50 rounded-lg text-blue-600">
                    <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Identity Documents</h3>
                    <p className="text-xs text-slate-500">Upload documents and verify your identity details</p>
                </div>
            </div>

            <FormField
                control={control}
                name="nic"
                render={({ field }) => (
                    <FormItem className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                Verified NIC Number <BadgeCheck className="w-4 h-4 text-blue-500" />
                            </FormLabel>
                            {field.value && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 uppercase">Detection Active</span>}
                        </div>
                        <FormControl>
                            <Input {...field} className="h-12 text-lg font-black tracking-widest border-slate-200 bg-white shadow-sm focus:ring-blue-100 transition-all rounded-xl" placeholder="Extraction results appear here..." />
                        </FormControl>
                        <p className="text-[10px] text-slate-400 font-medium italic">Upload your NIC images below to automatically extract the number.</p>
                        <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
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
                    label="Business Registration (BR) Cert"
                    description="Required for corporate applications"
                    fieldName="brCertUrl"
                    value={watch("brCertUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.brCertUrl}
                    allowCamera={false}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUploadField
                    label="Police Report"
                    description="Upload a valid police report"
                    fieldName="policeReportUrl"
                    value={watch("policeReportUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.policeReportUrl}
                    required
                    allowCamera={false}
                />

                <FileUploadField
                    label="Grama Niladhari Cert"
                    description="Proof of permanent residence"
                    fieldName="gramaCertUrl"
                    value={watch("gramaCertUrl")}
                    onUpload={onUpload}
                    progress={uploadProgress.gramaCertUrl}
                    required
                    allowCamera={false}
                />
            </div>

            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BadgeCheck className="w-6 h-6 text-blue-500" />
                    <div>
                        <p className="text-[11px] font-bold text-blue-800">Smart Document Verification</p>
                        <p className="text-[10px] text-blue-600 opacity-80">NIC numbers are automatically extracted to save time.</p>
                    </div>
                </div>
                <div className="flex -space-x-2">
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-600">AI</div>
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500"><ImageIcon className="w-4 h-4" /></div>
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500"><FileText className="w-4 h-4" /></div>
                </div>
            </div>
        </div>
    );
}
