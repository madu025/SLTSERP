"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { CheckCircle2, FileText, ImageIcon, ShieldCheck, Banknote, Users, AlertCircle, BadgeCheck } from "lucide-react";

interface ReviewSectionProps {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}

const ReviewSection = ({ icon: Icon, title, children }: ReviewSectionProps) => (
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
    <div className="space-y-1.5 group p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 transition-all hover:bg-white hover:shadow-sm">
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] block ml-0.5 group-hover:text-blue-600 transition-colors">{label}</span>
        <p className="text-[15px] font-black text-slate-900 truncate leading-none mt-1">{value || "NOT PROVIDED"}</p>
    </div>
);

const ReviewDoc = ({ label, url }: { label: string; url?: string | null }) => (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden group hover:border-blue-200 transition-all hover:shadow-md h-[72px]">
        <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all shadow-inner">
                {url?.match(/\.(pdf)$/i) ? <FileText className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
            </div>
            <div className="space-y-0.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Type: Official Registry</span>
                <span className="text-xs font-black text-slate-800">{label}</span>
            </div>
        </div>
        {url ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 shadow-sm animate-in zoom-in-90 duration-300">
                <BadgeCheck className="w-3.5 h-3.5" />
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

export function Step5ReviewSubmission() {
    const { watch } = useFormContext<PublicRegistrationSchema>();
    const data = watch();

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-5 pb-6">
                <div className="inline-flex h-20 w-20 items-center justify-center bg-emerald-100/30 rounded-full text-emerald-600 mb-2 relative">
                    <CheckCircle2 className="w-10 h-10" />
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin transition-all" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Data Integrity Verification
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Final Registry Audit</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-bold opacity-80">
                        Please perform a final audit of all provided details before secure transmission to the SLT Vendor Verification System.
                    </p>
                </div>
            </div>

            <div className="space-y-8">
                <ReviewSection icon={ShieldCheck} title="Contractor Identity Details">
                    <ReviewItem label="Full Legal Entity Name" value={data.name} />
                    <ReviewItem label="National Identity Number" value={data.nic} />
                    <ReviewItem label="Registered Contact Phone" value={data.contactNumber} />
                    <ReviewItem label="Primary Physical Address" value={data.address} />
                </ReviewSection>

                <ReviewSection icon={Banknote} title="Financial Settlement Data">
                    <ReviewItem label="Financial Institution" value={data.bankName} />
                    <ReviewItem label="Account Number (Current/Savings)" value={data.bankAccountNumber} />
                    <ReviewItem label="Settlement Branch Office" value={data.bankBranch} />
                </ReviewSection>

                <ReviewSection icon={Users} title="Operational Resource Metrics">
                    <ReviewItem label="Field Teams Configured" value={data.teams?.length.toString()} />
                    <ReviewItem label="Total Roster Strength" value={data.teams?.reduce((acc, t) => acc + (t.members?.length || 0), 0).toString()} />
                    <ReviewItem label="Primary RTOM Jurisdiction" value={data.teams?.[0]?.opmcId === 'inherit' ? 'Default Registration' : data.teams?.[0]?.opmcId} />
                </ReviewSection>

                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-500">
                                <FileText className="w-5 h-5" />
                            </div>
                            <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-[0.2em]">Mandatory Verification Documents</h4>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full italic">8 Registry Items</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <ReviewDoc label="NIC Front Image" url={data.nicFrontUrl} />
                        <ReviewDoc label="NIC Back Image" url={data.nicBackUrl} />
                        <ReviewDoc label="Official Passport Photo" url={data.photoUrl} />
                        <ReviewDoc label="Bank Passbook / Statement" url={data.bankPassbookUrl} />
                        <ReviewDoc label="Onboarding Receipt" url={data.registrationFeeSlipUrl} />
                        <ReviewDoc label="Business BR Certificate" url={data.brCertUrl} />
                        <ReviewDoc label="Police Clearance Report" url={data.policeReportUrl} />
                        <ReviewDoc label="Grama Niladhari Cert" url={data.gramaCertUrl} />
                    </div>
                </div>
            </div>

            {/* Submission Declaration Notice */}
            <div className="relative overflow-hidden p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl mt-12 animate-in slide-in-from-bottom-6 duration-1000">
                <div className="absolute top-0 right-0 p-12 bg-blue-500/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 p-12 bg-emerald-500/10 blur-[100px] rounded-full" />
                
                <div className="relative flex flex-col sm:flex-row gap-8 items-start sm:items-center">
                    <div className="p-4 bg-white/10 rounded-2xl h-fit shadow-inner ring-1 ring-white/20 backdrop-blur-md">
                        <BadgeCheck className="w-10 h-10 text-white" />
                    </div>
                    <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-1 w-6 bg-blue-500 rounded-full" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Legal Certification & Submission</p>
                        </div>
                        <p className="text-[14px] text-slate-300 leading-relaxed font-medium">
                            I hereby certify that all information provided is accurate and all virtual documentation represents authentic copies of original government or institutional registries.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
