"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { CheckCircle2, FileText, ImageIcon, ShieldCheck, Banknote, Users, AlertCircle, BadgeCheck } from "lucide-react";

export function Step5ReviewSubmission() {
    const { watch } = useFormContext<PublicRegistrationSchema>();
    const data = watch();

    const ReviewSection = ({ icon: Icon, title, children }: { icon: any, title: string, children: React.ReactNode }) => (
        <div className="space-y-6 p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                    <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-[0.2em]">{title}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                {children}
            </div>
        </div>
    );

    const ReviewItem = ({ label, value }: { label: string; value?: string | null }) => (
        <div className="space-y-1.5 group">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-0.5 group-hover:text-blue-500 transition-colors">{label}</span>
            <p className="text-sm font-bold text-slate-800 truncate bg-slate-50/50 px-3 py-2 rounded-xl border border-slate-100/50">{value || "Not provided"}</p>
        </div>
    );

    const ReviewDoc = ({ label, url }: { label: string; url?: string | null }) => (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden group hover:border-blue-200 transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                    {url?.match(/\.(pdf)$/i) ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <span className="text-xs font-bold text-slate-700">{label}</span>
            </div>
            {url ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 shadow-sm animate-in zoom-in-90 duration-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Verified</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-500 rounded-full border border-red-100 opacity-60">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Required</span>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-4 pb-4">
                <div className="inline-flex p-4 bg-emerald-100/50 rounded-full text-emerald-600 mb-2 shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Final Declaration Review</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed font-medium">Please perform a final audit of all provided details before secure submission to the SLT Vendor Verification System.</p>
            </div>

            <div className="space-y-8">
                <ReviewSection icon={ShieldCheck} title="Contractor Identity">
                    <ReviewItem label="Full Legal Name" value={data.name} />
                    <ReviewItem label="NIC Identity Number" value={data.nic} />
                    <ReviewItem label="Registered Phone" value={data.contactNumber} />
                    <ReviewItem label="Business Address" value={data.address} />
                </ReviewSection>

                <ReviewSection icon={Banknote} title="Financial Details">
                    <ReviewItem label="Financial Institution" value={data.bankName} />
                    <ReviewItem label="Account Number" value={data.bankAccountNumber} />
                    <ReviewItem label="Branch Location" value={data.bankBranch} />
                </ReviewSection>

                <ReviewSection icon={Users} title="Operational Metrics">
                    <ReviewItem label="Field Teams Configured" value={data.teams?.length.toString()} />
                    <ReviewItem label="Total Roster Strength" value={data.teams?.reduce((acc, t) => acc + (t.members?.length || 0), 0).toString()} />
                    <ReviewItem label="Primary RTOM" value={data.teams?.[0]?.opmcId === 'inherit' ? 'Default Registration' : data.teams?.[0]?.opmcId} />
                </ReviewSection>

                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-500">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-[0.2em]">Mandatory Documents</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <ReviewDoc label="NIC Front" url={data.nicFrontUrl} />
                        <ReviewDoc label="NIC Back" url={data.nicBackUrl} />
                        <ReviewDoc label="Passport Photo" url={data.photoUrl} />
                        <ReviewDoc label="Bank Passbook" url={data.bankPassbookUrl} />
                        <ReviewDoc label="Payment Receipt" url={data.registrationFeeSlipUrl} />
                        <ReviewDoc label="BR Certificate" url={data.brCertUrl} />
                        <ReviewDoc label="Police Report" url={data.policeReportUrl} />
                        <ReviewDoc label="Grama Niladhari" url={data.gramaCertUrl} />
                    </div>
                </div>
            </div>

            {/* Submission Declaration Notice */}
            <div className="p-6 bg-blue-600 rounded-3xl text-white shadow-2xl shadow-blue-200/50 flex gap-5 mt-12 animate-in slide-in-from-bottom-6 duration-1000">
                <div className="p-3.5 bg-white/20 rounded-2xl h-fit shadow-inner ring-1 ring-white/10 backdrop-blur-sm">
                    <BadgeCheck className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100">Certification & Submission</p>
                    <p className="text-[13px] text-blue-50 leading-relaxed font-semibold">
                        By submitting this application, you certify that all information provided is accurate and all documents represent authentic copies of official registers.
                    </p>
                </div>
            </div>
        </div>
    );
}
