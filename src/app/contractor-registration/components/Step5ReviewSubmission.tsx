"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { CheckCircle2, FileText, ImageIcon, ShieldCheck, Banknote, Users, Building2, AlertCircle } from "lucide-react";
import Image from "next/image";

export function Step5ReviewSubmission() {
    const { watch } = useFormContext<PublicRegistrationSchema>();
    const data = watch();

    const ReviewSection = ({ icon: Icon, title, children }: any) => (
        <div className="space-y-4 p-6 rounded-2xl border border-slate-100 bg-slate-50/20">
            <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-slate-500">
                    <Icon className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest">{title}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {children}
            </div>
        </div>
    );

    const ReviewItem = ({ label, value }: { label: string; value?: string | null }) => (
        <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
            <p className="text-[13px] font-semibold text-slate-700 truncate">{value || "Not provided"}</p>
        </div>
    );

    const ReviewDoc = ({ label, url }: { label: string; url?: string | null }) => (
        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden group hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    {url?.match(/\.(pdf)$/i) ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                </div>
                <span className="text-[11px] font-bold text-slate-600">{label}</span>
            </div>
            {url ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase">Ready</span>
                </div>
            ) : (
                <span className="text-[10px] font-bold text-red-500 uppercase">Missing</span>
            )}
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-2 pb-8">
                <div className="inline-flex p-3 bg-green-100 rounded-full text-green-600 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Final Verification</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">Please review all your details carefully before submitting the application. Once submitted, you cannot edit until it's reviewed by SLT.</p>
            </div>

            <div className="space-y-6">
                <ReviewSection icon={ShieldCheck} title="Identity & Personal">
                    <ReviewItem label="Full Name" value={data.name} />
                    <ReviewItem label="NIC Number" value={data.nic} />
                    <ReviewItem label="Contact number" value={data.contactNumber} />
                    <ReviewItem label="address" value={data.address} />
                </ReviewSection>

                <ReviewSection icon={Banknote} title="Bank & Payments">
                    <ReviewItem label="Bank Name" value={data.bankName} />
                    <ReviewItem label="Account Number" value={data.bankAccountNumber} />
                    <ReviewItem label="Branch" value={data.bankBranch} />
                </ReviewSection>

                <ReviewSection icon={Users} title="Teams & Logistics">
                    <ReviewItem label="Total Teams" value={data.teams?.length.toString()} />
                    <ReviewItem label="Total Members" value={data.teams?.reduce((acc, t) => acc + (t.members?.length || 0), 0).toString()} />
                </ReviewSection>

                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/20 space-y-6">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-slate-500">
                            <FileText className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest">Document Checklist</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <ReviewDoc label="NIC Front" url={data.nicFrontUrl} />
                        <ReviewDoc label="NIC Back" url={data.nicBackUrl} />
                        <ReviewDoc label="Passport Photo" url={data.photoUrl} />
                        <ReviewDoc label="Bank Passbook" url={data.bankPassbookUrl} />
                        <ReviewDoc label="Payment Slip" url={data.registrationFeeSlipUrl} />
                        <ReviewDoc label="BR Certificate" url={data.brCertUrl} />
                        <ReviewDoc label="Police Report" url={data.policeReportUrl} />
                        <ReviewDoc label="Grama Niladhari Cert" url={data.gramaCertUrl} />
                    </div>
                </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-4 mt-8">
                <div className="p-3 bg-white rounded-full shadow-sm text-amber-500">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Submission Declaration</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                        By clicking "Confirm & Submit Application", you certify that all information provided is accurate and all uploaded documents are genuine copies of the originals.
                    </p>
                </div>
            </div>
        </div>
    );
}
