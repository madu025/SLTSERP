"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { ShieldCheck, Scan, Fingerprint } from "lucide-react";

interface Step2Props {
    handleUpload: (file: File, fieldName: string) => Promise<string | null>;
    uploadProgress: Record<string, number>;
}

export function Step2IdentityDocs({ handleUpload, uploadProgress }: Step2Props) {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Professional Step Header */}
            <div className="pb-8 border-b border-slate-100 mb-8">
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                    <Fingerprint className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Module Stage 02 | Biometric & Registry Audit</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Legislative Documentation</h3>
                <p className="text-sm text-slate-500 max-w-2xl mt-2 leading-relaxed font-bold opacity-80">
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
                                        placeholder="Syncing from scanned specimens..." 
                                        className="h-16 px-8 rounded-2xl border-2 border-slate-100 bg-slate-50/50 shadow-inner transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 font-black text-lg tracking-widest placeholder:text-slate-200 placeholder:italic" 
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                                            <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Scan</span>
                                        </div>
                                    </div>
                                </div>
                            </FormControl>
                            <FormDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 italic">OCR system will automatically populate this during upload</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploadField
                        label="Identity Specimen (Front)"
                        description="Clear high-resolution capture of NIC Front surface"
                        fieldName="nicFrontUrl"
                        onUpload={handleUpload}
                        progress={uploadProgress.nicFrontUrl}
                        required
                    />
                    <FileUploadField
                        label="Identity Specimen (Reverse)"
                        description="Clear high-resolution capture of NIC Reverse surface"
                        fieldName="nicBackUrl"
                        onUpload={handleUpload}
                        progress={uploadProgress.nicBackUrl}
                        required
                    />
                    <FileUploadField
                        label="Official Personnel Portrait"
                        description="Passport-style photograph with high-clarity facial features"
                        fieldName="photoUrl"
                        onUpload={handleUpload}
                        progress={uploadProgress.photoUrl}
                        required
                    />
                    <FileUploadField
                        label="Business Registration (BR) Specimen"
                        description="Authorized corporate registration certificate (Full Image)"
                        fieldName="brCertUrl"
                        onUpload={handleUpload}
                        progress={uploadProgress.brCertUrl}
                        required
                    />
                </div>

                {/* Audit Integrity Notice */}
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex gap-6 items-center">
                    <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-900 tracking-widest mb-0.5">Automated Registry Audit</p>
                        <p className="text-xs text-slate-500 font-bold opacity-70">
                            Our AI-driven OCR extraction protocol ensures data integrity by cross-referencing visual scans with the SLT national registry. 
                            Manual overrides are recorded for physical verification.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
