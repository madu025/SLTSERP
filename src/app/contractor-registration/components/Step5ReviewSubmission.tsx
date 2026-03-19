"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileText, ImageIcon, ShieldCheck, Banknote, Users, AlertCircle, BadgeCheck, Building2, ClipboardCheck } from "lucide-react";

interface ReviewSectionProps {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}

const ReviewSection = ({ icon: Icon, title, children }: ReviewSectionProps) => (
    <div className="space-y-6 p-8 rounded-[32px] border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 border border-slate-200 shadow-inner">
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
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-0.5">{label}</span>
        <p className="text-[15px] font-black text-slate-900 truncate leading-relaxed">{value || "NOT PROVIDED"}</p>
    </div>
);

const ReviewDoc = ({ label, url }: { label: string; url?: string | null }) => (
    <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50/50 shadow-sm overflow-hidden group hover:bg-white hover:border-blue-200 transition-all h-[72px]">
        <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-all shadow-sm">
                {url?.match(/\.(pdf)$/i) ? <FileText className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
            </div>
            <div className="space-y-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Format: Official Specimen</span>
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{label}</span>
            </div>
        </div>
        {url ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 animate-in zoom-in-90 duration-300">
                <BadgeCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Audited</span>
            </div>
        ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-500 rounded-lg border border-rose-100 opacity-60">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Missing</span>
            </div>
        )}
    </div>
);

export function Step5ReviewSubmission() {
    const { watch } = useFormContext<PublicRegistrationSchema>();
    const data = watch();

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Professional Step Header */}
            <div className="text-center space-y-6 pb-4 border-b border-slate-100">
                <div className="inline-flex h-20 w-20 items-center justify-center bg-blue-50 rounded-[28px] text-blue-600 mb-2 border border-blue-100 shadow-inner">
                    <ClipboardCheck className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Data Integrity Verification Protocol
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Enrollment Registry Review</h3>
                    <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed font-bold opacity-80 uppercase tracking-tight">
                        Confirm final accuracy of all digitized corporate data before official ERP synchronization and legal certification.
                    </p>
                </div>
            </div>

            <div className="space-y-10">
                <ReviewSection icon={Building2} title="Corporate Entity Parameters">
                    <ReviewItem label="Official Business Name" value={data.name} />
                    <ReviewItem label="National ID / Registration No." value={data.nic} />
                    <ReviewItem label="Verified Contact Terminal" value={data.contactNumber} />
                    <ReviewItem label="Registered Physical Address" value={data.address} />
                </ReviewSection>

                <ReviewSection icon={Banknote} title="Financial Settlement Registry">
                    <ReviewItem label="Corporate Banking Institution" value={data.bankName} />
                    <ReviewItem label="Verified Settlement Account" value={data.bankAccountNumber} />
                    <ReviewItem label="Operational Branch Office" value={data.bankBranch} />
                </ReviewSection>

                <ReviewSection icon={Users} title="Operational Resource Summary">
                    <ReviewItem label="Field Service Units Configured" value={data.teams?.length.toString()} />
                    <ReviewItem label="Total Roster Strength" value={data.teams?.reduce((acc, t) => acc + (t.members?.length || 0), 0).toString()} />
                    <ReviewItem label="Primary OPMC Jurisdiction" value={data.teams?.[0]?.opmcId === 'inherit' ? 'Registry Default' : data.teams?.[0]?.opmcId} />
                </ReviewSection>

                <div className="space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-[0.3em]">Mandatory Registry Specimen Audit</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <ReviewDoc label="NIC Front Specimen" url={data.nicFrontUrl} />
                        <ReviewDoc label="NIC Reverse Specimen" url={data.nicBackUrl} />
                        <ReviewDoc label="Registry Portrait" url={data.photoUrl} />
                        <ReviewDoc label="Bank Specimen" url={data.bankPassbookUrl} />
                        <ReviewDoc label="Fee Receipt Specimen" url={data.registrationFeeSlipUrl} />
                        <ReviewDoc label="Corporate Cert (BR)" url={data.brCertUrl} />
                    </div>
                </div>
            </div>

            {/* Official Legal Declaration Notice */}
            <div className="relative overflow-hidden p-10 bg-slate-950 rounded-[40px] text-white shadow-2xl mt-12 animate-in slide-in-from-bottom-8 duration-1000 border-t-8 border-blue-600 ring-1 ring-white/10 group/dec">
                <div className="absolute top-0 right-0 p-24 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="relative flex flex-col md:flex-row gap-10 items-start md:items-center">
                    <div className="p-5 bg-white/10 rounded-2xl h-fit border border-white/20 backdrop-blur-xl shadow-inner group-hover/dec:scale-105 transition-transform">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-1 w-6 bg-blue-500 rounded-full" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Legal Certification & Submission Statement</p>
                        </div>
                        <p className="text-[15px] lg:text-[16px] text-slate-300 leading-relaxed font-bold tracking-tight">
                            I hereby solemnly certify that all information provided is accurate and all virtual documentation represents authentic copies of original government or institutional registries. Submission of false data is a legislative violation.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
