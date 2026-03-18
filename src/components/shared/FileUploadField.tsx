"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ImageIcon, FileText, Upload, CheckCircle2, Loader2, XCircle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface FileUploadFieldProps {
    label: string;
    description?: string;
    value?: string | null;
    fieldName: string;
    onUpload: (file: File, fieldName: string) => Promise<string | null>;
    progress?: number;
    accept?: string;
    isScanning?: boolean;
    onScan?: (url: string) => Promise<void>;
    required?: boolean;
}

export function FileUploadField({
    label,
    description,
    value,
    fieldName,
    onUpload,
    progress,
    accept = "image/*,application/pdf",
    isScanning,
    onScan,
    required = false
}: FileUploadFieldProps) {
    const inputId = `file-${fieldName}`;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const uploadedUrl = await onUpload(e.target.files[0], fieldName);
            if (uploadedUrl && onScan) {
                await onScan(uploadedUrl);
            }
        }
    };

    return (
        <div className="space-y-4 p-4 rounded-xl border border-slate-100 bg-slate-50/30 transition-all hover:border-blue-100 hover:bg-slate-50/50">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <Label htmlFor={inputId} className="text-sm font-semibold text-slate-700">
                        {label} {required && <span className="text-red-500">*</span>}
                    </Label>
                    {description && <p className="text-xs text-slate-500">{description}</p>}
                </div>
                
                {value && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-100 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Verified</span>
                    </div>
                )}
            </div>

            <div className="relative group">
                <Input
                    id={inputId}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept={accept}
                />
                
                <Label
                    htmlFor={inputId}
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full min-h-[140px] rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                        value 
                            ? "border-green-200 bg-green-50/10" 
                            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
                    )}
                >
                    {value ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
                            {value.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                <div className="relative w-full h-[120px] rounded-lg overflow-hidden border shadow-sm group-hover:opacity-50 transition-opacity">
                                    <Image src={value} alt={label} fill className="object-cover" unoptimized />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-6 text-blue-600">
                                    <FileText className="w-10 h-10" />
                                    <span className="text-xs font-semibold">PDF Document Attached</span>
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                                <div className="flex items-center gap-2 text-white text-xs font-bold">
                                    <Upload className="w-4 h-4" /> Change File
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-6 text-slate-400 group-hover:text-blue-500 transition-colors">
                            <div className="p-3 bg-slate-50 rounded-full group-hover:bg-blue-100/50 transition-colors">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <span className="text-xs font-semibold block">Click to Upload</span>
                                <span className="text-[10px] block opacity-60">PDF or JPG/PNG (Max 5MB)</span>
                            </div>
                        </div>
                    )}

                    {isScanning && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 animate-in fade-in">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                            <span className="text-xs font-bold text-blue-600 animate-pulse">Scanning with AI...</span>
                        </div>
                    )}

                    {!value && progress !== undefined && progress > 0 && progress < 100 && (
                        <div className="absolute inset-x-4 bottom-4 space-y-2">
                            <Progress value={progress} className="h-1.5" />
                            <p className="text-[10px] text-center font-bold text-blue-600">{progress}% Uploading...</p>
                        </div>
                    )}
                </Label>
            </div>
        </div>
    );
}
